require('dotenv').config();
const mongoose = require('mongoose');

const Wallet = require('./src/models/Wallet');
const MonthlyWallet = require('./src/models/MonthlyWallet');
const Vendor = require('./src/models/Vendor');
const WalletTransaction = require('./src/models/WalletTransaction');
const Invoice = require('./src/models/Invoice');
const IncentiveUpload = require('./src/models/IncentiveUpload');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('--- DEEP DATA ANALYSIS ---\n');

  // 1. Wallets
  const wallets = await Wallet.find().lean();
  console.log('=== WALLETS MASTER ===');
  for (const w of wallets) {
    console.log(`Wallet ID: ${w._id}, Name: "${w.name}", Month: ${w.month}, Year: ${w.year}`);
  }

  // 2. MonthlyWallet breakdown per wallet name
  console.log('\n=== MONTHLY WALLET BREAKDOWN ===');
  for (const w of wallets) {
    const filter = { $or: [{ wallet: w._id }, { label: w.name }] };
    const mws = await MonthlyWallet.find(filter).lean();
    const credSum = mws.reduce((s, m) => s + (m.creditedAmount || 0), 0);
    const balSum = mws.reduce((s, m) => s + (m.balance || 0), 0);
    console.log(`\nMaster Wallet: "${w.name}" (${mws.length} party records):`);
    console.log(`  Sum creditedAmount: ₹${credSum.toFixed(2)}`);
    console.log(`  Sum balance (current field in DB): ₹${balSum.toFixed(2)}`);

    // Get all transactions for these monthly wallets
    const mwIds = mws.map(m => m._id);
    const txns = await WalletTransaction.find({ monthlyWallet: { $in: mwIds } }).lean();
    const credTxns = txns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
    const debTxnsAll = txns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
    const debTxnsInv = txns.filter(t => t.type === 'debit' && t.invoice != null).reduce((s, t) => s + (t.amount || 0), 0);
    const debTxnsNoInv = txns.filter(t => t.type === 'debit' && t.invoice == null).reduce((s, t) => s + (t.amount || 0), 0);

    console.log(`  WalletTransactions linked to this wallet:`);
    console.log(`    Credits sum: ₹${credTxns.toFixed(2)} (${txns.filter(t => t.type === 'credit').length} txns)`);
    console.log(`    Debits (ALL) sum: ₹${debTxnsAll.toFixed(2)} (${txns.filter(t => t.type === 'debit').length} txns)`);
    console.log(`    Debits (Invoice linked) sum: ₹${debTxnsInv.toFixed(2)} (${txns.filter(t => t.type === 'debit' && t.invoice != null).length} txns)`);
    console.log(`    Debits (No Invoice) sum: ₹${debTxnsNoInv.toFixed(2)} (${txns.filter(t => t.type === 'debit' && t.invoice == null).length} txns)`);
  }

  // 3. Overall WalletTransactions
  console.log('\n=== OVERALL WALLET TRANSACTIONS ===');
  const allTxns = await WalletTransaction.find().lean();
  const allCred = allTxns.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
  const allDebAll = allTxns.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);
  const allDebInv = allTxns.filter(t => t.type === 'debit' && t.invoice != null).reduce((s, t) => s + (t.amount || 0), 0);
  const allDebNoInv = allTxns.filter(t => t.type === 'debit' && t.invoice == null).reduce((s, t) => s + (t.amount || 0), 0);
  const unlinkedDebits = allTxns.filter(t => t.type === 'debit' && !t.monthlyWallet);

  console.log(`Total Txns count: ${allTxns.length}`);
  console.log(`Total Credits sum: ₹${allCred.toFixed(2)}`);
  console.log(`Total Debits (ALL) sum: ₹${allDebAll.toFixed(2)}`);
  console.log(`Total Debits (Invoice != null) sum: ₹${allDebInv.toFixed(2)}`);
  console.log(`Total Debits (Invoice == null) sum: ₹${allDebNoInv.toFixed(2)}`);
  console.log(`Debits with NO monthlyWallet count: ${unlinkedDebits.length}, sum: ₹${unlinkedDebits.reduce((s,t) => s + (t.amount||0), 0).toFixed(2)}`);

  // 4. Invoices
  console.log('\n=== INVOICES ===');
  const invoices = await Invoice.find().lean();
  const validInvoices = invoices.filter(i => i.status !== 'Cancelled');
  const invSum = validInvoices.reduce((s, i) => s + (i.totalAmount || i.invoiceAmount || 0), 0);
  console.log(`Total Invoices count: ${invoices.length}`);
  console.log(`Valid (non-cancelled) Invoices count: ${validInvoices.length}`);
  console.log(`Sum of totalAmount for valid invoices: ₹${invSum.toFixed(2)}`);

  // Breakdown redemptions inside Invoice documents
  let invRedemptionSum = 0;
  for (const inv of validInvoices) {
    if (inv.redemptions && Array.isArray(inv.redemptions)) {
      invRedemptionSum += inv.redemptions.reduce((s, r) => s + (r.amount || 0), 0);
    }
  }
  console.log(`Sum of redemptions inside invoice.redemptions array: ₹${invRedemptionSum.toFixed(2)}`);

  // 5. Vendor balances
  const vendors = await Vendor.find().lean();
  const vendorBalSum = vendors.reduce((s, v) => s + (v.walletBalance || 0), 0);
  console.log(`\nTotal Vendors count: ${vendors.length}`);
  console.log(`Sum of Vendor.walletBalance: ₹${vendorBalSum.toFixed(2)}`);

  await mongoose.disconnect();
}

run().catch(console.error);
