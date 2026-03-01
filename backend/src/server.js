const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Fabric POS API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Routes - MAKE SURE THESE LINES EXIST
const authRoutes = require('./routes/authRoutes');
const fabricCategoryRoutes = require('./routes/fabricCategoryRoutes');
const fabricRoutes = require('./routes/fabricRoutes');
const fabricRollRoutes = require('./routes/fabricRollRoutes');
const accessoryCategoryRoutes = require('./routes/accessoryCategoryRoutes'); 
const accessoryRoutes = require('./routes/accessoryRoutes');  
const salesRoutes = require('./routes/salesRoutes');
const customerRoutes = require('./routes/customerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const searchRoutes = require('./routes/searchRoutes');
const barcodeRoutes = require('./routes/barcodeRoutes');
const exportRoutes = require('./routes/exportRoutes');
const importRoutes = require('./routes/importRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/fabric-categories', fabricCategoryRoutes);
app.use('/api/fabrics', fabricRoutes); 
app.use('/api/fabric-rolls', fabricRollRoutes);
app.use('/api/accessory-categories', accessoryCategoryRoutes); 
app.use('/api/accessories', accessoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler - MUST BE AFTER ROUTES
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API Base: http://localhost:${PORT}/api`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/login`);
  console.log(`📦 Fabric Categories: http://localhost:${PORT}/api/fabric-categories`);
  console.log(`🧵 Fabrics: http://localhost:${PORT}/api/fabrics`);
  console.log(`📏 Fabric Rolls: http://localhost:${PORT}/api/fabric-rolls`);
  console.log(`🔗 Accessory Categories: http://localhost:${PORT}/api/accessory-categories`);
  console.log(`🧷 Accessories: http://localhost:${PORT}/api/accessories`);
  console.log(`💰 Sales: http://localhost:${PORT}/api/sales`);
  console.log(`👥 Customers: http://localhost:${PORT}/api/customers`);
  console.log(`📊 Reports: http://localhost:${PORT}/api/reports`);
  console.log(`📈 Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`🔍 Search: http://localhost:${PORT}/api/search`);
  console.log(`📇 Barcodes: http://localhost:${PORT}/api/barcodes`);
  console.log(`📤 Export: http://localhost:${PORT}/api/export`);
  console.log(`📥 Import: http://localhost:${PORT}/api/import`);
  console.log(`🔔 Notifications: http://localhost:${PORT}/api/notifications`);
});