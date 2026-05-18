-- ============================================================
-- COCOON OMS - RETURNS SYSTEM FIX
-- Fix Returns to be separate from Fulfillment Status
-- Apply this to your database after backing up
-- ============================================================

-- Step 1: Drop old constraint that includes 'Returned'
ALTER TABLE orders DROP CONSTRAINT CK_orders_delivery;

-- Step 2: Add new constraint without 'Returned'
ALTER TABLE orders ADD CONSTRAINT CK_orders_delivery
  CHECK (delivery_status IN ('Pending','Confirmed','Processing','Shipping','Delivered','Cancelled'));

-- Step 3: Update the audit trigger to remove 'Returned' from risk level check
DROP TRIGGER IF EXISTS trg_audit_order_delivery_status;

CREATE TRIGGER trg_audit_order_delivery_status AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.delivery_status != OLD.delivery_status THEN
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (NULL,
            CONCAT('Delivery status changed: ', OLD.delivery_status, ' → ', NEW.delivery_status),
            'Orders',
            IF(NEW.delivery_status = 'Cancelled', 'Medium', 'Normal'),
            JSON_OBJECT('order_id', NEW.order_id, 'old_status', OLD.delivery_status, 'new_status', NEW.delivery_status));
  END IF;
END;

-- Step 4: Verify return_requests table exists (should already exist from 001 migration)
-- If it doesn't exist, create it now:
CREATE TABLE IF NOT EXISTS return_requests (
  return_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  sales_channel VARCHAR(20) NOT NULL COMMENT 'in_store|online|dealer|marketplace',
  return_type ENUM('partial', 'full') NOT NULL DEFAULT 'full',
  reason VARCHAR(500) NOT NULL,
  status ENUM('pending', 'approved', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  refund_amount DECIMAL(15, 2) DEFAULT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  note TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_return_order FOREIGN KEY (order_id)
    REFERENCES orders(order_id) ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  INDEX idx_sales_channel (sales_channel),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT 'Separate transaction layer for returns - decoupled from order status';

-- Step 5: Create triggers for return_requests audit logging
CREATE TRIGGER IF NOT EXISTS trg_audit_return_request_created AFTER INSERT ON return_requests
FOR EACH ROW
BEGIN
  INSERT INTO audit_logs (user_id, action, module, risk_level, details)
  VALUES (NULL, CONCAT('Return request created: ', NEW.return_id), 'Returns', 'Normal',
          JSON_OBJECT('order_id', NEW.order_id, 'return_type', NEW.return_type, 'reason', NEW.reason));
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_return_request_status AFTER UPDATE ON return_requests
FOR EACH ROW
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO audit_logs (user_id, action, module, risk_level, details)
    VALUES (NULL, CONCAT('Return status changed: ', OLD.status, ' → ', NEW.status), 'Returns', 'Normal',
            JSON_OBJECT('return_id', NEW.return_id, 'order_id', NEW.order_id, 'refund_amount', NEW.refund_amount));
  END IF;
END;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify the changes:

-- Check constraint is updated
SELECT CONSTRAINT_NAME, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'orders' AND CONSTRAINT_NAME LIKE 'CK_orders_delivery';

-- Check return_requests table exists
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'return_requests' AND TABLE_SCHEMA = DATABASE();

-- Check delivery_status values in orders table
SELECT DISTINCT delivery_status FROM orders;

-- ============================================================
-- NOTES FOR IMPLEMENTATION:
-- ============================================================
-- 1. Backup your database BEFORE running this script
-- 2. If you have any existing orders with delivery_status = 'Returned':
--    - Update them to 'Delivered' and create corresponding return_requests
--    - OR delete them if they are test data
-- 3. After applying this SQL:
--    - Restart your backend server
--    - Clear browser cache
--    - Test creating a return request from a delivered order
-- 4. Returns workflow:
--    - Order reaches Delivered status (fulfillment complete)
--    - User/admin creates a return request (separate transaction)
--    - Return request follows: pending → approved → processing → completed
--    - Order status NEVER changes to 'Returned' anymore
