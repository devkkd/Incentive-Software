require('dotenv').config();
const mongoose = require('mongoose');

const Wallet = require('./src/models/Wallet');
const MonthlyWallet = require('./src/models/MonthlyWallet');
const Vendor = require('./src/models/Vendor');
const WalletTransaction = require('./src/models/WalletTransaction');
const Invoice = require('./src/models/Invoice');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const wallets = await Wallet.find().lean();
  console.log('=== WALLETS ===');
  for (const w of wallets) {
    const filter = { $or: [{ wallet: w._id }, { label: w.name }] };
    const partyWallets = await MonthlyWallet.find(filter).lean();
    const totalBal = partyWallets.reduce((s, pw) => s + (pw.balance || 0), 0);
    const totalCred = partyWallets.reduce((s, pw) => s + (pw.creditedAmount || 0), 0);
    console.log(`Wallet: "${w.name}" (ID: ${w._id}) => count: ${partyWallets.length}, totalBalance: ${totalBal.toFixed(2)}, totalCredited: ${totalCred.toFixed(2)}`);
  }

  const allMonthlyWallets = await MonthlyWallet.find().lean();
  const sumMwBalance = allMonthlyWallets.reduce((s, m) => s + (m.balance || 0), 0);
  const sumMwCredited = allMonthlyWallets.reduce((s, m) => s + (m.creditedAmount || 0), 0);
  console.log(`\nALL MonthlyWallet docs count: ${allMonthlyWallets.length}`);
  console.log(`Sum MonthlyWallet.balance: ${sumMwBalance.toFixed(2)}`);
  console.log(`Sum MonthlyWallet.creditedAmount: ${sumMwCredited.toFixed(2)}`);

  const vendors = await Vendor.find().select('walletBalance companyName').lean();
  const sumVendorBalance = vendors.reduce((s, v) => s + (v.walletBalance || 0), 0);
  console.log(`\nSum Vendor.walletBalance: ${sumVendorBalance.toFixed(2)}`);

  const creditAgg = await WalletTransaction.aggregate([
    { $match: { type: 'credit' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalCreditedTxn = creditAgg[0]?.total || 0;

  const debitAgg = await WalletTransaction.aggregate([
    { $match: { type: 'debit', invoice: { $ne: null } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalRedeemedTxn = debitAgg[0]?.total || 0;

  console.log(`\nWalletTransaction credits sum: ${totalCreditedTxn.toFixed(2)}`);
  console.log(`WalletTransaction debits sum: ${totalRedeemedTxn.toFixed(2)}`);
  console.log(`Difference (Credits - Debits): ${(totalCreditedTxn - totalRedeemedTxn).toFixed(2)}`);

  // Inspect invoices redemptions breakdown
  const invoices = await Invoice.find({ status: { $ne: 'Cancelled' } }).lean();
  let totalInvoiceAmount = 0;
  let totalMwDeductedFromInvoices = 0;
  for (const inv of invoices) {
    totalInvoiceAmount += (inv.totalAmount || 0);
    if (inv.redemptions && inv.redemptions.length > 0) {
      totalMwDeductedFromInvoices += inv.redemptions.reduce((s, r) => s + (r.amount || 0), 0);
    }
  }
  console.log(`\nTotal Invoices (not cancelled): ${invoices.length}, sum totalAmount: ${totalInvoiceAmount.toFixed(2)}`);
  console.log(`Total redemptions recorded inside invoice.redemptions array: ${totalMwDeductedFromInvoices.toFixed(2)}`);

  await mongoose.disconnect();
}

run().catch(console.error);
