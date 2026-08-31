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
const exceptionRoutes = require('./routes/exceptions');
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
app.use('/api/exceptions', exceptionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'FTC Backend is running' });
});

app.get('/api/analysis', async (req, res) => {
  try {
    const Wallet = require('./models/Wallet');
    const MonthlyWallet = require('./models/MonthlyWallet');
    const WalletTransaction = require('./models/WalletTransaction');
    const Invoice = require('./models/Invoice');
    const Vendor = require('./models/Vendor');

    const wallets = await Wallet.find().lean();
    const walletAnalysis = [];

    for (const w of wallets) {
      const filter = { $or: [{ wallet: w._id }, { label: w.name }] };
      const mws = await MonthlyWallet.find(filter).lean();
      const credSum = mws.reduce((s, m) => s + (m.creditedAmount || 0), 0);
      const balSum = mws.reduce((s, m) => s + (m.balance || 0), 0);

      const mwIds = mws.map(m => m._id);
      const txns = await WalletTransaction.find({
        $or: [{ monthlyWallet: { $in: mwIds } }, { walletLabel: w.name }]
      }).lean();

      const credTxns = txns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
      const debTxnsAll = txns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
      const debTxnsInv = txns.filter(t => t.type === 'debit' && t.invoice != null).reduce((s, t) => s + (t.amount || 0), 0);
      const debTxnsNoInv = txns.filter(t => t.type === 'debit' && t.invoice == null).reduce((s, t) => s + (t.amount || 0), 0);

      walletAnalysis.push({
        id: w._id,
        name: w.name,
        partyCount: mws.length,
        sumCreditedAmountInDB: credSum,
        sumBalanceFieldInDB: balSum,
        sumTxnCredits: credTxns,
        sumTxnDebitsAll: debTxnsAll,
        sumTxnDebitsInvoice: debTxnsInv,
        sumTxnDebitsNoInvoice: debTxnsNoInv,
        creditedMinusAllDebits: credTxns - debTxnsAll,
        creditedMinusInvoiceDebits: credTxns - debTxnsInv,
      });
    }

    const allTxns = await WalletTransaction.find().lean();
    const allCredits = allTxns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
    const allDebitsAll = allTxns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
    const allDebitsInv = allTxns.filter(t => t.type === 'debit' && t.invoice != null).reduce((s, t) => s + (t.amount || 0), 0);
    const allDebitsNoInv = allTxns.filter(t => t.type === 'debit' && t.invoice == null).reduce((s, t) => s + (t.amount || 0), 0);

    const invoices = await Invoice.find({ status: { $ne: 'Cancelled' } }).lean();
    const totalInvoiceAmount = invoices.reduce((s, i) => s + (i.totalAmount || i.invoiceAmount || 0), 0);

    const vendors = await Vendor.find().lean();
    const vendorBalSum = vendors.reduce((s, v) => s + (v.walletBalance || 0), 0);

    res.json({
      success: true,
      walletAnalysis,
      overall: {
        allCredits,
        allDebitsAll,
        allDebitsInv,
        allDebitsNoInv,
        creditsMinusAllDebits: allCredits - allDebitsAll,
        creditsMinusInvoiceDebits: allCredits - allDebitsInv,
        totalInvoiceAmount,
        vendorBalSum,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
