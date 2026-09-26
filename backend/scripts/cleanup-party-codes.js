/**
 * One-time party code cleanup (can also be done from Admin → Party List →
 * Duplicate Parties).
 *
 *   node scripts/cleanup-party-codes.js          → preview only, writes nothing
 *   node scripts/cleanup-party-codes.js --apply  → renames unique codes
 *
 * Duplicates (e.g. WSG-123 and JOH-123) are NOT touched — merge them from the
 * Duplicate Parties screen. Take a database backup before --apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { buildCodeReport, applyCodeCleanup } = require('../src/services/partyMerge');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const apply = process.argv.includes('--apply');
  const report = await buildCodeReport();

  console.log(`Parties: ${report.totalParties}`);
  console.log(`\nCodes to clean: ${report.renames.length}`);
  report.renames.forEach((r) => console.log(`  ${r.from.padEnd(24)} → ${r.to.padEnd(16)} ${r.companyName} (${r.branch})`));
  console.log(`\nDuplicate groups (merge these in the app): ${report.duplicates.length}`);
  report.duplicates.forEach((g) => console.log(`  ${g.code}: ${g.parties.map((p) => `${p.accountNumber} [₹${p.walletBalance}]`).join('  |  ')}`));

  if (apply) {
    const r = await applyCodeCleanup(null);
    console.log(`\nRenamed: ${r.renamed}. Skipped: ${r.skipped.length}.`);
    r.skipped.forEach((s) => console.log(`  skipped ${s.from}: ${s.reason}`));
    await new Promise((res) => setTimeout(res, 1500)); // let audit writes finish
  } else {
    console.log('\nPreview only. Run with --apply to rename.');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
