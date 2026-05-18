-- ============================================================
--  COCOON VIETNAM — SALES MANAGEMENT SYSTEM
--  MySQL 8.0+ DDL + Triggers
--  Converted from SQL Server  |  Version: 1.0  |  Date: 2026-05-16
-- ============================================================
--  TABLE ORDER (dependency-safe):
--    1. categories
--    2. users
--    3. customers
--    4. products
--    5. raw_materials
--    6. promotions
--    7. dealers
--    8. orders
--    9. order_items
--   10. loyalty_transactions
--   11. stock_transactions
--   12. debt_transactions
--   13. audit_logs
-- ============================================================

CREATE DATABASE IF NOT EXISTS CocoonSMS
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
 
USE CocoonSMS;

-- ============================================================
-- 1. CATEGORIES
-- ============================================================
CREATE TABLE categories (
    category_id     INT             NOT NULL    AUTO_INCREMENT,
    category_name   VARCHAR(100)    NOT NULL,
    description     TEXT                NULL,

    CONSTRAINT PK_categories PRIMARY KEY (category_id),
    CONSTRAINT UQ_categories_name UNIQUE (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE users (
    user_id         INT             NOT NULL    AUTO_INCREMENT,
    full_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(100)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL,
    status          VARCHAR(20)     NOT NULL    DEFAULT 'active',
    office          VARCHAR(100)        NULL,
    last_login_at   DATETIME            NULL,
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT PK_users         PRIMARY KEY (user_id),
    CONSTRAINT UQ_users_email   UNIQUE (email),
    CONSTRAINT CK_users_role    CHECK (role   IN ('sales','warehouse','finance','manager','admin')),
    CONSTRAINT CK_users_status  CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
CREATE TABLE customers (
    customer_id             INT             NOT NULL    AUTO_INCREMENT,
    full_name               VARCHAR(100)    NOT NULL,
    email                   VARCHAR(100)    NOT NULL,
    phone_number            VARCHAR(20)         NULL,
<<<<<<< HEAD
    customer_type           VARCHAR(20)     NOT NULL    DEFAULT 'retail',
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    gender                  VARCHAR(10)         NULL,
    date_of_birth           DATE                NULL,
    address                 TEXT                NULL,
    city                    VARCHAR(100)        NULL,
    segment                 VARCHAR(30)     NOT NULL    DEFAULT 'New',
    loyalty_points_balance  INT             NOT NULL    DEFAULT 0,
    created_at              DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT PK_customers             PRIMARY KEY (customer_id),
    CONSTRAINT UQ_customers_email       UNIQUE (email),
<<<<<<< HEAD
    CONSTRAINT CK_customers_type        CHECK (customer_type IN ('retail','dealer','guest','marketplace')),
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    CONSTRAINT CK_customers_segment     CHECK (segment IN ('New','Loyal','VIP','Whale','At-risk','Wholesale')),
    CONSTRAINT CK_customers_loyalty_pts CHECK (loyalty_points_balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 4. PRODUCTS
-- ============================================================
CREATE TABLE products (
    product_id      INT             NOT NULL    AUTO_INCREMENT,
    category_id     INT             NOT NULL,
    product_name    VARCHAR(150)    NOT NULL,
    sku             VARCHAR(50)     NOT NULL,
    cost_price      DECIMAL(12,2)   NOT NULL    DEFAULT 0,
    selling_price   DECIMAL(12,2)   NOT NULL,
    stock_quantity  INT             NOT NULL    DEFAULT 0,
    sold_count      INT             NOT NULL    DEFAULT 0,
    description     TEXT                NULL,
    status          VARCHAR(20)     NOT NULL    DEFAULT 'Available',
    visibility      VARCHAR(20)     NOT NULL    DEFAULT 'Visible',
    ingredients     TEXT                NULL,
    tags            TEXT                NULL,
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT PK_products          PRIMARY KEY (product_id),
    CONSTRAINT UQ_products_sku      UNIQUE (sku),
    CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
    CONSTRAINT CK_products_cost     CHECK (cost_price      >= 0),
    CONSTRAINT CK_products_price    CHECK (selling_price   >  0),
    CONSTRAINT CK_products_stock    CHECK (stock_quantity  >= 0),
    CONSTRAINT CK_products_sold     CHECK (sold_count      >= 0),
    CONSTRAINT CK_products_status   CHECK (status     IN ('Available','Out of Stock','Discontinued')),
    CONSTRAINT CK_products_visibility CHECK (visibility IN ('Visible','Hidden'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 5. RAW MATERIALS
-- ============================================================
CREATE TABLE raw_materials (
    material_id     INT             NOT NULL    AUTO_INCREMENT,
    material_name   VARCHAR(150)    NOT NULL,
    origin          VARCHAR(150)    NOT NULL,
    supplier_name   VARCHAR(150)    NOT NULL,
    quantity        DECIMAL(12,3)   NOT NULL    DEFAULT 0,
    unit            VARCHAR(20)     NOT NULL    DEFAULT 'kg',
    status          VARCHAR(20)     NOT NULL    DEFAULT 'Stable',
    import_date     DATE                NULL,
    expiry_date     DATE                NULL,
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT PK_raw_materials         PRIMARY KEY (material_id),
    CONSTRAINT CK_raw_materials_qty     CHECK (quantity >= 0),
    CONSTRAINT CK_raw_materials_status  CHECK (status IN ('Stable','Warning','Critical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 6. PROMOTIONS
-- ============================================================
CREATE TABLE promotions (
    promotion_id    INT             NOT NULL    AUTO_INCREMENT,
    promotion_name  VARCHAR(150)    NOT NULL,
    discount_rate   DECIMAL(10,2)    NOT NULL    DEFAULT 0,
    promo_type      VARCHAR(30)     NOT NULL    DEFAULT 'percentage',
    start_date      DATE            NOT NULL,
    end_date        DATE            NOT NULL,
    status          VARCHAR(20)     NOT NULL    DEFAULT 'Active',

    CONSTRAINT PK_promotions            PRIMARY KEY (promotion_id),
    -- CONSTRAINT CK_promotions_discount   CHECK (discount_rate BETWEEN 0 AND 100),
    CONSTRAINT CK_promotions_dates      CHECK (end_date >= start_date),
    CONSTRAINT CK_promotions_type       CHECK (promo_type IN ('percentage','fixed')),
    CONSTRAINT CK_promotions_status     CHECK (status IN ('Active','Inactive','Expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 7. DEALERS
-- ============================================================
CREATE TABLE dealers (
    dealer_id       INT             NOT NULL    AUTO_INCREMENT,
    dealer_name     VARCHAR(150)    NOT NULL,
    region          VARCHAR(100)        NULL,
    city            VARCHAR(100)        NULL,
    contact_person  VARCHAR(100)        NULL,
    phone_number    VARCHAR(20)         NULL,
    email           VARCHAR(100)        NULL,
<<<<<<< HEAD
    wholesale_tier  VARCHAR(30)     NOT NULL    DEFAULT 'Tier 1',
    payment_terms   VARCHAR(50)     NOT NULL    DEFAULT 'Net 30',
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    total_revenue   DECIMAL(18,2)   NOT NULL    DEFAULT 0,
    debt_amount     DECIMAL(18,2)   NOT NULL    DEFAULT 0,
    credit_limit    DECIMAL(18,2)   NOT NULL    DEFAULT 0,
    debt_status     VARCHAR(20)     NOT NULL    DEFAULT 'Stable',
    partner_status  VARCHAR(20)     NOT NULL    DEFAULT 'Active',
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT PK_dealers               PRIMARY KEY (dealer_id),
    CONSTRAINT CK_dealers_revenue       CHECK (total_revenue  >= 0),
    CONSTRAINT CK_dealers_debt          CHECK (debt_amount    >= 0),
    CONSTRAINT CK_dealers_credit        CHECK (credit_limit   >= 0),
    CONSTRAINT CK_dealers_debt_status   CHECK (debt_status    IN ('Stable','Warning','Overdue')),
<<<<<<< HEAD
    CONSTRAINT CK_dealers_tier          CHECK (wholesale_tier IS NOT NULL),
    CONSTRAINT CK_dealers_terms         CHECK (payment_terms IS NOT NULL),
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    CONSTRAINT CK_dealers_partner_status CHECK (partner_status IN ('Active','Inactive','Suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 8. ORDERS
-- ============================================================
CREATE TABLE orders (
    order_id            INT             NOT NULL    AUTO_INCREMENT,
    customer_id         INT             NOT NULL,
<<<<<<< HEAD
    dealer_id           INT                 NULL,
    user_id             INT                 NULL,
    order_number        VARCHAR(30)     NOT NULL,
    customer_type       VARCHAR(20)     NOT NULL    DEFAULT 'retail',
    sales_channel       VARCHAR(20)     NOT NULL    DEFAULT 'online',
    platform            VARCHAR(20)     NOT NULL    DEFAULT 'website',
    delivery_status     VARCHAR(20)     NOT NULL    DEFAULT 'Pending',
    payment_status      VARCHAR(30)     NOT NULL    DEFAULT 'Unpaid',
    payment_method      VARCHAR(50)         NULL,
    payment_confirmed   BOOLEAN         NOT NULL    DEFAULT FALSE,
    invoice_number      VARCHAR(50)         NULL,
    invoice_status      VARCHAR(20)     NOT NULL    DEFAULT 'Not Generated',
=======
    user_id             INT                 NULL,
    order_number        VARCHAR(30)     NOT NULL,
    sales_channel       VARCHAR(50)     NOT NULL    DEFAULT 'Website',
    delivery_status     VARCHAR(20)     NOT NULL    DEFAULT 'Pending',
    payment_status      VARCHAR(20)     NOT NULL    DEFAULT 'Unpaid',
    payment_method      VARCHAR(30)         NULL,
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    shipping_carrier    VARCHAR(50)         NULL,
    tracking_code       VARCHAR(100)        NULL,
    shipping_address    TEXT                NULL,
    city                VARCHAR(100)        NULL,
    total_amount        DECIMAL(12,2)   NOT NULL    DEFAULT 0,
    shipping_fee        DECIMAL(12,2)   NOT NULL    DEFAULT 0,
    loyalty_discount    DECIMAL(12,2)   NOT NULL    DEFAULT 0,
    note                TEXT                NULL,
    ordered_at          DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT PK_orders                PRIMARY KEY (order_id),
    CONSTRAINT UQ_orders_number         UNIQUE (order_number),
    CONSTRAINT FK_orders_customer       FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
<<<<<<< HEAD
    CONSTRAINT FK_orders_dealer         FOREIGN KEY (dealer_id)   REFERENCES dealers (dealer_id),
    CONSTRAINT FK_orders_user           FOREIGN KEY (user_id)     REFERENCES users (user_id),
    CONSTRAINT CK_orders_customer_type  CHECK (customer_type IN ('retail','dealer','guest','marketplace')),
    CONSTRAINT CK_orders_channel        CHECK (sales_channel   IN ('in_store','online','marketplace','dealer')),
    CONSTRAINT CK_orders_platform       CHECK (platform        IN ('website','shopee','tiktok','lazada','physical_store','dealer_portal')),
    CONSTRAINT CK_orders_delivery       CHECK (delivery_status IN ('Pending','Confirmed','Processing','Shipping','Delivered','Cancelled')),
    CONSTRAINT CK_orders_payment_status CHECK (payment_status  IN ('Paid','Unpaid','Pending','Credit','Handled_by_Platform','Refunded')),
    CONSTRAINT CK_orders_payment_method CHECK (payment_method  IN ('Cash','Card','COD','Bank Transfer','Momo','VNPay','Invoice','Credit Terms','Handled_by_Platform') OR payment_method IS NULL),
    CONSTRAINT CK_orders_invoice_status CHECK (invoice_status  IN ('Not Generated','Generated','Issued','Paid','Void')),
=======
    CONSTRAINT FK_orders_user           FOREIGN KEY (user_id)     REFERENCES users (user_id),
    CONSTRAINT CK_orders_channel        CHECK (sales_channel   IN ('Website','Shopee','TikTok Shop','Lazada','In-store')),
    CONSTRAINT CK_orders_delivery       CHECK (delivery_status IN ('Pending','Confirmed','Processing','Shipping','Delivered','Cancelled','Returned')),
    CONSTRAINT CK_orders_payment_status CHECK (payment_status  IN ('Unpaid','Paid','Refunded')),
    CONSTRAINT CK_orders_payment_method CHECK (payment_method  IN ('COD','Momo','VNPay','Bank Transfer','Card') OR payment_method IS NULL),
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    CONSTRAINT CK_orders_total          CHECK (total_amount     >= 0),
    CONSTRAINT CK_orders_shipping_fee   CHECK (shipping_fee     >= 0),
    CONSTRAINT CK_orders_loyalty_disc   CHECK (loyalty_discount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 9. ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
    order_item_id   INT             NOT NULL    AUTO_INCREMENT,
    order_id        INT             NOT NULL,
    product_id      INT             NOT NULL,
    quantity        INT             NOT NULL,
    unit_price      DECIMAL(12,2)   NOT NULL,
    subtotal        DECIMAL(12,2)   NOT NULL,

    CONSTRAINT PK_order_items           PRIMARY KEY (order_item_id),
    CONSTRAINT FK_order_items_order     FOREIGN KEY (order_id)   REFERENCES orders (order_id)   ON DELETE CASCADE,
    CONSTRAINT FK_order_items_product   FOREIGN KEY (product_id) REFERENCES products (product_id),
    CONSTRAINT CK_order_items_qty       CHECK (quantity   > 0),
    CONSTRAINT CK_order_items_price     CHECK (unit_price > 0),
    CONSTRAINT CK_order_items_subtotal  CHECK (subtotal   > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 10. LOYALTY TRANSACTIONS
-- ============================================================
CREATE TABLE loyalty_transactions (
    transaction_id  INT             NOT NULL    AUTO_INCREMENT,
    customer_id     INT             NOT NULL,
    order_id        INT                 NULL,
    action_type     VARCHAR(30)     NOT NULL,
    points_amount   INT             NOT NULL,
    description     VARCHAR(200)        NULL,
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT PK_loyalty_transactions      PRIMARY KEY (transaction_id),
    CONSTRAINT FK_loyalty_customer          FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
    CONSTRAINT FK_loyalty_order             FOREIGN KEY (order_id)    REFERENCES orders (order_id),
    CONSTRAINT CK_loyalty_action_type       CHECK (action_type IN ('earn','redeem')),
    CONSTRAINT CK_loyalty_earn_positive     CHECK (NOT (action_type = 'earn'   AND points_amount <= 0)),
    CONSTRAINT CK_loyalty_redeem_negative   CHECK (NOT (action_type = 'redeem' AND points_amount >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 11. STOCK TRANSACTIONS
-- ============================================================
CREATE TABLE stock_transactions (
    stock_tx_id         INT             NOT NULL    AUTO_INCREMENT,
    product_id          INT             NOT NULL,
    user_id             INT             NOT NULL,
    transaction_type    VARCHAR(20)     NOT NULL,
    quantity            INT             NOT NULL,
    warehouse           VARCHAR(100)    NOT NULL    DEFAULT 'HCM Warehouse',
    reference_id        VARCHAR(50)         NULL,
    note                VARCHAR(255)        NULL,
    created_at          DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT PK_stock_transactions    PRIMARY KEY (stock_tx_id),
    CONSTRAINT FK_stock_tx_product      FOREIGN KEY (product_id) REFERENCES products (product_id),
    CONSTRAINT FK_stock_tx_user         FOREIGN KEY (user_id)    REFERENCES users (user_id),
    CONSTRAINT CK_stock_tx_type         CHECK (transaction_type IN ('Stock In','Stock Out','Transfer','Production','Returns','Adjustment')),
    CONSTRAINT CK_stock_tx_qty          CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 12. DEBT TRANSACTIONS
-- ============================================================
CREATE TABLE debt_transactions (
    debt_id             INT             NOT NULL    AUTO_INCREMENT,
    dealer_id           INT             NOT NULL,
    user_id             INT             NOT NULL,
    transaction_type    VARCHAR(30)     NOT NULL,
    amount              DECIMAL(18,2)   NOT NULL,
    status              VARCHAR(20)     NOT NULL    DEFAULT 'Completed',
    note                VARCHAR(255)        NULL,
    created_at          DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT PK_debt_transactions     PRIMARY KEY (debt_id),
    CONSTRAINT FK_debt_tx_dealer        FOREIGN KEY (dealer_id) REFERENCES dealers (dealer_id),
    CONSTRAINT FK_debt_tx_user          FOREIGN KEY (user_id)   REFERENCES users (user_id),
    CONSTRAINT CK_debt_tx_type          CHECK (transaction_type IN ('Invoice','Payment Received','Credit Approved','Adjustment','Refund')),
    CONSTRAINT CK_debt_tx_amount        CHECK (amount > 0),
    CONSTRAINT CK_debt_tx_status        CHECK (status IN ('Completed','Pending','Cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 13. AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
    log_id          INT             NOT NULL    AUTO_INCREMENT,
    user_id         INT                 NULL,
    action          VARCHAR(100)    NOT NULL,
    module          VARCHAR(30)     NOT NULL,
    risk_level      VARCHAR(20)     NOT NULL    DEFAULT 'Normal',
    details         TEXT                NULL,
    ip_address      VARCHAR(45)         NULL,
    created_at      DATETIME        NOT NULL    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT PK_audit_logs        PRIMARY KEY (log_id),
    CONSTRAINT FK_audit_logs_user   FOREIGN KEY (user_id) REFERENCES users (user_id),
    CONSTRAINT CK_audit_module      CHECK (module     IN ('Orders','Inventory','Finance','Security','Users','Dealers','System')),
    CONSTRAINT CK_audit_risk_level  CHECK (risk_level IN ('Normal','Medium','High','Critical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX IX_orders_customer        ON orders (customer_id);
<<<<<<< HEAD
CREATE INDEX IX_orders_dealer          ON orders (dealer_id);
CREATE INDEX IX_orders_customer_type   ON orders (customer_type);
CREATE INDEX IX_orders_platform        ON orders (platform);
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
CREATE INDEX IX_orders_delivery_status ON orders (delivery_status);
CREATE INDEX IX_orders_channel         ON orders (sales_channel);
CREATE INDEX IX_orders_ordered_at      ON orders (ordered_at DESC);

CREATE INDEX IX_order_items_order      ON order_items (order_id);
CREATE INDEX IX_order_items_product    ON order_items (product_id);

CREATE INDEX IX_products_sku           ON products (sku);
CREATE INDEX IX_products_category      ON products (category_id);
CREATE INDEX IX_products_status        ON products (status);

CREATE INDEX IX_loyalty_customer       ON loyalty_transactions (customer_id);
CREATE INDEX IX_loyalty_order          ON loyalty_transactions (order_id);

CREATE INDEX IX_stock_product          ON stock_transactions (product_id);
CREATE INDEX IX_stock_created          ON stock_transactions (created_at DESC);

CREATE INDEX IX_dealers_debt_status    ON dealers (debt_status);

CREATE INDEX IX_debt_dealer            ON debt_transactions (dealer_id);

CREATE INDEX IX_audit_user             ON audit_logs (user_id);
CREATE INDEX IX_audit_module           ON audit_logs (module);
CREATE INDEX IX_audit_risk             ON audit_logs (risk_level);
CREATE INDEX IX_audit_created          ON audit_logs (created_at DESC);


-- ============================================================
--  TRIGGERS
--  NOTE: MySQL does not support multi-row SET from a virtual
--  "inserted/deleted" table. Each trigger uses a row-level
--  FOR EACH ROW approach. SIGNAL SQLSTATE replaces RAISERROR.
-- ============================================================

DELIMITER $$


-- ============================================================
--  TRIGGER 1: trg_inventory_deduction
--  Fires BEFORE INSERT on order_items (MySQL requires BEFORE
--  to SIGNAL and abort before any row is written).
--  Deducts stock_quantity and increments sold_count.
-- ============================================================
CREATE TRIGGER trg_inventory_deduction
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    DECLARE v_stock     INT;
    DECLARE v_user_id   INT;
    DECLARE v_order_num VARCHAR(30);

    -- Check available stock
    SELECT stock_quantity INTO v_stock
    FROM products
    WHERE product_id = NEW.product_id;

    IF v_stock - NEW.quantity < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'OUT_OF_STOCK: One or more products do not have sufficient stock to fulfil this order.';
    END IF;

    -- Deduct stock and update sold_count / status
    UPDATE products
    SET
        stock_quantity = stock_quantity - NEW.quantity,
        sold_count     = sold_count     + NEW.quantity,
        status         = CASE
                             WHEN stock_quantity - NEW.quantity = 0 THEN 'Out of Stock'
                             ELSE status
                         END,
        updated_at     = NOW()
    WHERE product_id = NEW.product_id;

    -- Resolve user_id and order_number from parent order
    SELECT user_id, order_number
    INTO   v_user_id, v_order_num
    FROM   orders
    WHERE  order_id = NEW.order_id;

    -- Log stock movement
    INSERT INTO stock_transactions
        (product_id, user_id, transaction_type, quantity, warehouse, reference_id, note)
    VALUES (
        NEW.product_id,
        COALESCE(v_user_id, 1),
        'Stock Out',
        NEW.quantity,
        'HCM Warehouse',
        v_order_num,
        'Auto-deducted on order creation'
    );
END$$


-- ============================================================
<<<<<<< HEAD
--  TRIGGER 1b: trg_inventory_restore
--  Fires AFTER DELETE on order_items.
--  Restores stock when an item is removed from an editable order.
-- ============================================================
CREATE TRIGGER trg_inventory_restore
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    DECLARE v_user_id   INT;
    DECLARE v_order_num VARCHAR(30);

    UPDATE products
    SET
        stock_quantity = stock_quantity + OLD.quantity,
        sold_count     = GREATEST(sold_count - OLD.quantity, 0),
        status         = CASE
                             WHEN stock_quantity + OLD.quantity > 0 THEN 'Available'
                             ELSE status
                         END,
        updated_at     = NOW()
    WHERE product_id = OLD.product_id;

    SELECT user_id, order_number
    INTO   v_user_id, v_order_num
    FROM   orders
    WHERE  order_id = OLD.order_id;

    INSERT INTO stock_transactions
        (product_id, user_id, transaction_type, quantity, warehouse, reference_id, note)
    VALUES (
        OLD.product_id,
        COALESCE(v_user_id, 1),
        'Stock In',
        OLD.quantity,
        'HCM Warehouse',
        v_order_num,
        'Auto-restored on order item removal'
    );
END$$


-- ============================================================
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
--  TRIGGER 2: trg_loyalty_accrual
--  Fires AFTER UPDATE on orders.
--  Awards points when delivery_status transitions to 'Delivered'.
--  Rule: 1 point per 10,000 VND net spend (min 1).
-- ============================================================
CREATE TRIGGER trg_loyalty_accrual
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    DECLARE v_points INT;

    IF NEW.delivery_status = 'Delivered' AND OLD.delivery_status <> 'Delivered' THEN

        -- Calculate points (floor, minimum 1)
        SET v_points = GREATEST(1, FLOOR((NEW.total_amount - NEW.loyalty_discount) * 0.0001));

        -- Record loyalty transaction
        INSERT INTO loyalty_transactions
            (customer_id, order_id, action_type, points_amount, description)
        VALUES (
            NEW.customer_id,
            NEW.order_id,
            'earn',
            v_points,
            CONCAT('Points earned from order ', NEW.order_number)
        );

        -- Update customer balance and auto-upgrade segment
        UPDATE customers
        SET
            loyalty_points_balance = loyalty_points_balance + v_points,
            segment = CASE
                WHEN loyalty_points_balance + v_points >= 10000 THEN 'VIP'
                WHEN loyalty_points_balance + v_points >= 3000  THEN 'Loyal'
                ELSE segment
            END
        WHERE customer_id = NEW.customer_id;

    END IF;
END$$


-- ============================================================
--  TRIGGER 3: trg_loyalty_redemption_guard
--  Fires BEFORE UPDATE on customers.
--  Prevents loyalty_points_balance from going negative.
-- ============================================================
CREATE TRIGGER trg_loyalty_redemption_guard
BEFORE UPDATE ON customers
FOR EACH ROW
BEGIN
    IF NEW.loyalty_points_balance < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'INSUFFICIENT_POINTS: Customer does not have enough loyalty points for this redemption.';
    END IF;
END$$


-- ============================================================
--  TRIGGER 4: trg_audit_order_delivery_status
--  Fires AFTER UPDATE on orders — logs delivery_status changes.
-- ============================================================
CREATE TRIGGER trg_audit_order_delivery_status
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.delivery_status <> OLD.delivery_status THEN
        INSERT INTO audit_logs (user_id, action, module, risk_level, details)
        VALUES (
            NEW.user_id,
            CONCAT('Order status updated: ', OLD.delivery_status, ' → ', NEW.delivery_status),
            'Orders',
            CASE
                WHEN NEW.delivery_status IN ('Cancelled','Returned') THEN 'Medium'
                ELSE 'Normal'
            END,
            CONCAT(
                'order_id=',      NEW.order_id,
                ' | order_number=', NEW.order_number,
                ' | customer_id=',  NEW.customer_id
            )
        );
    END IF;
END$$


-- ============================================================
--  TRIGGER 5: trg_audit_order_payment_status
--  Fires AFTER UPDATE on orders — logs payment_status changes.
--  NOTE: MySQL does not allow two AFTER UPDATE triggers on the
--  same table, so delivery and payment audit are split into
--  separate triggers (trg_audit_order_delivery_status above and
--  this one). Both fire on every UPDATE; each only inserts when
--  its respective column actually changed.
-- ============================================================
CREATE TRIGGER trg_audit_order_payment_status
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NEW.payment_status <> OLD.payment_status THEN
        INSERT INTO audit_logs (user_id, action, module, risk_level, details)
        VALUES (
            NEW.user_id,
            CONCAT('Payment status updated: ', OLD.payment_status, ' → ', NEW.payment_status),
            'Finance',
            CASE
                WHEN NEW.payment_status = 'Refunded' THEN 'High'
                ELSE 'Normal'
            END,
            CONCAT(
                'order_id=', NEW.order_id,
                ' | amount=', NEW.total_amount
            )
        );
    END IF;
END$$


-- ============================================================
--  TRIGGER 6a: trg_audit_user_insert
--  Fires AFTER INSERT on users — logs account creation.
-- ============================================================
CREATE TRIGGER trg_audit_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (
        NEW.user_id,
        'User account created',
        'Users',
        'Normal',
        CONCAT('email=', NEW.email, ' | role=', NEW.role)
    );
END$$


-- ============================================================
--  TRIGGER 6b: trg_audit_user_update
--  Fires AFTER UPDATE on users — logs role/status changes.
-- ============================================================
CREATE TRIGGER trg_audit_user_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.role <> OLD.role OR NEW.status <> OLD.status THEN
        INSERT INTO audit_logs (user_id, action, module, risk_level, details)
        VALUES (
            NEW.user_id,
            CASE
                WHEN NEW.role   <> OLD.role   THEN CONCAT('User role changed: ',   OLD.role,   ' → ', NEW.role)
                WHEN NEW.status <> OLD.status THEN CONCAT('User status changed: ', OLD.status, ' → ', NEW.status)
                ELSE 'User record updated'
            END,
            'Users',
            CASE
                WHEN NEW.role   <> OLD.role        THEN 'High'
                WHEN NEW.status = 'inactive'       THEN 'Medium'
                ELSE 'Normal'
            END,
            CONCAT('user_id=', NEW.user_id, ' | email=', NEW.email)
        );
    END IF;
END$$


-- ============================================================
--  TRIGGER 6c: trg_audit_user_delete
--  Fires AFTER DELETE on users — logs permanent deletion.
-- ============================================================
CREATE TRIGGER trg_audit_user_delete
AFTER DELETE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (
        OLD.user_id,
        'User account permanently deleted',
        'Security',
        'Critical',
        CONCAT('email=', OLD.email, ' | role=', OLD.role)
    );
END$$


-- ============================================================
--  TRIGGER 7: trg_audit_inventory_adjustment
--  Fires AFTER INSERT on stock_transactions.
--  Flags manual adjustments and large movements.
-- ============================================================
CREATE TRIGGER trg_audit_inventory_adjustment
AFTER INSERT ON stock_transactions
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (
        NEW.user_id,
        CONCAT(NEW.transaction_type, ' recorded for product_id=', NEW.product_id),
        'Inventory',
        CASE
            WHEN NEW.transaction_type = 'Adjustment' THEN 'High'
            WHEN NEW.quantity >= 500                 THEN 'Medium'
            ELSE 'Normal'
        END,
        CONCAT(
            'product_id=',  NEW.product_id,
            ' | qty=',      NEW.quantity,
            ' | warehouse=', NEW.warehouse,
            ' | ref=',      COALESCE(NEW.reference_id, 'N/A')
        )
    );
END$$


-- ============================================================
--  TRIGGER 8: trg_dealer_debt_balance
--  Fires AFTER INSERT on debt_transactions.
--  Keeps dealers.debt_amount and dealers.total_revenue in sync.
-- ============================================================
CREATE TRIGGER trg_dealer_debt_balance
AFTER INSERT ON debt_transactions
FOR EACH ROW
BEGIN
    DECLARE v_delta     DECIMAL(18,2);
    DECLARE v_new_debt  DECIMAL(18,2);
    DECLARE v_limit     DECIMAL(18,2);

    -- Determine how this transaction affects the debt balance
    SET v_delta = CASE
        WHEN NEW.transaction_type = 'Invoice'          THEN  NEW.amount
        WHEN NEW.transaction_type = 'Payment Received' THEN -NEW.amount
        WHEN NEW.transaction_type = 'Refund'           THEN  NEW.amount
        WHEN NEW.transaction_type = 'Adjustment'       THEN  NEW.amount
        ELSE 0
    END;

    -- Fetch current debt and credit limit
    SELECT debt_amount + v_delta, credit_limit
    INTO   v_new_debt, v_limit
    FROM   dealers
    WHERE  dealer_id = NEW.dealer_id;

    -- Update dealer record
    UPDATE dealers
    SET
        debt_amount   = v_new_debt,
        total_revenue = total_revenue + CASE WHEN NEW.transaction_type = 'Invoice' THEN NEW.amount ELSE 0 END,
        debt_status   = CASE
                            WHEN v_new_debt > v_limit * 0.9 THEN 'Overdue'
                            WHEN v_new_debt > v_limit * 0.6 THEN 'Warning'
                            ELSE 'Stable'
                        END,
        updated_at    = NOW()
    WHERE dealer_id = NEW.dealer_id;

    -- Audit log
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (
        NEW.user_id,
        CONCAT('Dealer debt transaction: ', NEW.transaction_type),
        'Finance',
        CASE
            WHEN NEW.transaction_type IN ('Adjustment','Refund') THEN 'High'
            WHEN NEW.amount > 100000000                          THEN 'Medium'
            ELSE 'Normal'
        END,
        CONCAT(
            'dealer_id=', NEW.dealer_id,
            ' | type=',   NEW.transaction_type,
            ' | amount=', NEW.amount
        )
    );
END$$


-- ============================================================
--  TRIGGER 9: trg_low_stock_alert
--  Fires AFTER UPDATE on products when stock_quantity changes.
--  Logs Critical/Warning/Medium alert into audit_logs.
-- ============================================================
CREATE TRIGGER trg_low_stock_alert
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    -- Only fire when stock crosses the threshold downward
    IF NEW.stock_quantity <> OLD.stock_quantity
       AND NEW.stock_quantity <= 20
       AND OLD.stock_quantity  > 20
    THEN
        INSERT INTO audit_logs (user_id, action, module, risk_level, details)
        VALUES (
            NULL,
            CASE
                WHEN NEW.stock_quantity = 0 THEN CONCAT('Out of stock: ', NEW.product_name)
                ELSE CONCAT('Low stock alert: ', NEW.product_name)
            END,
            'Inventory',
            CASE
                WHEN NEW.stock_quantity = 0  THEN 'Critical'
                WHEN NEW.stock_quantity <= 10 THEN 'High'
                ELSE 'Medium'
            END,
            CONCAT(
                'product_id=', NEW.product_id,
                ' | sku=',     NEW.sku,
                ' | stock=',   NEW.stock_quantity
            )
        );
    END IF;
END$$


DELIMITER ;

-- ============================================================
--  END OF SCRIPT
-- ============================================================