// scripts/seed.js
// ============================================================
//  Cocoon Vietnam SMS — Database Seed Script
//  Run: node scripts/seed.js
//  Clears and repopulates all tables with realistic data.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

// ─── Helpers ─────────────────────────────────────────────────
const rnd    = (arr)        => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (min, max)   => Math.floor(Math.random() * (max - min + 1)) + min;
const rndDec = (min, max)   => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const pad    = (n, len = 2) => String(n).padStart(len, '0');
const today  = new Date();
const daysAgo = (d) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split('T')[0];
};
const datetimeAgo = (daysMin, daysMax) => {
  const d = rndInt(daysMin, daysMax);
  const dt = new Date(today);
  dt.setDate(dt.getDate() - d);
  dt.setHours(rndInt(7, 22), rndInt(0, 59), rndInt(0, 59));
  return dt.toISOString().slice(0, 19).replace('T', ' ');
};

// ─── Data constants ──────────────────────────────────────────
const CITIES = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Huế', 'Nha Trang', 'Vũng Tàu'];
<<<<<<< HEAD
const ORDER_CHANNELS = ['in_store', 'online', 'dealer', 'marketplace'];
const PLATFORM_BY_CHANNEL = {
  in_store: 'physical_store',
  online: 'website',
  dealer: 'dealer_portal',
};
const MARKETPLACE_PLATFORMS = ['shopee', 'tiktok', 'lazada'];
const PAYMENT_METHODS = ['COD', 'Momo', 'VNPay', 'Bank Transfer', 'Card'];
const DEALER_PAYMENT_METHODS = ['Invoice', 'Credit Terms'];
=======
const CHANNELS = ['Website', 'Shopee', 'TikTok Shop', 'Lazada', 'In-store'];
const PAYMENT_METHODS = ['COD', 'Momo', 'VNPay', 'Bank Transfer', 'Card'];
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
const DELIVERY_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipping', 'Delivered', 'Cancelled'];
const REGIONS = ['Miền Bắc', 'Miền Trung', 'Miền Nam'];

// ─── TRUNCATE (order matters — FK-safe) ──────────────────────
async function truncateAll(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'audit_logs', 'debt_transactions', 'stock_transactions',
<<<<<<< HEAD
    'loyalty_transactions', 'return_requests', 'order_items', 'orders',
=======
    'loyalty_transactions', 'order_items', 'orders',
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    'promotions', 'dealers', 'raw_materials',
    'products', 'customers', 'users', 'categories',
  ];
  for (const t of tables) {
    await conn.query(`TRUNCATE TABLE ${t}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✅  Tables truncated.');
}

// ─── CATEGORIES ───────────────────────────────────────────────
async function seedCategories(conn) {
  const cats = [
    ['Dưỡng da mặt',    'Các sản phẩm chăm sóc và dưỡng ẩm da mặt từ nguyên liệu thiên nhiên Việt Nam'],
    ['Tẩy trang',       'Nước tẩy trang, dầu tẩy trang, bông tẩy trang thân thiện môi trường'],
    ['Chăm sóc cơ thể', 'Sữa tắm, dưỡng thể, tẩy tế bào chết từ nguyên liệu địa phương'],
    ['Chăm sóc tóc',    'Dầu gội, dầu xả, kem ủ tóc từ bơ hạt mỡ và dầu dừa Bến Tre'],
    ['Chống nắng',      'Kem chống nắng vật lý và hóa học, SPF 30–50'],
    ['Son môi',         'Son dưỡng, son lì, son kem từ chiết xuất hoa quả Việt Nam'],
    ['Serum & Tinh chất','Serum vitamin C, retinol, niacinamide thuần chay'],
    ['Sản phẩm cho nam','Sữa rửa mặt, gel cạo râu, dưỡng ẩm cho nam giới'],
  ];
  await conn.query(
    'INSERT INTO categories (category_name, description) VALUES ?', [cats]
  );
  console.log(`✅  Categories: ${cats.length}`);
  return cats.map((_, i) => i + 1);
}

// ─── USERS ────────────────────────────────────────────────────
async function seedUsers(conn) {
  const hash = await bcrypt.hash('Cocoon@2024', 12);
  const users = [
    // [full_name, email, role, office]
    ['Admin Hệ Thống',   'admin@cocoonvietnam.com',    'admin',     'HCM HQ'],
    ['Nguyễn Thị Mai',   'mai.nguyen@cocoonvietnam.com','manager',  'HCM HQ'],
    ['Trần Văn Khoa',    'khoa.tran@cocoonvietnam.com', 'manager',  'Hà Nội'],
    ['Lê Thị Hoa',       'hoa.le@cocoonvietnam.com',    'sales',    'HCM HQ'],
    ['Phạm Minh Tuấn',   'tuan.pham@cocoonvietnam.com', 'sales',    'HCM HQ'],
    ['Nguyễn Văn Bình',  'binh.nguyen@cocoonvietnam.com','sales',   'Hà Nội'],
    ['Võ Thị Lan',       'lan.vo@cocoonvietnam.com',    'sales',    'Đà Nẵng'],
    ['Đặng Quốc Hưng',   'hung.dang@cocoonvietnam.com', 'warehouse','HCM Warehouse'],
    ['Bùi Thị Thu',      'thu.bui@cocoonvietnam.com',   'warehouse','HCM Warehouse'],
    ['Hoàng Minh Châu',  'chau.hoang@cocoonvietnam.com','finance',  'HCM HQ'],
    ['Lý Thị Ngọc',      'ngoc.ly@cocoonvietnam.com',   'finance',  'HCM HQ'],
  ];

  await conn.query(
    `INSERT INTO users (full_name, email, password_hash, role, office, last_login_at)
     VALUES ?`,
    [users.map(([full_name, email, role, office]) => [
      full_name, email, hash, role, office, datetimeAgo(0, 3)
    ])]
  );
  console.log(`✅  Users: ${users.length}`);
  return users.length;
}

// ─── PRODUCTS ─────────────────────────────────────────────────
async function seedProducts(conn) {
  const products = [
    // [category_id, name, sku, cost, price, stock, sold, ingredients, tags]
    [1, 'Nước hoa hồng Dưỡng ẩm Cà phê Đắk Lắk 100ml', 'CCN-TN-001', 85000, 185000, 450, 1230,
     'Nước hoa hồng, chiết xuất cà phê Đắk Lắk, glycerin, panthenol', 'dưỡng ẩm,cà phê,toner'],
    [1, 'Kem dưỡng ẩm Bơ Đắk Lắk 30ml', 'CCN-KD-001', 120000, 265000, 380, 890,
     'Bơ hạt mỡ Đắk Lắk, shea butter, vitamin E, niacinamide', 'kem dưỡng,bơ,dưỡng ẩm'],
    [1, 'Serum Vitamin C Khổ Qua 30ml', 'CCN-SR-001', 150000, 349000, 290, 740,
     'Vitamin C 15%, chiết xuất khổ qua, hyaluronic acid, niacinamide', 'serum,vitamin c,làm sáng'],
    [2, 'Nước tẩy trang Hoa Hồng 500ml', 'CCN-TT-001', 95000, 199000, 520, 2100,
     'Nước hoa hồng Bulgaria, glycerin, allantoin, panthenol', 'tẩy trang,hoa hồng,dịu nhẹ'],
    [2, 'Dầu tẩy trang Dừa Bến Tre 130ml', 'CCN-TT-002', 110000, 229000, 310, 980,
     'Dầu dừa Bến Tre, cetyl ethylhexanoate, polysorbate 80', 'tẩy trang,dầu dừa,làm sạch sâu'],
    [3, 'Sữa tắm Cà phê Đắk Lắk 310ml', 'CCN-ST-001', 65000, 145000, 680, 3200,
     'Chiết xuất cà phê Đắk Lắk, coconut surfactant, panthenol', 'sữa tắm,cà phê,thanh lọc'],
    [3, 'Tẩy tế bào chết Cám Gạo 150ml', 'CCN-TBG-001', 80000, 175000, 420, 1560,
     'Cám gạo, bột yến mạch, lactic acid 5%, aloe vera', 'tẩy da chết,cám gạo,làm sáng'],
    [3, 'Dưỡng thể Bơ Đắk Lắk 250ml', 'CCN-DT-001', 105000, 235000, 350, 870,
     'Bơ hạt mỡ Đắk Lắk, shea butter, vitamin E, jojoba oil', 'dưỡng thể,bơ,mềm mịn'],
    [4, 'Dầu gội Bồ Kết Hương Bưởi 400ml', 'CCN-DG-001', 90000, 195000, 480, 1890,
     'Bồ kết, vỏ bưởi, biotin, panthenol, keratin thực vật', 'dầu gội,bồ kết,bưởi,chắc tóc'],
    [4, 'Dầu xả Dầu Dừa Bến Tre 400ml', 'CCN-DX-001', 85000, 185000, 390, 1340,
     'Dầu dừa Bến Tre, keratin thực vật, argan oil, panthenol', 'dầu xả,dầu dừa,mềm tóc'],
    [4, 'Kem ủ tóc Bơ Sầu Riêng 200ml', 'CCN-UT-001', 95000, 209000, 260, 620,
     'Bơ sầu riêng, dầu dừa, keratin, biotin, vitamin B5', 'ủ tóc,sầu riêng,phục hồi'],
    [5, 'Kem chống nắng Cà phê SPF 50+ 30g', 'CCN-CN-001', 130000, 289000, 340, 1120,
     'Chiết xuất cà phê, zinc oxide, tinosorb M, vitamin C', 'chống nắng,spf50,cà phê'],
    [5, 'Kem chống nắng Dứa SPF 30 45g', 'CCN-CN-002', 115000, 249000, 280, 760,
     'Chiết xuất dứa, octinoxate, oxybenzone, vitamin E', 'chống nắng,spf30,dứa'],
    [6, 'Son dưỡng Hoa Hồng 3.5g', 'CCN-SL-001', 55000, 119000, 750, 4300,
     'Dầu hoa hồng, beeswax, shea butter, vitamin E', 'son dưỡng,hoa hồng,dưỡng môi'],
    [6, 'Son kem Cà phê 3.5g', 'CCN-SL-002', 70000, 155000, 580, 2100,
     'Cà phê Đắk Lắk, castor oil, candelilla wax, vitamin C', 'son kem,cà phê,lì môi'],
    [7, 'Serum Niacinamide 10% 30ml', 'CCN-SR-002', 140000, 319000, 310, 890,
     'Niacinamide 10%, zinc PCA, hyaluronic acid, panthenol', 'serum,niacinamide,thu lỗ chân lông'],
    [7, 'Serum Retinol 0.3% Cà phê 30ml', 'CCN-SR-003', 165000, 369000, 180, 430,
     'Retinol 0.3%, cà phê Đắk Lắk, squalane, peptides', 'serum,retinol,chống lão hóa'],
    [8, 'Sữa rửa mặt than tre cho nam 100ml', 'CCN-NAM-001', 75000, 165000, 320, 780,
     'Than tre hoạt tính, salicylic acid 0.5%, aloe vera, tea tree', 'nam giới,than tre,kiểm soát dầu'],
    [1, 'Mặt nạ Bơ Đắk Lắk 25ml x 5 miếng', 'CCN-MN-001', 85000, 189000, 8, 1670,
     'Bơ hạt mỡ Đắk Lắk, hyaluronic acid, ceramide, peptides', 'mặt nạ,bơ,cấp ẩm'],
    [3, 'Xịt khoáng Cúc La Mã 150ml', 'CCN-XK-001', 60000, 135000, 12, 2340,
     'Nước khoáng, chiết xuất cúc la mã, aloe vera, glycerin', 'xịt khoáng,cúc la mã,dưỡng ẩm'],
  ];

  await conn.query(
    `INSERT INTO products
       (category_id, product_name, sku, cost_price, selling_price, stock_quantity, sold_count,
        ingredients, tags, status, visibility)
     VALUES ?`,
    [products.map(([cat, name, sku, cost, price, stock, sold, ing, tags]) => [
      cat, name, sku, cost, price, stock, sold, ing, tags,
      stock === 0 ? 'Out of Stock' : 'Available', 'Visible'
    ])]
  );
  console.log(`✅  Products: ${products.length}`);
  return products.length;
}

// ─── RAW MATERIALS ────────────────────────────────────────────
async function seedRawMaterials(conn) {
  const materials = [
    ['Cà phê Robusta', 'Đắk Lắk', 'HTX Cà phê Buôn Ma Thuột', 2500, 'kg', 'Stable', daysAgo(15), daysAgo(-365)],
    ['Dầu dừa nguyên chất', 'Bến Tre', 'Công ty Dầu dừa Bến Tre', 1800, 'kg', 'Stable', daysAgo(10), daysAgo(-300)],
    ['Bơ hạt mỡ (Shea butter)', 'Đắk Lắk', 'Nông trường Đắk Lắk', 900, 'kg', 'Warning', daysAgo(30), daysAgo(-180)],
    ['Chiết xuất hoa hồng', 'Đà Lạt', 'Làng hoa Đà Lạt', 320, 'lít', 'Stable', daysAgo(7), daysAgo(-200)],
    ['Bồ kết khô', 'Nghệ An', 'HTX Thảo dược Nghệ An', 600, 'kg', 'Stable', daysAgo(20), daysAgo(-365)],
    ['Vỏ bưởi sấy khô', 'Vĩnh Long', 'Hợp tác xã Vĩnh Long', 450, 'kg', 'Stable', daysAgo(12), daysAgo(-180)],
    ['Cám gạo', 'An Giang', 'Nhà máy xay xát An Giang', 3200, 'kg', 'Stable', daysAgo(5), daysAgo(-90)],
    ['Chiết xuất khổ qua', 'Bình Dương', 'Công ty Chiết xuất Bình Dương', 180, 'lít', 'Warning', daysAgo(25), daysAgo(-120)],
    ['Than tre hoạt tính', 'Phú Thọ', 'Công ty Than tre Phú Thọ', 750, 'kg', 'Stable', daysAgo(8), daysAgo(-365)],
    ['Chiết xuất cúc la mã', 'Đà Lạt', 'Nông trại hữu cơ Đà Lạt', 95, 'lít', 'Critical', daysAgo(40), daysAgo(-60)],
    ['Bơ sầu riêng', 'Tiền Giang', 'HTX Sầu riêng Tiền Giang', 420, 'kg', 'Stable', daysAgo(6), daysAgo(-150)],
    ['Dứa (chiết xuất enzyme)', 'Ninh Bình', 'Nhà máy Dứa Ninh Bình', 260, 'lít', 'Stable', daysAgo(18), daysAgo(-120)],
  ];

  await conn.query(
    `INSERT INTO raw_materials
       (material_name, origin, supplier_name, quantity, unit, status, import_date, expiry_date)
     VALUES ?`,
    [materials]
  );
  console.log(`✅  Raw materials: ${materials.length}`);
}

// ─── PROMOTIONS ───────────────────────────────────────────────
async function seedPromotions(conn) {
  const promos = [
    ['Khuyến mãi Tết 2024',           15, 'percentage', daysAgo(120), daysAgo(100), 'Expired'],
    ['Sale 8/3 Ngày Phụ Nữ',          20, 'percentage', daysAgo(90),  daysAgo(80),  'Expired'],
    ['Freeship tháng 4',               30000, 'fixed',  daysAgo(60),  daysAgo(40),  'Expired'],
    ['Giảm giá khách mới',             10, 'percentage', daysAgo(20),  daysAgo(10),  'Active'],
    ['Flash Sale cuối tuần',           25, 'percentage', daysAgo(2),   daysAgo(-5),  'Active'],
    ['Combo mua 2 tặng 1 (giá trị)',   50000, 'fixed',   daysAgo(1),   daysAgo(-14), 'Active'],
    ['Ngày Môi trường 5/6',            18, 'percentage', daysAgo(-3), daysAgo(-10),  'Inactive'],
    ['Mừng 5 năm Cocoon',              30, 'percentage', daysAgo(-10), daysAgo(-20), 'Inactive'],
  ];

  await conn.query(
    `INSERT INTO promotions (promotion_name, discount_rate, promo_type, start_date, end_date, status)
     VALUES ?`,
    [promos]
  );
  console.log(`✅  Promotions: ${promos.length}`);
}

// ─── DEALERS ──────────────────────────────────────────────────
async function seedDealers(conn) {
  const dealers = [
<<<<<<< HEAD
    ['Chuỗi mỹ phẩm BeautyLand',     'Miền Nam',  'TP. Hồ Chí Minh', 'Nguyễn Thị Hà',    '0909111222', 'beautyland@email.com',    'Tier 1', 'Net 30',  850000000, 120000000, 500000000, 'Warning', 'Active'],
    ['Hệ thống Guardian VN',         'Miền Nam',  'TP. Hồ Chí Minh', 'Trần Minh Khoa',   '0908222333', 'guardian.vn@email.com',   'Tier 1', 'Net 30', 1200000000, 0,          800000000, 'Stable',  'Active'],
    ['Siêu thị Winmart Beauty',      'Miền Bắc',  'Hà Nội',          'Lê Thu Hương',     '0912333444', 'winmart.beauty@email.com', 'Tier 2', 'Net 45',  650000000,  80000000,  400000000, 'Stable',  'Active'],
    ['Chuỗi TheFaceShop HCM',        'Miền Nam',  'TP. Hồ Chí Minh', 'Phạm Anh Tuấn',    '0911444555', 'tfshop.hcm@email.com',     'Tier 2', 'Net 30',  480000000,  200000000, 300000000, 'Overdue', 'Active'],
    ['Nhà phân phối Đà Nẵng Beauty', 'Miền Trung','Đà Nẵng',         'Võ Quang Hải',     '0905555666', 'dn.beauty@email.com',      'Tier 1', 'Net 30',  320000000,  45000000,  250000000, 'Stable',  'Active'],
    ['Mỹ phẩm xanh Cần Thơ',         'Miền Nam',  'Cần Thơ',         'Nguyễn Lan Anh',   '0916666777', 'xanh.ct@email.com',        'Tier 3', 'Net 60',  180000000,  0,          150000000, 'Stable',  'Active'],
    ['Spa & Beauty Huế',             'Miền Trung','Huế',             'Bùi Thị Ngân',     '0917777888', 'spa.hue@email.com',        'Tier 3', 'Net 30',   95000000,   15000000,   80000000, 'Stable',  'Active'],
    ['Đại lý mỹ phẩm Hải Phòng',     'Miền Bắc',  'Hải Phòng',       'Đặng Văn Hùng',    '0918888999', 'mp.hp@email.com',          'Tier 2', 'Net 45',  140000000,  60000000,  100000000, 'Warning', 'Suspended'],
=======
    ['Chuỗi mỹ phẩm BeautyLand',     'Miền Nam',  'TP. Hồ Chí Minh', 'Nguyễn Thị Hà',    '0909111222', 'beautyland@email.com',    850000000, 120000000, 500000000, 'Warning', 'Active'],
    ['Hệ thống Guardian VN',          'Miền Nam',  'TP. Hồ Chí Minh', 'Trần Minh Khoa',   '0908222333', 'guardian.vn@email.com',   1200000000, 0,          800000000, 'Stable',  'Active'],
    ['Siêu thị Winmart Beauty',       'Miền Bắc',  'Hà Nội',          'Lê Thu Hương',     '0912333444', 'winmart.beauty@email.com', 650000000,  80000000,  400000000, 'Stable',  'Active'],
    ['Chuỗi TheFaceShop HCM',         'Miền Nam',  'TP. Hồ Chí Minh', 'Phạm Anh Tuấn',    '0911444555', 'tfshop.hcm@email.com',    480000000,  200000000, 300000000, 'Overdue', 'Active'],
    ['Nhà phân phối Đà Nẵng Beauty',  'Miền Trung','Đà Nẵng',         'Võ Quang Hải',     '0905555666', 'dn.beauty@email.com',     320000000,  45000000,  250000000, 'Stable',  'Active'],
    ['Mỹ phẩm xanh Cần Thơ',         'Miền Nam',  'Cần Thơ',         'Nguyễn Lan Anh',   '0916666777', 'xanh.ct@email.com',       180000000,  0,          150000000, 'Stable',  'Active'],
    ['Spa & Beauty Huế',              'Miền Trung','Huế',             'Bùi Thị Ngân',     '0917777888', 'spa.hue@email.com',       95000000,   15000000,   80000000, 'Stable',  'Active'],
    ['Đại lý mỹ phẩm Hải Phòng',     'Miền Bắc',  'Hải Phòng',       'Đặng Văn Hùng',    '0918888999', 'mp.hp@email.com',         140000000,  60000000,  100000000, 'Warning', 'Suspended'],
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
  ];

  await conn.query(
    `INSERT INTO dealers
       (dealer_name, region, city, contact_person, phone_number, email,
<<<<<<< HEAD
        wholesale_tier, payment_terms, total_revenue, debt_amount, credit_limit, debt_status, partner_status)
=======
        total_revenue, debt_amount, credit_limit, debt_status, partner_status)
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
     VALUES ?`,
    [dealers]
  );
  console.log(`✅  Dealers: ${dealers.length}`);
}

// ─── CUSTOMERS ────────────────────────────────────────────────
async function seedCustomers(conn) {
  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const midNames   = ['Thị', 'Văn', 'Minh', 'Thành', 'Quốc', 'Anh', 'Bảo', 'Kim', 'Thanh', 'Xuân'];
  const lastNames  = ['Lan', 'Hoa', 'Mai', 'Yến', 'Linh', 'Hương', 'Trang', 'Hà', 'Ngọc', 'Phương', 'Tuấn', 'Khoa', 'Hùng', 'Bình', 'Dũng', 'Long', 'Cường', 'Nam', 'Tú', 'An'];
  const segments   = ['New', 'New', 'New', 'Loyal', 'Loyal', 'VIP', 'Whale', 'At-risk', 'Wholesale'];

  const customers = [];
  for (let i = 1; i <= 80; i++) {
    const fn   = rnd(firstNames);
    const mn   = rnd(midNames);
    const ln   = rnd(lastNames);
    const name = `${fn} ${mn} ${ln}`;
    const seg  = rnd(segments);
    const pts  = seg === 'Whale' ? rndInt(10000, 30000)
               : seg === 'VIP'   ? rndInt(3000, 9999)
               : seg === 'Loyal' ? rndInt(500, 2999)
               : rndInt(0, 499);
    const city = rnd(CITIES);
    customers.push([
      name,
      `customer${i}@email.com`,
      `09${pad(rndInt(0,99),2)}${pad(rndInt(0,9999999), 7)}`,
<<<<<<< HEAD
      'retail',
=======
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
      rnd(['female', 'male', 'other']),
      `${rndInt(1980, 2003)}-${pad(rndInt(1,12))}-${pad(rndInt(1,28))}`,
      `${rndInt(1,500)} Đường ${rnd(['Nguyễn Huệ','Lê Lợi','Trần Hưng Đạo','Điện Biên Phủ','Lý Thường Kiệt'])}`,
      city,
      seg,
      pts,
      datetimeAgo(30, 365),
    ]);
  }

  await conn.query(
    `INSERT INTO customers
<<<<<<< HEAD
       (full_name, email, phone_number, customer_type, gender, date_of_birth, address, city, segment,
=======
       (full_name, email, phone_number, gender, date_of_birth, address, city, segment,
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
        loyalty_points_balance, created_at)
     VALUES ?`,
    [customers]
  );
  console.log(`✅  Customers: ${customers.length}`);
}

// ─── ORDERS + ORDER ITEMS ─────────────────────────────────────
async function seedOrders(conn) {
<<<<<<< HEAD
  const [productRows] = await conn.query('SELECT product_id, selling_price, cost_price, stock_quantity FROM products');
  const [customerRows] = await conn.query('SELECT customer_id FROM customers');
  const [userRows] = await conn.query("SELECT user_id FROM users WHERE role = 'sales'");
  const [dealerRows] = await conn.query('SELECT dealer_id, dealer_name, email, phone_number, region, city FROM dealers');
  const stockRemaining = Object.fromEntries(productRows.map(p => [p.product_id, Number(p.stock_quantity) || 0]));
=======
  // Disable triggers temporarily so we can insert historical data freely
  await conn.query('SET @disable_triggers = 1');

  const [productRows] = await conn.query('SELECT product_id, selling_price, cost_price FROM products');
  const [customerRows] = await conn.query('SELECT customer_id FROM customers');
  const [userRows] = await conn.query("SELECT user_id FROM users WHERE role = 'sales'");
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f

  let orderCount = 0;
  let itemCount  = 0;

  // Generate 20 orders spread over last 180 days
  for (let i = 1; i <= 20; i++) {
<<<<<<< HEAD
    const channel   = rnd(ORDER_CHANNELS);
    const staff     = rnd(userRows);
    const daysBack  = rndInt(0, 179);
    const orderedAt = datetimeAgo(daysBack, daysBack);
    const city      = rnd(CITIES);
    const numItems  = rndInt(1, 4);

    let customer = rnd(customerRows);
    let dealer = null;
    let customerType = 'retail';
    let payMethod = rnd(PAYMENT_METHODS);
    const platform = PLATFORM_BY_CHANNEL[channel] || rnd(MARKETPLACE_PLATFORMS);

    if (channel === 'dealer') {
      dealer = rnd(dealerRows);
      customerType = 'dealer';
      payMethod = rnd(DEALER_PAYMENT_METHODS);

      const dealerEmail = dealer.email || `dealer-${dealer.dealer_id}@cocoon.local`;
      const [dealerCustomerRows] = await conn.query(
        `SELECT customer_id FROM customers WHERE customer_type = 'dealer' AND email = ? LIMIT 1`,
        [dealerEmail]
      );
      if (dealerCustomerRows.length) {
        customer = dealerCustomerRows[0];
      } else {
        const [dealerCustomerResult] = await conn.query(
          `INSERT INTO customers (full_name, email, phone_number, customer_type, gender, date_of_birth, address, city, segment, loyalty_points_balance, created_at)
           VALUES (?, ?, ?, 'dealer', NULL, NULL, ?, ?, 'Wholesale', 0, ?)`,
          [dealer.dealer_name, dealerEmail, dealer.phone_number || null, dealer.region || null, dealer.city || null, orderedAt]
        );
        customer = { customer_id: dealerCustomerResult.insertId };
      }
    } else if (channel === 'marketplace') {
      customerType = 'marketplace';
    } else if (rndInt(0, 4) === 0) {
      customerType = 'guest';
      const guestEmail = `guest${i}_${daysBack}@guest.local`;
      const [guestResult] = await conn.query(
        `INSERT INTO customers (full_name, email, phone_number, customer_type, gender, date_of_birth, address, city, segment, loyalty_points_balance, created_at)
         VALUES (?, ?, ?, 'guest', NULL, NULL, ?, ?, 'New', 0, ?)` ,
        [`Guest Customer ${i}`, guestEmail, null, null, city, orderedAt]
      );
      customer = { customer_id: guestResult.insertId };
    }

    // Pick random products without exceeding remaining stock
    const availableProducts = productRows.filter(p => stockRemaining[p.product_id] > 0);
    if (!availableProducts.length) {
      console.log('⚠️  No stock left to create more seed orders.');
      break;
    }

    const shuffled = [...availableProducts].sort(() => Math.random() - 0.5).slice(0, Math.min(numItems, availableProducts.length));
=======
    const customer  = rnd(customerRows);
    const staff     = rnd(userRows);
    const channel   = rnd(CHANNELS);
    const daysBack  = rndInt(0, 179);
    const orderedAt = datetimeAgo(daysBack, daysBack);
    const payMethod = rnd(PAYMENT_METHODS);
    const city      = rnd(CITIES);
    const numItems  = rndInt(1, 4);

    // Pick random products (no duplicates per order)
    const shuffled = [...productRows].sort(() => Math.random() - 0.5).slice(0, numItems);
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    const shippingFee = rndInt(0, 1) ? 0 : rndInt(15000, 35000);

    let subtotalSum = 0;
    const lineItems = shuffled.map(p => {
<<<<<<< HEAD
      const maxQty   = Math.min(3, stockRemaining[p.product_id]);
      const qty      = rndInt(1, maxQty);
      const price    = parseFloat(p.selling_price);
      const subtotal = parseFloat((price * qty).toFixed(2));
      subtotalSum   += subtotal;
      stockRemaining[p.product_id] -= qty;
=======
      const qty      = rndInt(1, 3);
      const price    = parseFloat(p.selling_price);
      const subtotal = parseFloat((price * qty).toFixed(2));
      subtotalSum   += subtotal;
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
      return { product_id: p.product_id, quantity: qty, unit_price: price, subtotal };
    });

    const loyaltyDiscount = rndInt(0, 1) ? 0 : rndInt(10000, 50000);
    const totalAmount     = Math.max(0, subtotalSum + shippingFee - loyaltyDiscount);

    // Determine delivery & payment status based on age
    let deliveryStatus, paymentStatus;
    if (daysBack > 14) {
<<<<<<< HEAD
      deliveryStatus = rnd(['Processing', 'Shipping', 'Cancelled']);
      paymentStatus  = rnd(['Paid', 'Unpaid', 'Pending']);
    } else if (daysBack > 3) {
      deliveryStatus = rnd(['Pending', 'Confirmed', 'Processing', 'Shipping']);
      paymentStatus  = rndInt(0, 1) ? 'Paid' : 'Unpaid';
    } else {
      deliveryStatus = 'Pending';
=======
      deliveryStatus = rndInt(0, 10) > 1 ? 'Delivered' : rnd(['Cancelled', 'Returned']);
      paymentStatus  = deliveryStatus === 'Delivered' ? (rndInt(0, 5) > 0 ? 'Paid' : 'Unpaid') : rnd(['Unpaid', 'Refunded']);
    } else if (daysBack > 3) {
      deliveryStatus = rnd(['Processing', 'Shipping', 'Confirmed', 'Delivered']);
      paymentStatus  = rndInt(0, 1) ? 'Paid' : 'Unpaid';
    } else {
      deliveryStatus = rnd(['Pending', 'Confirmed', 'Processing']);
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
      paymentStatus  = rndInt(0, 1) ? 'Paid' : 'Unpaid';
    }

    const orderNumber = `ORD-${orderedAt.replace(/[-: ]/g, '').slice(0, 14)}-${pad(i, 4)}`;
<<<<<<< HEAD
     const invoiceNumber = customerType === 'dealer' ? `INV-${orderedAt.replace(/[-: ]/g, '').slice(0, 14)}-${pad(i, 4)}` : null;
     const invoiceStatus = customerType === 'dealer' ? (paymentStatus === 'Paid' ? 'Paid' : 'Generated') : 'Not Generated';

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (customer_id, dealer_id, user_id, order_number, customer_type, sales_channel, platform, delivery_status, payment_status,
         payment_method, invoice_number, invoice_status, city, total_amount, shipping_fee, loyalty_discount, ordered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer.customer_id, dealer ? dealer.dealer_id : null, staff.user_id, orderNumber, customerType, channel, platform, deliveryStatus, paymentStatus,
       payMethod, invoiceNumber, invoiceStatus, city, totalAmount, shippingFee, loyaltyDiscount, orderedAt, orderedAt]
=======

    const [orderResult] = await conn.query(
      `INSERT INTO orders
         (customer_id, user_id, order_number, sales_channel, delivery_status, payment_status,
          payment_method, city, total_amount, shipping_fee, loyalty_discount, ordered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer.customer_id, staff.user_id, orderNumber, channel, deliveryStatus, paymentStatus,
       payMethod, city, totalAmount, shippingFee, loyaltyDiscount, orderedAt, orderedAt]
>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    );
    const orderId = orderResult.insertId;

    for (const li of lineItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, li.product_id, li.quantity, li.unit_price, li.subtotal]
      );
      itemCount++;
    }

<<<<<<< HEAD
=======
    // Update product sold_count manually (triggers disabled for seed)
    for (const li of lineItems) {
      if (deliveryStatus !== 'Cancelled' && deliveryStatus !== 'Returned') {
        await conn.query(
          'UPDATE products SET sold_count = sold_count + ? WHERE product_id = ?',
          [li.quantity, li.product_id]
        );
      }
    }

>>>>>>> 0d25791db56b5232ac735ca6ac681be7541f6d6f
    orderCount++;
  }

  console.log(`✅  Orders: ${orderCount} | Order items: ${itemCount}`);
}

// ─── LOYALTY TRANSACTIONS ─────────────────────────────────────
async function seedLoyaltyTransactions(conn) {
  const [deliveredOrders] = await conn.query(
    `SELECT o.order_id, o.customer_id, o.order_number, o.total_amount, o.loyalty_discount, o.ordered_at
     FROM orders o WHERE o.delivery_status = 'Delivered' LIMIT 150`
  );

  const txns = deliveredOrders.map(o => {
    const net    = Math.max(0, parseFloat(o.total_amount) - parseFloat(o.loyalty_discount));
    const points = Math.max(1, Math.floor(net * 0.0001));
    return [
      o.customer_id, o.order_id, 'earn', points,
      `Điểm thưởng từ đơn hàng ${o.order_number}`, o.ordered_at
    ];
  });

  if (txns.length) {
    await conn.query(
      `INSERT INTO loyalty_transactions
         (customer_id, order_id, action_type, points_amount, description, created_at)
       VALUES ?`,
      [txns]
    );
  }
  console.log(`✅  Loyalty transactions: ${txns.length}`);
}

// ─── STOCK TRANSACTIONS ───────────────────────────────────────
async function seedStockTransactions(conn) {
  const [products] = await conn.query('SELECT product_id FROM products');
  const [wareUsers] = await conn.query("SELECT user_id FROM users WHERE role IN ('warehouse','admin')");

  const txns = [];
  for (const p of products) {
    // Initial stock-in
    txns.push([
      p.product_id, rnd(wareUsers).user_id, 'Stock In',
      rndInt(200, 1000), 'HCM Warehouse', 'PO-2024-INIT', 'Nhập kho ban đầu',
      datetimeAgo(180, 170)
    ]);
    // Some replenishments
    for (let r = 0; r < rndInt(1, 3); r++) {
      txns.push([
        p.product_id, rnd(wareUsers).user_id, 'Stock In',
        rndInt(50, 300), 'HCM Warehouse',
        `PO-2024-${rndInt(1000, 9999)}`, 'Nhập hàng định kỳ',
        datetimeAgo(169, 10)
      ]);
    }
  }

  await conn.query(
    `INSERT INTO stock_transactions
       (product_id, user_id, transaction_type, quantity, warehouse, reference_id, note, created_at)
     VALUES ?`,
    [txns]
  );
  console.log(`✅  Stock transactions: ${txns.length}`);
}

// ─── DEBT TRANSACTIONS ────────────────────────────────────────
async function seedDebtTransactions(conn) {
  const [dealers] = await conn.query('SELECT dealer_id FROM dealers WHERE partner_status = ?', ['Active']);
  const [finUsers] = await conn.query("SELECT user_id FROM users WHERE role IN ('finance','admin')");

  const txns = [];
  for (const d of dealers) {
    // 2-4 invoices per dealer
    for (let i = 0; i < rndInt(2, 4); i++) {
      txns.push([d.dealer_id, rnd(finUsers).user_id, 'Invoice', rndDec(50000000, 200000000),
        'Completed', `Hóa đơn xuất hàng tháng ${rndInt(1, 5)}/2024`, datetimeAgo(180, 60)]);
    }
    // 1-2 payments
    for (let p = 0; p < rndInt(1, 2); p++) {
      txns.push([d.dealer_id, rnd(finUsers).user_id, 'Payment Received', rndDec(20000000, 80000000),
        'Completed', 'Thanh toán công nợ', datetimeAgo(59, 10)]);
    }
  }

  await conn.query(
    `INSERT INTO debt_transactions
       (dealer_id, user_id, transaction_type, amount, status, note, created_at)
     VALUES ?`,
    [txns.map(t => t)]
  );
  console.log(`✅  Debt transactions: ${txns.length}`);
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('\n🌱  Starting Cocoon SMS seed...\n');
    await conn.beginTransaction();

    await truncateAll(conn);
    await seedCategories(conn);
    await seedUsers(conn);
    await seedProducts(conn);
    await seedRawMaterials(conn);
    await seedPromotions(conn);
    await seedDealers(conn);
    await seedCustomers(conn);
    await seedOrders(conn);
    await seedLoyaltyTransactions(conn);
    await seedStockTransactions(conn);
    await seedDebtTransactions(conn);

    await conn.commit();
    console.log('\n✅  Seed completed successfully!\n');
    console.log('  Default login:');
    console.log('  Email:    admin@cocoonvietnam.com');
    console.log('  Password: Cocoon@2024\n');
  } catch (err) {
    await conn.rollback();
    console.error('\n❌  Seed failed:', err.message);
    console.error(err.stack);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();