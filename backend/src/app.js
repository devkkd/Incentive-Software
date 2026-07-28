require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const invoiceRoutes = require('./routes/invoices');
const incentiveRoutes = require('./routes/incentives');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const divisionRoutes = require('./routes/divisions');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const walletRoutes = require('./routes/wallets');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow all Vercel deployments + localhost
    const isVercel = origin && (origin.includes('.vercel.app') || origin.includes('vercel.app'));
    const isLocalhost = !origin || origin.includes('localhost');
    const isExplicit = origin && process.env.FRONTEND_URL && origin.replace(/\/$/, '') === process.env.FRONTEND_URL.replace(/\/$/, '');

    if (isLocalhost || isVercel || isExplicit) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/incentives', incentiveRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/divisions', divisionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'FTC Backend is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
