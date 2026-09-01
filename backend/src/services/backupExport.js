const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const Vendor = require('../models/Vendor');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const WalletTransaction = require('../models/WalletTransaction');
const Invoice = require('../models/Invoice');
const Division = require('../models/Division');
const IncentiveUpload = require('../models/IncentiveUpload');
const DeletedParty = require('../models/DeletedParty');

/**
 * POINT 26 — nightly Excel snapshot.
 *
 * Complements the Atlas database backup. That protects the data; this is the
 * human-readable layer, so that if the application is unavailable head office
 * still has the numbers in a form they can open and act on.
 *
 * READ ONLY — this builds a workbook and uploads it. It writes nothing to the
 * database.
 *
 * Uploads to Google Drive when configured. If Drive is not set up the file is
 * still generated and kept locally, so the export is useful before the Google
 * credentials exist.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const money = (n) => parseFloat((n || 0).toFixed(2));
const dateStr = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

// ─────────────────────────────────────────────────────────────────────────────
// Build the workbook
// ─────────────────────────────────────────────────────────────────────────────
async function buildWorkbook() {
  const generatedAt = new Date();
  const stamp = generatedAt.toLocaleString('en-IN');

  const [vendors, wallets, monthlyWallets, divisions] = await Promise.all([
    Vendor.find().populate('division', 'name').lean(),
    Wallet.find().lean(),
    MonthlyWallet.find().populate('vendor', 'companyName accountNumber').lean(),
    Division.find().lean(),
  ]);

  const walletById = new Map(wallets.map((w) => [String(w._id), w]));

  // Sub-wallet totals per party, so Party Balances can show both figures
  const subTotals = new Map();
  for (const mw of monthlyWallets) {
    const k = String(mw.vendor?._id || mw.vendor);
    subTotals.set(k, (subTotals.get(k) || 0) + (mw.balance || 0));
  }

  const sheets = {};

  // ── 1. Party Balances — what branches would need if the system is down ────
  sheets['Party Balances'] = vendors.map((v) => ({
    'Party Code': v.accountNumber,
    'Party Name': v.companyName,
    'Contact Person': v.personName,
    'Mobile Number': v.mobileNumber,
    'Party City': v.partyCity,
    'Party Type': v.partyType,
    'Location': v.division?.name || '',
    'Salesperson': v.salesPerson,
    'Status': v.status,
    'Current Balance': money(v.walletBalance),
    'Sub-wallet Total': money(subTotals.get(String(v._id)) || 0),
    'Difference': money((subTotals.get(String(v._id)) || 0) - (v.walletBalance || 0)),
  }));

  // ── 2. Party x Wallet — the grid. The most important sheet for rebuilding ─
  sheets['Party x Wallet'] = monthlyWallets.map((mw) => {
    const parent = mw.wallet ? walletById.get(String(mw.wallet)) : null;
    return {
      'Party Code': mw.vendor?.accountNumber || '(deleted party)',
      'Party Name': mw.vendor?.companyName || '(deleted party)',
      'Scheme': parent?.name || mw.label || '',
      'Month': mw.month ? MONTHS[mw.month - 1] : '',
      'Year': mw.year || '',
      'Credited Amount': money(mw.creditedAmount),
      'Current Balance': money(mw.balance),
      'On Hold': mw.isHold ? 'Yes' : 'No',
      'Hold Reason': mw.holdReason || '',
      'Scheme On Hold': parent?.isHold ? 'Yes' : 'No',
    };
  });

  // ── 3. Transaction Ledger — the audit record ──────────────────────────────
  const txns = await WalletTransaction.find()
    .populate('vendor', 'companyName accountNumber')
    .populate('invoice', 'invoiceNumber referenceNo')
    .populate('processedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  sheets['Transaction Ledger'] = txns.map((t) => ({
    'Date': dateStr(t.createdAt),
    'Party Code': t.vendor?.accountNumber || '(deleted party)',
    'Party Name': t.vendor?.companyName || '(deleted party)',
    'Type': t.type === 'credit' ? 'Credit' : 'Debit',
    'Amount': money(t.amount),
    'Balance After': money(t.balanceAfter),
    'Wallet': t.walletLabel || '',
    'Invoice Number': t.invoice?.invoiceNumber || '',
    'Reference Number': t.invoice?.referenceNo || '',
    'Description': t.description || '',
    'Processed By': t.processedBy?.name || '',
  }));

  // ── 4. Invoices ───────────────────────────────────────────────────────────
  const invoices = await Invoice.find()
    .populate('vendor', 'companyName accountNumber')
    .populate('division', 'name')
    .sort({ createdAt: -1 })
    .lean();

  sheets['Invoices'] = invoices.map((i) => ({
    'Invoice Number': i.invoiceNumber,
    'Reference Number': i.referenceNo,
    'Invoice Date': dateStr(i.invoiceDate),
    'Party Code': i.vendor?.accountNumber || '(deleted party)',
    'Party Name': i.vendor?.companyName || '(deleted party)',
    'Location': i.division?.name || i.location || '',
    'Invoice Amount': money(i.invoiceAmount),
    'Redeemed Amount': money(i.redeemedAmount),
    'Status': i.status,
    'Remark': i.remark || '',
  }));

  // ── 5. Wallet Summary — reconciles against Wallet Management ──────────────
  sheets['Wallet Summary'] = wallets.map((w) => {
    const rows = monthlyWallets.filter(
      (mw) => String(mw.wallet) === String(w._id) || mw.label === w.name
    );
    const held = rows.filter((mw) => w.isHold || mw.isHold);
    return {
      'Scheme': w.name,
      'Month': w.month ? MONTHS[w.month - 1] : '',
      'Year': w.year || '',
      'Parties': rows.length,
      'Total Credited': money(rows.reduce((a, c) => a + (c.creditedAmount || 0), 0)),
      'Current Balance': money(rows.reduce((a, c) => a + (c.balance || 0), 0)),
      'On Hold': money(held.reduce((a, c) => a + (c.balance || 0), 0)),
      'Scheme On Hold': w.isHold ? 'Yes' : 'No',
      'Notice': w.noticeEnabled ? w.noticeMessage : '',
      'Lapse Date': dateStr(w.lapseDate),
    };
  });

  // ── 6. Branches ───────────────────────────────────────────────────────────
  sheets['Branches'] = divisions.map((d) => ({
    'Location': d.name,
    'Location Code': d.locationCode,
    'City': d.location,
    'Invoice Count': d.invoiceCount || 0,
    'Status': d.isActive ? 'Active' : 'Inactive',
  }));

  // ── 7. Upload History ─────────────────────────────────────────────────────
  const uploads = await IncentiveUpload.find()
    .populate('uploadedBy', 'name')
    .populate('division', 'name')
    .sort({ createdAt: -1 })
    .lean();

  sheets['Upload History'] = uploads.map((u) => ({
    'Date': dateStr(u.createdAt),
    'File Name': u.fileName,
    'Scheme': u.walletLabel || '',
    'Month': u.month ? MONTHS[u.month - 1] : '',
    'Year': u.year || '',
    'Parties': u.items?.length || 0,
    'Total Amount': money(u.totalAmount),
    'Frequency': u.frequency || '',
    'Status': u.status,
    'Uploaded By': u.uploadedBy?.name || '',
  }));

  // ── 8. Deleted Parties ────────────────────────────────────────────────────
  const deleted = await DeletedParty.find().sort({ createdAt: -1 }).lean();
  sheets['Deleted Parties'] = deleted.map((d) => ({
    'Deleted On': dateStr(d.createdAt),
    'Party Code': d.accountNumber || '',
    'Party Name': d.companyName || '',
    'Mobile Number': d.mobileNumber || '',
    'Location': d.divisionName || '',
    'Balance At Deletion': money(d.walletBalanceAtDeletion),
    'Deleted By': d.deletedByName || '',
    'Reason': d.deletionReason || '',
  }));

  // ── Assemble ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // A cover sheet, so an exported file explains itself
  const cover = [
    { Field: 'Generated', Value: stamp },
    { Field: 'Source', Value: 'FTC Incentive Management System' },
    { Field: '', Value: '' },
    ...Object.entries(sheets).map(([name, rows]) => ({
      Field: name, Value: `${rows.length} rows`,
    })),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cover), 'About');

  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel tab limit
  }

  const y = generatedAt.getFullYear();
  const m = String(generatedAt.getMonth() + 1).padStart(2, '0');
  const d = String(generatedAt.getDate()).padStart(2, '0');
  const fileName = `FTC_Backup_${y}-${m}-${d}.xlsx`;

  const filePath = path.join(os.tmpdir(), fileName);
  XLSX.writeFile(wb, filePath);

  const counts = Object.fromEntries(
    Object.entries(sheets).map(([k, v]) => [k, v.length])
  );

  return { filePath, fileName, generatedAt, counts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery — email
//
// Chosen over Google Drive deliberately. Drive on a personal Gmail account
// needs an OAuth app, a refresh token that expires if the app is left
// unpublished, and a Google Cloud project. Email uses the mail account already
// configured for OTPs — nothing new to set up, and nothing to expire.
//
// The mailbox becomes the archive, searchable by date, with no retention job
// to run.
// ─────────────────────────────────────────────────────────────────────────────
function emailConfigured() {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function backupRecipient() {
  // Falls back to the mail account itself if no separate address is set
  return process.env.BACKUP_EMAIL_TO || process.env.EMAIL_USER;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
async function runBackup() {
  const built = await buildWorkbook();
  const result = { ...built, sent: false, sentTo: null, error: null };

  if (!emailConfigured()) {
    console.log(`[backup] email not configured — file kept at ${built.filePath}`);
    return result;
  }

  try {
    const { sendBackupEmail } = require('../config/email');
    const to = backupRecipient();

    await sendBackupEmail({
      toEmail: to,
      filePath: built.filePath,
      fileName: built.fileName,
      generatedAt: built.generatedAt,
      counts: built.counts,
    });

    result.sent = true;
    result.sentTo = to;
    fs.unlink(built.filePath, () => {});   // remove the temp copy
    console.log(`[backup] ${built.fileName} emailed to ${to}`);
  } catch (err) {
    // Never fail silently. A backup that stopped working weeks ago is
    // discovered at exactly the wrong moment.
    console.error('[backup] EMAIL FAILED —', err.message);
    console.error(`[backup] the file is still on disk at ${built.filePath}`);
    result.error = err.message;
  }

  return result;
}

module.exports = { runBackup, buildWorkbook, emailConfigured };
