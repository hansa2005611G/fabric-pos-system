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

module.exports = {
  validate,
  loginValidation,
  fabricCategoryValidation,
  fabricValidation,
  fabricUpdateValidation,
  fabricQueryValidation,
};