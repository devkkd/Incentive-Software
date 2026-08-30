/**
 * fixtures.js — build test parties in known wallet states
 *
 * Place in:  backend/fixtures.js
 * Run with:  node fixtures.js        (after `npm run seed`)
 * Reset:     node fixtures.js --reset
 *
 * Creates six parties, each demonstrating one wallet-balance flaw,
 * so you can reproduce every bug locally without any production data.
 *
 * SAFETY: refuses to run unless the database name contains "test" or "local".
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Vendor = require('./src/models/Vendor');
const Division = require('./src/models/Division');
const User = require('./src/models/User');
const Wallet = require('./src/models/Wallet');
const MonthlyWallet = require('./src/models/MonthlyWallet');
const IncentiveUpload = require('./src/models/IncentiveUpload');

const MONTHS = ['January','February','March','April','May','June','July','August',
                'September','October','November','December'];
const label = (m, y) => `${MONTHS[m - 1]} ${y}`;

// Every fixture party's account number starts with this, so --reset
// can find and remove them without touching anything else.
const TAG = 'ZTEST';

// ── Safety guard ────────────────────────────────────────────────────────────
function assertTestDatabase(uri) {
  const dbName = (uri.split('/').pop() || '').split('?')[0].toLowerCase();
  if (!dbName.includes('test') && !dbName.includes('local')) {
    console.error(`\n  REFUSING TO RUN.`);
    console.error(`  Database name is "${dbName}".`);
    console.error(`  This script only runs against a database with "test" or "local"`);
    console.error(`  in its name. Check MONGO_URI in your .env file.\n`);
    process.exit(1);
  }
  return dbName;
}

// ── Scenarios ───────────────────────────────────────────────────────────────
// masterBalance = what Vendor.walletBalance is set to
// wallets       = the MonthlyWallet rows created for that party
const SCENARIOS = [
  {
    code: 'ZTEST01',
    name: 'HEALTHY MOTORS',
    note: 'Control case. Master and sub-wallets agree.',
    masterBalance: 30000,
    wallets: [
      { month: 6, year: 2026, credited: 10000, balance: 10000 },
      { month: 7, year: 2026, credited: 20000, balance: 20000 },
    ],
    expect: 'Two wallets shown, Jun 10,000 and Jul 20,000. Totals match.',
  },
  {
    code: 'ZTEST02',
    name: 'ZERO MASTER MOTORS',
    note: 'Flaw 1 — early-exit guard. Master drifted to 0, sub-wallets still hold money.',
    masterBalance: 0,
    wallets: [
      { month: 7, year: 2026, credited: 15000, balance: 15000 },
    ],
    expect: 'Endpoint returns EMPTY. 15,000 is invisible and the party cannot transact.',
  },
  {
    code: 'ZTEST03',
    name: 'BACKWARD FIFO MOTORS',
    note: 'Flaw 3 — cap runs oldest-first while redemption drains oldest-first.',
    masterBalance: 6000,
    wallets: [
      { month: 7,  year: 2025, credited: 5000, balance: 5000 },
      { month: 12, year: 2025, credited: 5000, balance: 5000 },
    ],
    expect: 'Shows Jul-2025 5,000 + Dec-2025 1,000. Truth is Jul 0 + Dec 6,000. Total right, months wrong.',
  },
  {
    code: 'ZTEST04',
    name: 'HELD WALLET MOTORS',
    note: 'Flaw 4 — held wallets skip the loop without consuming the budget.',
    masterBalance: 6000,
    wallets: [
      { month: 7, year: 2026, credited: 4000, balance: 4000, isHold: true,
        holdReason: 'Disputed claim' },
      { month: 8, year: 2026, credited: 6000, balance: 6000 },
    ],
    expect: 'Shows Aug 6,000 as available. Only 2,000 is actually free once the held 4,000 is set aside.',
  },
  {
    code: 'ZTEST05',
    name: 'UNDER REPORT MOTORS',
    note: 'Sub-wallets under-represent master. sync-wallet-balances reports "already correct".',
    masterBalance: 20000,
    wallets: [
      { month: 7, year: 2026, credited: 5000, balance: 5000 },
    ],
    expect: 'Dashboard shows 20,000 but only 5,000 can be redeemed. 15,000 is stranded.',
  },
  {
    code: 'ZTEST06',
    name: 'AUTO CREATE MOTORS',
    note: 'Flaw 2 — three uploads, no MonthlyWallets. Fetch auto-creates using a stale balance.',
    masterBalance: 5000,
    wallets: [],
    uploads: [
      { month: 5, year: 2026, amount: 5000 },
      { month: 6, year: 2026, amount: 5000 },
      { month: 7, year: 2026, amount: 5000 },
    ],
    expect: 'First fetch WRITES three wallets of 5,000 each = 15,000 against a 5,000 master. Permanent corruption.',
  },
];

async function reset() {
  const vendors = await Vendor.find({ accountNumber: { $regex: `^${TAG}` } }).lean();
  const ids = vendors.map(v => v._id);
  await MonthlyWallet.deleteMany({ vendor: { $in: ids } });
  await IncentiveUpload.deleteMany({ 'items.vendor': { $in: ids } });
  await Vendor.deleteMany({ _id: { $in: ids } });
  await Wallet.deleteMany({ description: 'fixture' });
  console.log(`  Removed ${vendors.length} fixture parties and their wallets.`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('  MONGO_URI is not set. Check backend/.env');
    process.exit(1);
  }

  const dbName = assertTestDatabase(uri);
  await mongoose.connect(uri);
  console.log(`\n  Connected to "${dbName}"\n`);

  if (process.argv.includes('--reset')) {
    await reset();
    await mongoose.disconnect();
    return;
  }

  // Reuse whatever seed.js created
  const division = await Division.findOne();
  const admin = await User.findOne({ role: 'admin' });

  if (!division || !admin) {
    console.error('  No division or admin user found. Run `npm run seed` first.\n');
    process.exit(1);
  }

  await reset(); // idempotent — safe to re-run

  console.log('');

  for (const s of SCENARIOS) {
    const vendor = await Vendor.create({
      companyName: s.name,
      personName: 'Test Contact',
      accountNumber: s.code,
      // 90000 00001 .. 90000 00006 — obviously fake, never a real number
      mobileNumber: `9000000${String(SCENARIOS.indexOf(s) + 1).padStart(3, '0')}`,
      address: 'Fixture data — not a real party',
      division: division._id,
      status: 'active',
      walletBalance: s.masterBalance,
    });

    for (const w of (s.wallets || [])) {
      const lbl = label(w.month, w.year);

      let master = await Wallet.findOne({ name: lbl });
      if (!master) {
        master = await Wallet.create({
          name: lbl,
          month: w.month,
          year: w.year,
          description: 'fixture',
          createdBy: admin._id,
        });
      }

      await MonthlyWallet.create({
        vendor: vendor._id,
        month: w.month,
        year: w.year,
        label: lbl,
        creditedAmount: w.credited,
        balance: w.balance,
        wallet: master._id,
        isHold: w.isHold || false,
        holdReason: w.holdReason || null,
      });
    }

    // Uploads with deliberately NO MonthlyWallet rows
    for (const u of (s.uploads || [])) {
      await IncentiveUpload.create({
        division: division._id,
        uploadedBy: admin._id,
        fileName: `fixture_${label(u.month, u.year).replace(' ', '_')}.xlsx`,
        totalAmount: u.amount,
        frequency: 'monthly',
        month: u.month,
        year: u.year,
        walletLabel: label(u.month, u.year),
        status: 'processed',
        items: [{ vendor: vendor._id, amount: u.amount }],
      });
    }

    const subTotal = (s.wallets || []).reduce((t, w) => t + w.balance, 0);
    const drift = subTotal - s.masterBalance;

    console.log(`  ${s.code}  ${s.name}`);
    console.log(`     ${s.note}`);
    console.log(`     master: ${s.masterBalance.toLocaleString('en-IN')}   ` +
                `sub-wallets: ${subTotal.toLocaleString('en-IN')}   ` +
                `drift: ${drift >= 0 ? '+' : ''}${drift.toLocaleString('en-IN')}`);
    console.log(`     expect: ${s.expect}`);
    console.log('');
  }

  console.log('  Done. Open the branch dashboard and search for "ZTEST" to find them.');
  console.log('  Compare each party against its "expect" line above.');
  console.log('  Re-run any time to reset them to a clean starting state.\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
