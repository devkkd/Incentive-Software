/**
 * Quick balance reconciliation check
 * Run: node check-balance.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const WalletTransaction = require('./src/models/WalletTransaction');
  const Vendor = require('./src/models/Vendor');

  // 1. WalletTransaction credits
  const credits = await WalletTransaction.aggregate([
    { $match: { type: 'credit' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // 2. WalletTransaction debits — ALL
  const debitsAll = await WalletTransaction.aggregate([
    { $match: { type: 'debit' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // 3. WalletTransaction debits — invoice linked only
  const debitsInvoice = await WalletTransaction.aggregate([
    { $match: { type: 'debit', invoice: { $ne: null } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // 4. WalletTransaction debits — NO invoice (standalone /redeem route)
  const debitsStandalone = await WalletTransaction.aggregate([
    { $match: { type: 'debit', invoice: null } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // 5. Vendor.walletBalance sum
  const vendors = await Vendor.aggregate([
    { $group: { _id: null, total: { $sum: '$walletBalance' }, count: { $sum: 1 } } }
  ]);

  const totalCredits      = credits[0]?.total || 0;
  const totalDebitsAll    = debitsAll[0]?.total || 0;
  const totalDebitsInv    = debitsInvoice[0]?.total || 0;
  const totalDebitsAlone  = debitsStandalone[0]?.total || 0;
  const vendorBalSum      = vendors[0]?.total || 0;

  console.log('='.repeat(55));
  console.log('BALANCE RECONCILIATION CHECK');
  console.log('='.repeat(55));
  console.log(`Total Credits (WalletTxn):         ₹${totalCredits.toFixed(2)}   (${credits[0]?.count || 0} records)`);
  console.log(`Total Debits ALL:                  ₹${totalDebitsAll.toFixed(2)}   (${debitsAll[0]?.count || 0} records)`);
  console.log(`  ↳ Invoice-linked debits:         ₹${totalDebitsInv.toFixed(2)}   (${debitsInvoice[0]?.count || 0} records)`);
  console.log(`  ↳ Standalone debits (no invoice):₹${totalDebitsAlone.toFixed(2)}   (${debitsStandalone[0]?.count || 0} records)`);
  console.log('-'.repeat(55));
  console.log(`Vendor.walletBalance sum:          ₹${vendorBalSum.toFixed(2)}   (actual remaining)`);
  console.log('-'.repeat(55));
  console.log(`Credits - ALL debits:              ₹${(totalCredits - totalDebitsAll).toFixed(2)}`);
  console.log(`Credits - Invoice debits only:     ₹${(totalCredits - totalDebitsInv).toFixed(2)}`);
  console.log('-'.repeat(55));
  console.log(`Matches Vendor.walletBalance?`);
  console.log(`  Using ALL debits:    ${Math.abs(vendorBalSum - (totalCredits - totalDebitsAll)) < 1 ? '✅ YES' : '❌ NO — gap: ₹' + Math.abs(vendorBalSum - (totalCredits - totalDebitsAll)).toFixed(2)}`);
  console.log(`  Using Invoice only:  ${Math.abs(vendorBalSum - (totalCredits - totalDebitsInv)) < 1 ? '✅ YES' : '❌ NO — gap: ₹' + Math.abs(vendorBalSum - (totalCredits - totalDebitsInv)).toFixed(2)}`);
  console.log('='.repeat(55));

  await mongoose.disconnect();
}

main().catch(console.error);
