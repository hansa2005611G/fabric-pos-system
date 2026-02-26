-- ============================================
-- CURTAIN & FABRIC MANAGEMENT SYSTEM
-- Phase 1 Database Schema
-- PostgreSQL 12+
-- ============================================

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================
CREATE TABLE branches (
  branch_id SERIAL PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'storekeeper')),
  branch_id INTEGER REFERENCES branches(branch_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- ============================================
-- FABRIC MASTER DATA
-- ============================================
CREATE TABLE fabric_categories (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE fabrics (
  fabric_id SERIAL PRIMARY KEY,
  fabric_code VARCHAR(50) UNIQUE NOT NULL,
  fabric_name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES fabric_categories(category_id),
  brand VARCHAR(100),
  color VARCHAR(50),
  pattern VARCHAR(100),
  width_inches NUMERIC(5,2),
  gsm NUMERIC(6,2),
  
  -- Pricing
  cost_price_per_meter NUMERIC(10,2) NOT NULL,
  selling_price_per_meter NUMERIC(10,2) NOT NULL,
  wholesale_price_per_meter NUMERIC(10,2),
  
  -- Stock tracking method
  track_by_roll BOOLEAN DEFAULT true,
  
  -- Metadata
  description TEXT,
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ROLL MANAGEMENT (meter-based stock)
-- ============================================
CREATE TABLE fabric_rolls (
  roll_id SERIAL PRIMARY KEY,
  roll_code VARCHAR(50) UNIQUE NOT NULL,
  fabric_id INTEGER NOT NULL REFERENCES fabrics(fabric_id),
  branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
  
  -- Stock
  initial_meters NUMERIC(10,2) NOT NULL CHECK (initial_meters > 0),
  remaining_meters NUMERIC(10,2) NOT NULL CHECK (remaining_meters >= 0),
  
  -- Location
  rack_location VARCHAR(50),
  
  -- Purchase info (basic for Phase 1)
  supplier_name VARCHAR(100),
  purchase_date DATE,
  purchase_cost_per_meter NUMERIC(10,2),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'finished', 'damaged')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rolls_fabric_branch ON fabric_rolls(fabric_id, branch_id, status);

-- ============================================
-- ACCESSORIES INVENTORY
-- ============================================
CREATE TABLE accessory_categories (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL
);

CREATE TABLE accessories (
  accessory_id SERIAL PRIMARY KEY,
  accessory_code VARCHAR(50) UNIQUE NOT NULL,
  accessory_name VARCHAR(200) NOT NULL,
  category_id INTEGER REFERENCES accessory_categories(category_id),
  
  -- Unit
  unit VARCHAR(20) NOT NULL CHECK (unit IN ('piece', 'pack', 'box', 'meter', 'set')),
  pieces_per_pack INTEGER DEFAULT 1,
  
  -- Pricing
  cost_price NUMERIC(10,2) NOT NULL,
  selling_price NUMERIC(10,2) NOT NULL,
  
  -- Stock
  branch_id INTEGER REFERENCES branches(branch_id),
  current_stock NUMERIC(10,2) DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_level NUMERIC(10,2) DEFAULT 0,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accessories_branch ON accessories(branch_id, is_active);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  customer_id SERIAL PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  nic VARCHAR(20),
  email VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SALES / POS
-- ============================================
CREATE TABLE sales (
  sale_id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
  
  -- Customer (optional in Phase 1)
  customer_id INTEGER REFERENCES customers(customer_id),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  
  -- Amounts
  subtotal NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  
  -- Payment
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_payment', 'credit')),
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Tracking
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  salesperson_name VARCHAR(100),
  
  -- Status
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled', 'returned')),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  sale_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_date_branch ON sales(sale_date, branch_id);
CREATE INDEX idx_sales_invoice ON sales(invoice_number);

-- ============================================
-- SALES ITEMS
-- ============================================
CREATE TABLE sales_items (
  item_id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
  
  -- Item type
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('fabric', 'accessory')),
  
  -- References
  fabric_id INTEGER REFERENCES fabrics(fabric_id),
  roll_id INTEGER REFERENCES fabric_rolls(roll_id),
  accessory_id INTEGER REFERENCES accessories(accessory_id),
  
  -- Item details (denormalized for history)
  item_name VARCHAR(200) NOT NULL,
  item_code VARCHAR(50),
  
  -- Quantity
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL,
  
  -- Pricing
  unit_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sales_items_sale ON sales_items(sale_id);

-- ============================================
-- STOCK TRANSACTIONS LOG
-- ============================================
CREATE TABLE stock_transactions (
  transaction_id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(branch_id),
  
  -- Item reference
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('fabric_roll', 'accessory')),
  roll_id INTEGER REFERENCES fabric_rolls(roll_id),
  accessory_id INTEGER REFERENCES accessories(accessory_id),
  
  -- Transaction
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
    'purchase', 'sale', 'return', 'adjustment', 'damage', 'transfer'
  )),
  quantity NUMERIC(10,2) NOT NULL,
  
  -- Balance after transaction
  balance_after NUMERIC(10,2) NOT NULL,
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id INTEGER,
  
  -- Tracking
  user_id INTEGER REFERENCES users(user_id),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stock_trans_item ON stock_transactions(item_type, roll_id, accessory_id);
CREATE INDEX idx_stock_trans_date ON stock_transactions(created_at);

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE system_settings (
  setting_id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(branch_id),
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG (Phase 3, but ready now)
-- ============================================
CREATE TABLE audit_logs (
  log_id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  user_id INTEGER REFERENCES users(user_id),
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);