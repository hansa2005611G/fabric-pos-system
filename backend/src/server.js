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

app.use('/api/auth', authRoutes);
app.use('/api/fabric-categories', fabricCategoryRoutes);
app.use('/api/fabrics', fabricRoutes); 

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
});