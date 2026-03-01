const { body, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Login validation rules
const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

// Fabric category validation
const fabricCategoryValidation = [
  body('category_name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be 2-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
];

// Fabric validation (CREATE)
const fabricValidation = [
  body('fabric_code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Fabric code must be 3-50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Fabric code can only contain uppercase letters, numbers, and hyphens'),
  
  body('fabric_name')
    .trim()
    .notEmpty()
    .withMessage('Fabric name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Fabric name must be 2-200 characters'),
  
  body('category_id')
    .notEmpty()
    .withMessage('Category is required')
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  
  body('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand must be less than 100 characters'),
  
  body('color')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Color must be less than 50 characters'),
  
  body('pattern')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Pattern must be less than 100 characters'),
  
  body('width_inches')
    .optional()
    .isFloat({ min: 0, max: 500 })
    .withMessage('Width must be a valid number between 0 and 500'),
  
  body('gsm')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('GSM must be a valid number'),
  
  body('cost_price')
    .notEmpty()
    .withMessage('Cost price is required')
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  
  body('selling_price')
    .notEmpty()
    .withMessage('Selling price is required')
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number')
    .custom((value, { req }) => {
      if (parseFloat(value) < parseFloat(req.body.cost_price)) {
        throw new Error('Selling price cannot be less than cost price');
      }
      return true;
    }),
  
  body('wholesale_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Wholesale price must be a positive number')
    .custom((value, { req }) => {
      if (value && parseFloat(value) < parseFloat(req.body.cost_price)) {
        throw new Error('Wholesale price cannot be less than cost price');
      }
      return true;
    }),
  
  body('price_unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid price unit. Must be: meter, yard, feet, inch, or centimeter'),
  
  body('track_by_roll')
    .optional()
    .isBoolean()
    .withMessage('Track by roll must be true or false'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('image_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
];

// Fabric validation (UPDATE) - all fields optional
const fabricUpdateValidation = [
  body('fabric_code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Fabric code must be 3-50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Fabric code can only contain uppercase letters, numbers, and hyphens'),
  
  body('fabric_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Fabric name must be 2-200 characters'),
  
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  
  body('width_inches')
    .optional()
    .isFloat({ min: 0, max: 500 })
    .withMessage('Width must be between 0 and 500'),
  
  body('gsm')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('GSM must be a valid number'),
  
  body('cost_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  
  body('selling_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number'),
  
  body('wholesale_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Wholesale price must be a positive number'),
  
  body('price_unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid price unit'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be true or false'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
];

// Fabric roll validation (CREATE)
const fabricRollValidation = [
  body('roll_code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Roll code must be 3-50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Roll code can only contain uppercase letters, numbers, and hyphens'),

  body('fabric_id')
    .notEmpty()
    .withMessage('Fabric ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid fabric ID'),

  body('initial_quantity')
    .notEmpty()
    .withMessage('Initial quantity is required')
    .isFloat({ min: 0.01 })
    .withMessage('Initial quantity must be greater than 0'),

  body('quantity_unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid quantity unit'),

  body('rack_location')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Rack location must be less than 50 characters'),

  body('supplier_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Supplier name must be less than 100 characters'),

  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid purchase date format (use YYYY-MM-DD)'),

  body('purchase_cost_per_unit')
    .notEmpty()
    .withMessage('Purchase cost is required')
    .isFloat({ min: 0 })
    .withMessage('Purchase cost must be a positive number'),

  body('cost_unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid cost unit'),
];

// Fabric roll update validation
const fabricRollUpdateValidation = [
  body('rack_location')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Rack location must be less than 50 characters'),

  body('supplier_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Supplier name must be less than 100 characters'),

  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid purchase date'),

  body('purchase_cost_per_meter')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Purchase cost must be a positive number'),

  body('status')
    .optional()
    .isIn(['active', 'finished', 'damaged'])
    .withMessage('Invalid status. Must be: active, finished, or damaged'),
];

// Meter adjustment validation (deduct/add)
const meterAdjustmentValidation = [
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),

  body('unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid unit'),

  body('reason')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be 3-500 characters'),
];

// Mark damaged validation
const markDamagedValidation = [
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be 5-500 characters'),
];

// Roll query validation
const fabricRollQueryValidation = [
  query('unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid display unit'),

  query('fabric_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid fabric ID'),

  query('status')
    .optional()
    .isIn(['active', 'finished', 'damaged'])
    .withMessage('Invalid status'),

  query('low_stock_only')
    .optional()
    .isBoolean()
    .withMessage('low_stock_only must be true or false'),

  query('min_meters')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('min_meters must be a positive number'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be 1-100 characters'),
];




// Query parameter validation for fabric listing
const fabricQueryValidation = [
  query('unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter'])
    .withMessage('Invalid display unit'),
  
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be true or false'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be 1-100 characters'),
];


// Accessory category validation
const accessoryCategoryValidation = [
  body('category_name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be 2-100 characters'),
];

// Accessory validation (CREATE)
const accessoryValidation = [
  body('accessory_code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Accessory code must be 3-50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Accessory code can only contain uppercase letters, numbers, and hyphens'),

  body('accessory_name')
    .trim()
    .notEmpty()
    .withMessage('Accessory name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Accessory name must be 2-200 characters'),

  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),

  body('unit')
    .notEmpty()
    .withMessage('Unit is required')
    .isIn(['piece', 'pack', 'box', 'meter', 'set'])
    .withMessage('Invalid unit. Must be: piece, pack, box, meter, or set'),

  body('pieces_per_pack')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pieces per pack must be at least 1'),

  body('cost_price')
    .notEmpty()
    .withMessage('Cost price is required')
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),

  body('selling_price')
    .notEmpty()
    .withMessage('Selling price is required')
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number')
    .custom((value, { req }) => {
      if (parseFloat(value) < parseFloat(req.body.cost_price)) {
        throw new Error('Selling price cannot be less than cost price');
      }
      return true;
    }),

  body('current_stock')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Current stock must be a positive number'),

  body('min_stock_level')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum stock level must be a positive number'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
];

// Accessory update validation
const accessoryUpdateValidation = [
  body('accessory_code')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Accessory code must be 3-50 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Accessory code can only contain uppercase letters, numbers, and hyphens'),

  body('accessory_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Accessory name must be 2-200 characters'),

  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),

  body('unit')
    .optional()
    .isIn(['piece', 'pack', 'box', 'meter', 'set'])
    .withMessage('Invalid unit'),

  body('pieces_per_pack')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Pieces per pack must be at least 1'),

  body('cost_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),

  body('selling_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number'),

  body('min_stock_level')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum stock level must be a positive number'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be true or false'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
];

// Stock adjustment validation (for accessories)
const accessoryStockAdjustmentValidation = [
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),

  body('reason')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be 3-500 characters'),
];

// Accessory query validation
const accessoryQueryValidation = [
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),

  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be true or false'),

  query('low_stock_only')
    .optional()
    .isBoolean()
    .withMessage('low_stock_only must be true or false'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be 1-100 characters'),
];


// Sale item validation
const saleItemValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),

  body('items.*.item_type')
    .isIn(['fabric', 'accessory'])
    .withMessage('Item type must be fabric or accessory'),

  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),

  body('items.*.unit')
    .optional()
    .isIn(['meter', 'yard', 'feet', 'inch', 'centimeter', 'piece', 'pack', 'box', 'set'])
    .withMessage('Invalid unit'),

  body('items.*.discount_percent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),

  // Validate fabric items
  body('items.*.roll_id')
    .if(body('items.*.item_type').equals('fabric'))
    .notEmpty()
    .withMessage('roll_id is required for fabric items')
    .isInt({ min: 1 })
    .withMessage('Invalid roll_id'),

  // Validate accessory items
  body('items.*.accessory_id')
    .if(body('items.*.item_type').equals('accessory'))
    .notEmpty()
    .withMessage('accessory_id is required for accessory items')
    .isInt({ min: 1 })
    .withMessage('Invalid accessory_id'),
];

// Sale validation
const saleValidation = [
  body('customer_name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Customer name must be less than 200 characters'),

  body('customer_phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),

  body('customer_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid customer ID'),

  body('discount_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discount amount must be a positive number'),

  body('tax_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax amount must be a positive number'),

  body('payment_method')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'card', 'bank_transfer', 'mobile_payment', 'credit'])
    .withMessage('Invalid payment method'),

  body('paid_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number'),

  body('salesperson_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Salesperson name must be less than 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  ...saleItemValidation,
];

// Update sale status validation
const saleStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['completed', 'pending', 'cancelled', 'returned'])
    .withMessage('Invalid status'),
];

// Add payment validation
const addPaymentValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),

  body('payment_method')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['cash', 'card', 'bank_transfer', 'mobile_payment'])
    .withMessage('Invalid payment method'),
];

// Sales query validation
const salesQueryValidation = [
  query('status')
    .optional()
    .isIn(['completed', 'pending', 'cancelled', 'returned'])
    .withMessage('Invalid status'),

  query('payment_method')
    .optional()
    .isIn(['cash', 'card', 'bank_transfer', 'mobile_payment', 'credit'])
    .withMessage('Invalid payment method'),

  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Invalid date_from format (use YYYY-MM-DD)'),

  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Invalid date_to format (use YYYY-MM-DD)'),

  query('customer_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid customer ID'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be 1-100 characters'),
];

// Customer validation
const customerValidation = [
  body('customer_name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Customer name must be 2-200 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),

  body('nic')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('NIC must be less than 20 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

// Customer update validation (all optional)
const customerUpdateValidation = [
  body('customer_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Customer name must be 2-200 characters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format')
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters'),

  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),

  body('nic')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('NIC must be less than 20 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
];

// Customer query validation
const customerQueryValidation = [
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be 1-100 characters'),

  query('has_credit')
    .optional()
    .isBoolean()
    .withMessage('has_credit must be true or false'),

  query('sort_by')
    .optional()
    .isIn(['customer_name', 'created_at', 'total_spent', 'outstanding_balance'])
    .withMessage('Invalid sort field'),

  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC'),
];


module.exports = {
  validate,
  loginValidation,
  fabricCategoryValidation,
  fabricValidation,
  fabricUpdateValidation,
  fabricQueryValidation,
  fabricRollValidation,
  fabricRollUpdateValidation,
  meterAdjustmentValidation,
  markDamagedValidation,
  fabricRollQueryValidation,
  accessoryCategoryValidation,
  accessoryValidation,
  accessoryUpdateValidation,
  accessoryStockAdjustmentValidation,
  accessoryQueryValidation,
  saleValidation,
  saleStatusValidation,
  addPaymentValidation,
  salesQueryValidation,
  customerValidation,
  customerUpdateValidation,
  customerQueryValidation,
};