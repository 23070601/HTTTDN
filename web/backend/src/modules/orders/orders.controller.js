// src/modules/orders/orders.controller.js
// ============================================================
//  Orders — core business logic
//  - create: validates stock, builds order_number, inserts
//    orders + order_items in one transaction (triggers handle
//    stock deduction and audit logging automatically)
//  - updateDeliveryStatus: triggers loyalty accrual when set
//    to 'Delivered'
//
//  FIX 3: Order locking after Processing — prevents edits to
//         customer, payment method, items once order moves to
//         Processing or Shipping status
//
//  FIX 4: Status logic separation (independent lifecycles):
//    - delivery_status: Business flow → Pending → Confirmed → Processing → Shipping → Delivered → Cancelled
//    - payment_status: Payment lifecycle → Pending → Paid → Failed → Refunded → Credit
//    - fulfillment_status: (Future) Logistics tracking → Pending → Processing → Shipped → Delivered
//         Currently unmapped but architecture ready
//
//  FIX 7: Sales channel behavior rules:
//    Channel    | Finalization Model  | Payment Flow              | Fulfillment
//    -----------|---------------------|--------------------------|-----------------------------------
//    in_store   | batch_job (EOD)     | Cash/Card → Immediate    | In-store → Delivered (batch)
//    online     | event_driven        | COD/Transfer → Manual    | Order → Shipped → Delivered
//    dealer     | contract_driven     | Invoice/Credit → Terms   | Contract terms → Delivered
//    marketplace| webhook_driven      | Platform-handled         | Platform → Webhook → Delivered
//
//  FIX 8: Return handling:
//    Returns are now SEPARATE TRANSACTIONS (see returns.controller.js)
//    No longer change order.status to 'Returned'
//    Use POST /api/returns to create return_request entities
// ============================================================
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const R = require('../../common/utils/response');
const { getPagination } = require('../../common/utils/paginate');

const CUSTOMER_TYPES = new Set(['retail', 'dealer', 'guest', 'marketplace']);
const SALES_CHANNELS = new Set(['in_store', 'online', 'dealer']);
const PLATFORM_BY_CHANNEL = {
  in_store: 'physical_store',
  online: 'website',
  dealer: 'dealer_portal',
};
const ORDER_EDIT_LOCK_DAYS = 30;
const PRE_SHIPPING_STATUSES = new Set(['Pending', 'Confirmed', 'Processing']);
const SHIPPED_STATUS = 'Shipping';
const DELIVERED_STATUS = 'Delivered';
const CANCELLED_STATUS = 'Cancelled';
const CLOSED_STATUSES = new Set([CANCELLED_STATUS]);

// FIX 7: Sales channel finalization behavior rules
const CHANNEL_FINALIZATION = {
  in_store: 'batch_job',      // Daily EOD batch closes paid in_store orders
  online: 'event_driven',     // Manual status updates per shipment events
  marketplace: 'webhook_driven',  // Platform webhooks drive status
  dealer: 'contract_driven',  // Invoice/payment terms drive status
};

// Payment methods allowed per sales_channel
const PAYMENT_METHODS_BY_CHANNEL = {
  in_store: ['Cash', 'Card'],
  online: ['COD', 'Bank Transfer', 'Card', 'Momo', 'VNPay'],
  dealer: ['Invoice', 'Credit Terms', 'Bank Transfer'],
  marketplace: ['Handled_by_Platform'],
};

// Function to derive payment_status from payment_method + sales_channel
function derivePaymentStatus(paymentMethod, salesChannel, customerType, paymentConfirmed = false) {
  if (salesChannel === 'marketplace') return 'Handled_by_Platform';
  if (customerType === 'dealer' && (paymentMethod === 'Invoice' || paymentMethod === 'Credit Terms')) return 'Credit';
  if (salesChannel === 'in_store' && (paymentMethod === 'Cash' || paymentMethod === 'Card')) return 'Paid';
  if (paymentMethod === 'COD') return 'Unpaid';
  if (paymentMethod === 'Bank Transfer') return paymentConfirmed ? 'Paid' : 'Pending';
  return 'Unpaid';
}

function getOrderAgeInDays(orderedAt) {
  const created = new Date(orderedAt);
  const diff = Date.now() - created.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function getEditableOrderMode(deliveryStatus) {
  if (PRE_SHIPPING_STATUSES.has(deliveryStatus)) return 'pre_shipping';
  if (deliveryStatus === 'Processing') return 'processing_locked';
  if (deliveryStatus === SHIPPED_STATUS) return 'shipping_locked';
  if (deliveryStatus === DELIVERED_STATUS) return 'delivered';
  if (CLOSED_STATUSES.has(deliveryStatus)) return 'closed';
  return 'unknown';
}

async function logOrderAudit(conn, { userId, action, riskLevel = 'Normal', details }) {
  await conn.query(
    `INSERT INTO audit_logs (user_id, action, module, risk_level, details)
     VALUES (?, ?, 'Orders', ?, ?)`,
    [userId || null, action, riskLevel, details]
  );
}

function buildOrderChangeDetails(orderId, changes) {
  return JSON.stringify({
    order_id: orderId,
    changes,
  });
}

function generateGuestEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@guest.local`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

// ─── Helpers ──────────────────────────────────────────────────
function generateOrderNumber() {
  const now = new Date();
  const ts  = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${ts}-${rnd}`;
}

// ─── LIST ─────────────────────────────────────────────────────
async function list(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const { delivery_status, payment_status, sales_channel, platform, customer_type, customer_id, search, from, to } = req.query;

  let where = 'WHERE 1=1';
  const params = [];
  if (delivery_status) { where += ' AND o.delivery_status = ?'; params.push(delivery_status); }
  if (payment_status)  { where += ' AND o.payment_status = ?';  params.push(payment_status); }
  if (sales_channel)   { where += ' AND o.sales_channel = ?';   params.push(sales_channel); }
  if (platform)        { where += ' AND o.platform = ?';        params.push(platform); }
  if (customer_type)   { where += ' AND o.customer_type = ?';    params.push(customer_type); }
  if (customer_id)     { where += ' AND o.customer_id = ?';     params.push(customer_id); }
  if (from)            { where += ' AND DATE(o.ordered_at) >= ?'; params.push(from); }
  if (to)              { where += ' AND DATE(o.ordered_at) <= ?'; params.push(to); }
  if (search)          {
    where += ' AND (o.order_number LIKE ? OR c.full_name LIKE ? OR c.phone_number LIKE ? OR d.dealer_name LIKE ? OR d.contact_person LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN dealers d ON d.dealer_id = o.dealer_id
       ${where}`,
      params
    );
    // FIX 6: Add return_status to order list (derived from return_requests table)
    const [rows] = await pool.query(
      `SELECT o.*, COALESCE(d.dealer_name, c.full_name) AS customer_name,
              c.phone_number AS customer_phone,
              d.dealer_name, d.credit_limit, d.debt_amount, d.payment_terms, d.wholesale_tier,
              u.full_name AS staff_name,
              CASE
                WHEN COUNT(rr.return_id) = 0 THEN 'None'
                WHEN SUM(CASE WHEN rr.return_type='full' THEN 1 ELSE 0 END) > 0 THEN 'Fully Returned'
                WHEN SUM(CASE WHEN rr.return_type='partial' THEN 1 ELSE 0 END) > 0 THEN 'Partial Returned'
                WHEN MAX(rr.status) = 'pending' THEN 'Return Pending'
                ELSE 'None'
              END AS return_status
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN dealers d ON d.dealer_id = o.dealer_id
       LEFT JOIN users u ON u.user_id = o.user_id
       LEFT JOIN return_requests rr ON rr.order_id = o.order_id
       ${where}
       GROUP BY o.order_id
       ORDER BY o.ordered_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return R.paginated(res, { rows, total, page, limit });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─── GET ONE ──────────────────────────────────────────────────
async function getOne(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT o.*, COALESCE(d.dealer_name, c.full_name) AS customer_name,
              c.phone_number AS customer_phone,
              c.email AS customer_email, c.loyalty_points_balance,
              d.dealer_name, d.region AS dealer_region, d.city AS dealer_city,
              d.contact_person AS dealer_contact_person, d.phone_number AS dealer_phone,
              d.email AS dealer_email, d.credit_limit, d.debt_amount, d.payment_terms,
              d.wholesale_tier,
              u.full_name AS staff_name
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN dealers d ON d.dealer_id = o.dealer_id
       LEFT JOIN users u ON u.user_id = o.user_id
       WHERE o.order_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return R.notFound(res, 'Order not found.');

    const [items] = await pool.query(
      `SELECT oi.*, p.product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    return R.ok(res, { ...rows[0], items });
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─── CREATE ───────────────────────────────────────────────────
async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const {
    customer_id = null,
    dealer_id = null,
    customer_type = null,
    customer_name = null,
    customer_email = null,
    customer_phone = null,
    sales_channel,
    platform = null,
    payment_method  = null,
    payment_confirmed = false,
    shipping_address = null,
    city             = null,
    shipping_fee     = 0,
    loyalty_discount = 0,
    note             = null,
    items,           // [{ product_id, quantity, unit_price? }]
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (!SALES_CHANNELS.has(sales_channel)) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Manual orders only support in_store, online, and dealer sales channels.');
    }

    if (sales_channel === 'marketplace') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Marketplace orders must be created by marketplace sync only.');
    }

    const resolvedPlatform = platform || PLATFORM_BY_CHANNEL[sales_channel];
    if (!resolvedPlatform || PLATFORM_BY_CHANNEL[sales_channel] !== resolvedPlatform) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Platform does not match the selected sales channel.');
    }

    // Shipping address is required for online and dealer orders, but NOT for in_store
    if (sales_channel !== 'in_store' && (!shipping_address || !shipping_address.trim())) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Shipping address is required for this sales channel.');
    }

    const resolvedCustomerType = CUSTOMER_TYPES.has(customer_type) ? customer_type : (dealer_id ? 'dealer' : customer_id ? 'retail' : 'guest');
    let resolvedCustomerId = customer_id;
    let resolvedDealerId = dealer_id;

    // 1. Resolve buyer/customer record for the unified order model
    if (resolvedCustomerType === 'dealer') {
      if (!resolvedDealerId) { await conn.rollback(); conn.release(); return R.badRequest(res, 'Dealer order requires dealer_id.'); }
      const [[dealer]] = await conn.query('SELECT * FROM dealers WHERE dealer_id = ?', [resolvedDealerId]);
      if (!dealer) { await conn.rollback(); conn.release(); return R.notFound(res, 'Dealer not found.'); }

      const dealerEmail = normalizeText(dealer.email) || generateGuestEmail(`dealer-${dealer.dealer_id}`);
      const [dealerCustomers] = await conn.query(
        `SELECT customer_id FROM customers
         WHERE customer_type = 'dealer' AND (email = ? OR phone_number = ? OR full_name = ?)
         ORDER BY customer_id DESC LIMIT 1`,
        [dealerEmail, dealer.phone_number || null, dealer.dealer_name]
      );

      if (dealerCustomers.length) {
        resolvedCustomerId = dealerCustomers[0].customer_id;
        await conn.query(
          'UPDATE customers SET full_name = ?, phone_number = COALESCE(?, phone_number), email = ?, customer_type = ?, city = COALESCE(?, city), address = COALESCE(?, address) WHERE customer_id = ?',
          [dealer.dealer_name, dealer.phone_number || null, dealerEmail, 'dealer', dealer.city || null, dealer.region || null, resolvedCustomerId]
        );
      } else {
        const [customerResult] = await conn.query(
          `INSERT INTO customers (full_name, email, phone_number, city, address, customer_type, segment)
           VALUES (?, ?, ?, ?, ?, 'dealer', 'Wholesale')`,
          [dealer.dealer_name, dealerEmail, dealer.phone_number || null, dealer.city || null, dealer.region || null]
        );
        resolvedCustomerId = customerResult.insertId;
      }
    } else if (resolvedCustomerType === 'guest') {
      const guestName = normalizeText(customer_name) || 'Guest Customer';
      const guestEmail = normalizeText(customer_email) || generateGuestEmail('guest');
      const [guestMatch] = await conn.query(
        `SELECT customer_id FROM customers WHERE customer_type = 'guest' AND email = ? LIMIT 1`,
        [guestEmail]
      );
      if (guestMatch.length) {
        resolvedCustomerId = guestMatch[0].customer_id;
      } else {
        const [customerResult] = await conn.query(
          `INSERT INTO customers (full_name, email, phone_number, address, city, customer_type, segment)
           VALUES (?, ?, ?, ?, ?, 'guest', 'New')`,
          [guestName, guestEmail, customer_phone || null, shipping_address || null, city || null]
        );
        resolvedCustomerId = customerResult.insertId;
      }
    } else if (resolvedCustomerId) {
      const [[customer]] = await conn.query('SELECT customer_id, customer_type FROM customers WHERE customer_id = ?', [resolvedCustomerId]);
      if (!customer) { await conn.rollback(); conn.release(); return R.notFound(res, 'Customer not found.'); }
      if (customer.customer_type !== resolvedCustomerType) {
        await conn.query('UPDATE customers SET customer_type = ? WHERE customer_id = ?', [resolvedCustomerType, resolvedCustomerId]);
      }
    } else if (customer_name || customer_email || customer_phone) {
      const fallbackEmail = normalizeText(customer_email) || generateGuestEmail('customer');
      const [customerResult] = await conn.query(
        `INSERT INTO customers (full_name, email, phone_number, address, city, customer_type, segment)
         VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        [normalizeText(customer_name) || 'New Customer', fallbackEmail, customer_phone || null, shipping_address || null, city || null, resolvedCustomerType, resolvedCustomerType === 'guest' ? 'New' : 'Loyal']
      );
      resolvedCustomerId = customerResult.insertId;
    } else {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Customer information is required.');
    }

    // 2. Fetch product prices + stock
    const productIds = items.map(i => i.product_id);
    const [products] = await conn.query(
      'SELECT product_id, selling_price, stock_quantity, status FROM products WHERE product_id IN (?)',
      [productIds]
    );
    const productMap = Object.fromEntries(products.map(p => [p.product_id, p]));

    // 3. Validate stock and build line items
    const lineItems = [];
    let subtotalSum = 0;

    for (const item of items) {
      const prod = productMap[item.product_id];
      if (!prod) { await conn.rollback(); conn.release(); return R.badRequest(res, `Product ${item.product_id} not found.`); }
      if (prod.status === 'Discontinued') { await conn.rollback(); conn.release(); return R.badRequest(res, `Product ${item.product_id} is discontinued.`); }
      if (prod.stock_quantity < item.quantity) {
        await conn.rollback(); conn.release();
        return R.badRequest(res, `Insufficient stock for product ${item.product_id}. Available: ${prod.stock_quantity}.`);
      }
      const unit_price = item.unit_price || prod.selling_price;
      const subtotal   = parseFloat((unit_price * item.quantity).toFixed(2));
      subtotalSum += subtotal;
      lineItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price, subtotal });
    }

    const total_amount = parseFloat((subtotalSum + parseFloat(shipping_fee) - parseFloat(loyalty_discount)).toFixed(2));
    if (total_amount < 0) { await conn.rollback(); conn.release(); return R.badRequest(res, 'Total amount cannot be negative.'); }

    const order_number = generateOrderNumber();
    
    // Determine payment method based on sales_channel
    let resolvedPaymentMethod = payment_method;
    if (sales_channel === 'marketplace') {
      resolvedPaymentMethod = 'Handled_by_Platform';
    } else if (!resolvedPaymentMethod) {
      resolvedPaymentMethod = resolvedCustomerType === 'dealer' ? 'Invoice' : null;
    } else {
      // Validate payment_method is allowed for this channel
      const allowedMethods = PAYMENT_METHODS_BY_CHANNEL[sales_channel] || [];
      if (!allowedMethods.includes(resolvedPaymentMethod)) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, `Payment method "${resolvedPaymentMethod}" is not allowed for ${sales_channel} orders.`);
      }
    }

    // Calculate payment_status based on payment_method and sales_channel
    const payment_status = derivePaymentStatus(resolvedPaymentMethod, sales_channel, resolvedCustomerType, Boolean(payment_confirmed));
    
    const invoice_number = resolvedCustomerType === 'dealer' ? `INV-${order_number}` : null;
    const invoice_status = resolvedCustomerType === 'dealer' ? 'Generated' : 'Not Generated';

    // 4. Insert order
    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (customer_id, dealer_id, user_id, order_number, customer_type, sales_channel, platform, payment_method, payment_status, payment_confirmed,
         invoice_number, invoice_status, shipping_address, city, total_amount, shipping_fee, loyalty_discount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [resolvedCustomerId, resolvedDealerId || null, req.user.user_id, order_number, resolvedCustomerType, sales_channel, resolvedPlatform, resolvedPaymentMethod, payment_status, Boolean(payment_confirmed),
       invoice_number, invoice_status, shipping_address, city, total_amount, shipping_fee, loyalty_discount, note]
    );
    const order_id = orderResult.insertId;

    // 5. Insert order_items — DB trigger handles stock deduction + stock_transactions
    for (const li of lineItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [order_id, li.product_id, li.quantity, li.unit_price, li.subtotal]
      );
    }

    if (resolvedCustomerType === 'dealer') {
      await conn.query(
        `INSERT INTO debt_transactions (dealer_id, user_id, transaction_type, amount, note)
         VALUES (?, ?, 'Invoice', ?, ?)`,
        [resolvedDealerId, req.user.user_id, total_amount, `Order ${order_number}`]
      );
    }

    await conn.commit();
    conn.release();

    const [rows] = await pool.query(
      `SELECT o.*, COALESCE(d.dealer_name, c.full_name) AS customer_name
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN dealers d ON d.dealer_id = o.dealer_id
       WHERE o.order_id = ?`,
      [order_id]
    );

    return R.created(res, { ...rows[0], items: lineItems }, 'Order created successfully.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    // Surface trigger errors (out-of-stock signal)
    if (err.sqlState === '45000') return R.badRequest(res, err.sqlMessage);
    return R.serverError(res, err);
  }
}

// ─── UPDATE DELIVERY STATUS ───────────────────────────────────
async function updateDeliveryStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const { delivery_status } = req.body;

  try {
    const [rows] = await pool.query('SELECT order_id, delivery_status, sales_channel FROM orders WHERE order_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Order not found.');

    const current = rows[0].delivery_status;
    const salesChannel = rows[0].sales_channel;

    if (current === CANCELLED_STATUS) {
      return R.badRequest(res, 'Cannot update a cancelled order.');
    }

    const allowedByCurrent = {
      Pending: new Set(['Processing', CANCELLED_STATUS]),
      Confirmed: new Set(['Processing', CANCELLED_STATUS]),
      Processing: new Set([salesChannel === 'in_store' ? DELIVERED_STATUS : SHIPPED_STATUS, CANCELLED_STATUS]),
      [SHIPPED_STATUS]: new Set([DELIVERED_STATUS]),
      [DELIVERED_STATUS]: new Set([]),  // FIX 8: No further transitions - returns handled separately
    };
    const allowedNext = allowedByCurrent[current] || new Set();
    if (!allowedNext.has(delivery_status)) {
      return R.badRequest(res, `Invalid fulfillment transition from ${current} to ${delivery_status}.`);
    }

    await pool.query(
      'UPDATE orders SET delivery_status = ?, updated_at = NOW() WHERE order_id = ?',
      [delivery_status, req.params.id]
    );
    // trg_loyalty_accrual fires automatically on Delivered
    // trg_audit_order_delivery_status fires automatically

    const [updated] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id]);
    return R.ok(res, updated[0], 'Delivery status updated.');
  } catch (err) {
    return R.serverError(res, err);
  }
}

// ─── UPDATE PAYMENT STATUS ────────────────────────────────────
async function updatePaymentStatus(req, res) {
  return R.badRequest(res, 'Payment status is derived from payment method and cannot be edited directly.');
}

// ─── UPDATE ORDER ─────────────────────────────────────────────
async function update(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return R.badRequest(res, 'Validation failed', errors.array());

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [req.params.id]);
    if (!orderRows.length) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Order not found.');
    }

    const order = orderRows[0];
    const mode = getEditableOrderMode(order.delivery_status);
    const ageDays = getOrderAgeInDays(order.ordered_at);
    const isAdminOverride = ['admin', 'manager'].includes(req.user?.role);

    if (mode === 'closed') {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Closed or cancelled orders cannot be edited.');
    }

    if (mode === 'processing_locked' || mode === 'shipping_locked') {
      if (customer_id !== undefined || payment_method !== undefined || items !== undefined) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, 'Orders cannot be modified after Processing starts. Only tracking info and notes allowed.');
      }
    }

    if (ageDays > ORDER_EDIT_LOCK_DAYS && !isAdminOverride) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, `Orders older than ${ORDER_EDIT_LOCK_DAYS} days require admin override.`);
    }

    const {
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      city,
      payment_method,
      payment_confirmed,
      note,
      items,
      tracking_code,
      shipping_carrier,
    } = req.body;

    const updateData = {};
    const auditChanges = [];
    let lineItems = null;

    if (mode === 'processing_locked' || mode === 'shipping_locked') {
      // FIX 3: Lock order after Processing — only tracking & notes allowed
      if (tracking_code !== undefined) {
        updateData.tracking_code = tracking_code;
        auditChanges.push({ field: 'tracking_code', from: order.tracking_code, to: tracking_code });
      }

      if (shipping_carrier !== undefined) {
        updateData.shipping_carrier = shipping_carrier;
        auditChanges.push({ field: 'shipping_carrier', from: order.shipping_carrier, to: shipping_carrier });
      }

      if (note !== undefined) {
        updateData.note = note;
        auditChanges.push({ field: 'note', from: order.note, to: note });
      }

      if (!Object.keys(updateData).length) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, 'No editable fields were provided.');
      }

      const setClauses = [];
      const setValues = [];
      for (const [key, value] of Object.entries(updateData)) {
        setClauses.push(`${key} = ?`);
        setValues.push(value);
      }
      setValues.push(order.order_id);

      await conn.query(
        `UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE order_id = ?`,
        setValues
      );

      if (auditChanges.length) {
        await logOrderAudit(conn, {
          userId: req.user.user_id,
          action: `Order updated (locked): ${order.order_number}`,
          riskLevel: 'Low',
          details: buildOrderChangeDetails(order.order_id, auditChanges),
        });
      }

      await conn.commit();
      conn.release();

      const [updatedOrderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.order_id]);
      return R.ok(res, updatedOrderRows[0], 'Order tracking info updated (order is locked from further edits).');
    }

    if (mode === 'pre_shipping') {
      if (customer_id !== undefined) {
        const resolvedCustomerId = Number(customer_id);
        const [[customer]] = await conn.query('SELECT customer_id FROM customers WHERE customer_id = ?', [resolvedCustomerId]);
        if (!customer) {
          await conn.rollback();
          conn.release();
          return R.notFound(res, 'Customer not found.');
        }
        updateData.customer_id = resolvedCustomerId;
        auditChanges.push({ field: 'customer_id', from: order.customer_id, to: resolvedCustomerId });
      }

      if (customer_name !== undefined || customer_email !== undefined || customer_phone !== undefined) {
        const customerUpdates = [];
        const customerParams = [];
        if (customer_name !== undefined) { customerUpdates.push('full_name = ?'); customerParams.push(customer_name || 'Guest Customer'); }
        if (customer_email !== undefined) { customerUpdates.push('email = ?'); customerParams.push(customer_email || `order-${order.order_id}@guest.local`); }
        if (customer_phone !== undefined) { customerUpdates.push('phone_number = ?'); customerParams.push(customer_phone || null); }
        if (customerUpdates.length) {
          customerParams.push(order.customer_id);
          await conn.query(`UPDATE customers SET ${customerUpdates.join(', ')} WHERE customer_id = ?`, customerParams);
          auditChanges.push({ field: 'customer_profile', from: 'updated', to: 'updated' });
        }
      }

      if (shipping_address !== undefined) {
        updateData.shipping_address = shipping_address;
        auditChanges.push({ field: 'shipping_address', from: order.shipping_address, to: shipping_address });
      }

      if (city !== undefined) {
        updateData.city = city;
        auditChanges.push({ field: 'city', from: order.city, to: city });
      }

      if (payment_method !== undefined) {
        const allowedMethods = PAYMENT_METHODS_BY_CHANNEL[order.sales_channel] || [];
        const resolvedMethod = order.sales_channel === 'marketplace' ? 'Handled_by_Platform' : payment_method;
        if (!allowedMethods.includes(resolvedMethod)) {
          await conn.rollback();
          conn.release();
          return R.badRequest(res, `Payment method "${resolvedMethod}" is not allowed for ${order.sales_channel} orders.`);
        }
        const resolvedPaymentConfirmed = payment_confirmed !== undefined ? Boolean(payment_confirmed) : Boolean(order.payment_confirmed);
        updateData.payment_method = resolvedMethod;
        updateData.payment_confirmed = resolvedPaymentConfirmed;
        updateData.payment_status = derivePaymentStatus(resolvedMethod, order.sales_channel, order.customer_type, resolvedPaymentConfirmed);
        auditChanges.push({ field: 'payment_method', from: order.payment_method, to: resolvedMethod });
        auditChanges.push({ field: 'payment_status', from: order.payment_status, to: updateData.payment_status });
      }

      if (note !== undefined) {
        updateData.note = note;
        auditChanges.push({ field: 'note', from: order.note, to: note });
      }

      if (tracking_code !== undefined || shipping_carrier !== undefined) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, 'Tracking fields can only be updated after shipping starts.');
      }

      if (items !== undefined) {
        if (!Array.isArray(items) || !items.length) {
          await conn.rollback();
          conn.release();
          return R.badRequest(res, 'At least one item is required.');
        }

        const [previousItems] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
        await conn.query('DELETE FROM order_items WHERE order_id = ?', [order.order_id]);

        const productIds = items.map((item) => item.product_id);
        const [products] = await conn.query(
          'SELECT product_id, selling_price, stock_quantity, status FROM products WHERE product_id IN (?)',
          [productIds]
        );
        const productMap = Object.fromEntries(products.map((product) => [product.product_id, product]));

        const rebuiltItems = [];
        let subtotalSum = 0;
        for (const item of items) {
          const prod = productMap[item.product_id];
          if (!prod) {
            await conn.rollback();
            conn.release();
            return R.badRequest(res, `Product ${item.product_id} not found.`);
          }
          if (prod.status === 'Discontinued') {
            await conn.rollback();
            conn.release();
            return R.badRequest(res, `Product ${item.product_id} is discontinued.`);
          }
          if (prod.stock_quantity < item.quantity) {
            await conn.rollback();
            conn.release();
            return R.badRequest(res, `Insufficient stock for product ${item.product_id}. Available: ${prod.stock_quantity}.`);
          }

          const unit_price = item.unit_price || prod.selling_price;
          const subtotal = parseFloat((unit_price * item.quantity).toFixed(2));
          subtotalSum += subtotal;
          rebuiltItems.push({ product_id: item.product_id, quantity: item.quantity, unit_price, subtotal });
        }

        for (const rebuilt of rebuiltItems) {
          await conn.query(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
            [order.order_id, rebuilt.product_id, rebuilt.quantity, rebuilt.unit_price, rebuilt.subtotal]
          );
        }

        updateData.total_amount = parseFloat((subtotalSum + Number(order.shipping_fee) - Number(order.loyalty_discount)).toFixed(2));
        lineItems = rebuiltItems;
        auditChanges.push({ field: 'items', from: previousItems.length, to: rebuiltItems.length });

        if (order.customer_type === 'dealer' && order.dealer_id) {
          const delta = parseFloat((updateData.total_amount - Number(order.total_amount)).toFixed(2));
          if (delta !== 0) {
            await conn.query('UPDATE dealers SET total_revenue = total_revenue + ?, updated_at = NOW() WHERE dealer_id = ?', [delta, order.dealer_id]);
            await conn.query(
              `INSERT INTO debt_transactions (dealer_id, user_id, transaction_type, amount, note)
               VALUES (?, ?, ?, ?, ?)`,
              [order.dealer_id, req.user.user_id, delta > 0 ? 'Adjustment' : 'Payment Received', Math.abs(delta), `Order ${order.order_number} edited`]
            );
          }
        }
      }
    } else if (mode === 'shipped') {
      if (payment_method !== undefined || payment_confirmed !== undefined || customer_id !== undefined || customer_name !== undefined || customer_email !== undefined || customer_phone !== undefined || shipping_address !== undefined || city !== undefined || items !== undefined) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, 'Shipped orders only allow tracking updates and notes.');
      }

      if (tracking_code !== undefined) {
        updateData.tracking_code = tracking_code;
        auditChanges.push({ field: 'tracking_code', from: order.tracking_code, to: tracking_code });
      }

      if (shipping_carrier !== undefined) {
        updateData.shipping_carrier = shipping_carrier;
        auditChanges.push({ field: 'shipping_carrier', from: order.shipping_carrier, to: shipping_carrier });
      }

      if (note !== undefined) {
        updateData.note = note;
        auditChanges.push({ field: 'note', from: order.note, to: note });
      }
    } else if (mode === 'delivered') {
      if (payment_method !== undefined || payment_confirmed !== undefined || customer_id !== undefined || customer_name !== undefined || customer_email !== undefined || customer_phone !== undefined || shipping_address !== undefined || city !== undefined || items !== undefined || tracking_code !== undefined || shipping_carrier !== undefined) {
        await conn.rollback();
        conn.release();
        return R.badRequest(res, 'Delivered orders are locked except for internal notes.');
      }

      if (note !== undefined) {
        updateData.note = note;
        auditChanges.push({ field: 'note', from: order.note, to: note });
      }
    }

    if (!Object.keys(updateData).length) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'No editable fields were provided.');
    }

    const setClauses = [];
    const setValues = [];
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = ?`);
      setValues.push(value);
    }
    setValues.push(order.order_id);

    await conn.query(
      `UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE order_id = ?`,
      setValues
    );

    if (auditChanges.length) {
      await logOrderAudit(conn, {
        userId: req.user.user_id,
        action: `Order updated: ${order.order_number}`,
        riskLevel: mode === 'delivered' ? 'Medium' : 'Normal',
        details: buildOrderChangeDetails(order.order_id, auditChanges),
      });
    }

    await conn.commit();
    conn.release();

    const [updatedOrderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.order_id]);
    const [updatedItems] = await pool.query(
      `SELECT oi.*, p.product_name, p.sku
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [order.order_id]
    );

    return R.ok(res, { ...updatedOrderRows[0], items: updatedItems.length ? updatedItems : lineItems || [] }, 'Order updated.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── CANCEL / DELETE ORDER ───────────────────────────────────
async function remove(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [req.params.id]);
    if (!orderRows.length) {
      await conn.rollback();
      conn.release();
      return R.notFound(res, 'Order not found.');
    }

    const order = orderRows[0];
    if (!PRE_SHIPPING_STATUSES.has(order.delivery_status)) {
      await conn.rollback();
      conn.release();
      return R.badRequest(res, 'Orders can only be cancelled or deleted before shipping starts.');
    }

    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
    if (items.length) {
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [order.order_id]);
    }

    if (order.customer_type === 'dealer' && order.dealer_id) {
      await conn.query('UPDATE dealers SET total_revenue = total_revenue - ?, updated_at = NOW() WHERE dealer_id = ?', [order.total_amount, order.dealer_id]);
      await conn.query(
        `INSERT INTO debt_transactions (dealer_id, user_id, transaction_type, amount, note)
         VALUES (?, ?, 'Payment Received', ?, ?)`,
        [order.dealer_id, req.user.user_id, order.total_amount, `Order ${order.order_number} cancelled/deleted`]
      );
    }

    if (order.delivery_status === 'Pending') {
      await logOrderAudit(conn, {
        userId: req.user.user_id,
        action: `Order deleted: ${order.order_number}`,
        riskLevel: 'High',
        details: buildOrderChangeDetails(order.order_id, [{ field: 'deleted', from: 'active', to: 'removed' }]),
      });
      await conn.query('DELETE FROM orders WHERE order_id = ?', [order.order_id]);
      await conn.commit();
      conn.release();
      return R.ok(res, null, 'Order deleted.');
    }

    await conn.query(
      'UPDATE orders SET delivery_status = ?, updated_at = NOW() WHERE order_id = ?',
      [CANCELLED_STATUS, order.order_id]
    );

    await logOrderAudit(conn, {
      userId: req.user.user_id,
      action: `Order cancelled: ${order.order_number}`,
      riskLevel: 'Medium',
      details: buildOrderChangeDetails(order.order_id, [{ field: 'delivery_status', from: order.delivery_status, to: CANCELLED_STATUS }]),
    });

    await conn.commit();
    conn.release();
    const [updated] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [order.order_id]);
    return R.ok(res, updated[0], 'Order cancelled.');
  } catch (err) {
    await conn.rollback();
    conn.release();
    return R.serverError(res, err);
  }
}

// ─── GET ITEMS ────────────────────────────────────────────────
async function getItems(req, res) {
  try {
    const [rows] = await pool.query('SELECT order_id FROM orders WHERE order_id = ?', [req.params.id]);
    if (!rows.length) return R.notFound(res, 'Order not found.');

    const [items] = await pool.query(
      `SELECT oi.*, p.product_name, p.sku, p.selling_price AS current_price
       FROM order_items oi JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );
    return R.ok(res, items);
  } catch (err) {
    return R.serverError(res, err);
  }
}

module.exports = { list, getOne, create, update, remove, updateDeliveryStatus, updatePaymentStatus, getItems };
