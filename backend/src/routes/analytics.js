const express = require('express');
const Vendor = require('../models/Vendor');
const Wallet = require('../models/Wallet');
const MonthlyWallet = require('../models/MonthlyWallet');
const WalletTransaction = require('../models/WalletTransaction');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * POINT 20.1 — INCENTIVE LIABILITY AGEING
 *
 * How old is the money we owe parties, and how much of it is dead?
 *
 * Outstanding incentive is a liability sitting on the books. The total alone
 * does not tell you much — ₹8 lakh that will be redeemed next month is a very
 * different thing from ₹8 lakh untouched for two years. This splits it by age.
 *
 * AGEING BASIS: each MonthlyWallet represents one month's credit, so age is
 * measured from that wallet's own month and year. No FIFO assumption is
 * needed — the wallet *is* the vintage.
 *
 * READ ONLY. Writes nothing.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const round = (n) => parseFloat((n || 0).toFixed(2));

const BUCKETS = [
  { key: 'b0_3',   label: '0–3 months',   min: 0,  max: 3 },
  { key: 'b3_6',   label: '3–6 months',   min: 3,  max: 6 },
  { key: 'b6_12',  label: '6–12 months',  min: 6,  max: 12 },
  { key: 'b12_24', label: '12–24 months', min: 12, max: 24 },
  { key: 'b24',    label: '24+ months',   min: 24, max: Infinity },
];

const bucketFor = (months) =>
  BUCKETS.find((b) => months >= b.min && months < b.max)?.key || 'b24';

// @route   GET /api/reports/liability-ageing
// @desc    Outstanding balance split by how old the credit is
// @access  Admin
router.get('/liability-ageing', protect, authorize('admin'), async (req, res) => {
  try {
    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + now.getMonth();

    const [wallets, monthlyWallets] = await Promise.all([
      Wallet.find().select('_id name isHold').lean(),
      MonthlyWallet.find({ balance: { $ne: 0 } })
        .populate('vendor', 'companyName accountNumber partyType partyCity salesPerson status division')
        .lean(),
    ]);

    const walletById = new Map(wallets.map((w) => [String(w._id), w]));

    // Branch names, for the by-branch view
    const divisions = await require('../models/Division').find().select('_id name').lean();
    const divisionById = new Map(divisions.map((d) => [String(d._id), d.name]));

    const blank = () => Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));

    const byParty = new Map();
    const byScheme = new Map();
    const byBranch = new Map();
    const totals = blank();
    let heldTotal = 0;
    let orphanTotal = 0;

    for (const mw of monthlyWallets) {
      const balance = mw.balance || 0;
      if (!balance) continue;

      // Records whose party no longer exists are reported separately rather
      // than being silently folded into the ageing figures.
      if (!mw.vendor) {
        orphanTotal += balance;
        continue;
      }

      const parent = mw.wallet ? walletById.get(String(mw.wallet)) : null;
      const held = mw.isHold || parent?.isHold;

      // Held money is a liability too, but it cannot be redeemed, so it is
      // shown apart from the ageing buckets.
      if (held) {
        heldTotal += balance;
        continue;
      }

      const ageMonths =
        mw.year && mw.month ? nowMonths - (mw.year * 12 + (mw.month - 1)) : 0;
      const bucket = bucketFor(Math.max(0, ageMonths));

      totals[bucket] += balance;

      // ── by party ──
      const pk = String(mw.vendor._id);
      if (!byParty.has(pk)) {
        byParty.set(pk, {
          partyCode: mw.vendor.accountNumber,
          partyName: mw.vendor.companyName,
          partyType: mw.vendor.partyType || '',
          partyCity: mw.vendor.partyCity || '',
          salesPerson: mw.vendor.salesPerson || '',
          location: divisionById.get(String(mw.vendor.division)) || '',
          status: mw.vendor.status,
          ...blank(),
          total: 0,
          oldestMonths: 0,
        });
      }
      const pr = byParty.get(pk);
      pr[bucket] += balance;
      pr.total += balance;
      pr.oldestMonths = Math.max(pr.oldestMonths, ageMonths);

      // ── by scheme ──
      const sk = parent?.name || mw.label || '(no scheme)';
      if (!byScheme.has(sk)) byScheme.set(sk, { scheme: sk, ...blank(), total: 0, parties: new Set() });
      const sr = byScheme.get(sk);
      sr[bucket] += balance;
      sr.total += balance;
      sr.parties.add(pk);

      // ── by branch ──
      const bk = divisionById.get(String(mw.vendor.division)) || '(no branch)';
      if (!byBranch.has(bk)) byBranch.set(bk, { location: bk, ...blank(), total: 0, parties: new Set() });
      const br = byBranch.get(bk);
      br[bucket] += balance;
      br.total += balance;
      br.parties.add(pk);
    }

    const roundRow = (r) => {
      const out = { ...r };
      for (const b of BUCKETS) out[b.key] = round(out[b.key]);
      out.total = round(out.total);
      if (out.parties instanceof Set) out.parties = out.parties.size;
      return out;
    };

    const liveTotal = round(Object.values(totals).reduce((a, b) => a + b, 0));
    const over12 = round(totals.b12_24 + totals.b24);

    res.status(200).json({
      success: true,
      generatedAt: now,
      buckets: BUCKETS.map(({ key, label }) => ({ key, label })),
      summary: {
        totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v)])),
        redeemableTotal: liveTotal,
        heldTotal: round(heldTotal),
        orphanTotal: round(orphanTotal),
        grandTotal: round(liveTotal + heldTotal + orphanTotal),
        over12Months: over12,
        over12Percent: liveTotal > 0 ? round((over12 / liveTotal) * 100) : 0,
      },
      byParty: [...byParty.values()].map(roundRow).sort((a, b) => b.total - a.total),
      byScheme: [...byScheme.values()].map(roundRow).sort((a, b) => b.total - a.total),
      byBranch: [...byBranch.values()].map(roundRow).sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error('[liability-ageing]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.4 — DORMANT PARTIES
 *
 * Parties holding a balance who have not redeemed within the chosen window.
 *
 * Split into two groups, because they need different action:
 *   - Never redeemed  — likely does not know the balance exists. A phone call.
 *   - Stopped redeeming — used to redeem, then stopped. Possibly buying elsewhere.
 *
 * READ ONLY.
 */
// @route   GET /api/analytics/dormant-parties?months=6&minBalance=0
// @desc    Parties sitting on money who have stopped redeeming
// @access  Admin
router.get('/dormant-parties', protect, authorize('admin'), async (req, res) => {
  try {
    const months = parseInt(req.query.months || 6, 10);
    const minBalance = parseFloat(req.query.minBalance || 0);

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + now.getMonth();

    const divisions = await require('../models/Division').find().select('_id name').lean();
    const divisionById = new Map(divisions.map((d) => [String(d._id), d.name]));

    // Parties with money still in the wallet
    const vendors = await Vendor.find({ walletBalance: { $gt: minBalance } })
      .select('companyName accountNumber mobileNumber partyCity partyType salesPerson status division walletBalance')
      .lean();
    const vendorIds = vendors.map((v) => v._id);

    // Last redemption per party
    const lastDebits = await WalletTransaction.aggregate([
      { $match: { type: 'debit', vendor: { $in: vendorIds } } },
      { $group: { _id: '$vendor', last: { $max: '$createdAt' }, count: { $sum: 1 } } },
    ]);
    const debitMap = new Map(lastDebits.map((d) => [String(d._id), d]));

    // Last invoice per party — a party may be buying without redeeming
    const lastInvoices = await Invoice.aggregate([
      { $match: { vendor: { $in: vendorIds } } },
      { $group: { _id: '$vendor', last: { $max: '$createdAt' } } },
    ]);
    const invoiceMap = new Map(lastInvoices.map((d) => [String(d._id), d.last]));

    // Oldest wallet still holding a balance, so the sales team knows what is at risk
    const oldest = await MonthlyWallet.aggregate([
      { $match: { vendor: { $in: vendorIds }, balance: { $gt: 0 } } },
      { $group: { _id: '$vendor', minYear: { $min: '$year' } } },
    ]);
    const oldestMap = new Map(oldest.map((d) => [String(d._id), d.minYear]));

    const neverRedeemed = [];
    const stoppedRedeeming = [];

    for (const v of vendors) {
      const k = String(v._id);
      const d = debitMap.get(k);
      const lastRedemption = d?.last || null;

      // Active redeemers within the window are not dormant
      if (lastRedemption && new Date(lastRedemption) >= cutoff) continue;

      const daysSince = lastRedemption
        ? Math.floor((now - new Date(lastRedemption)) / 86400000)
        : null;

      const oldestYear = oldestMap.get(k);
      const row = {
        partyCode: v.accountNumber,
        partyName: v.companyName,
        mobileNumber: v.mobileNumber,
        partyCity: v.partyCity || '',
        partyType: v.partyType || '',
        salesPerson: v.salesPerson || '',
        location: divisionById.get(String(v.division)) || '',
        status: v.status,
        currentBalance: round(v.walletBalance),
        lastRedemption,
        daysSinceRedemption: daysSince,
        redemptionCount: d?.count || 0,
        lastInvoice: invoiceMap.get(k) || null,
        oldestBalanceYear: oldestYear || null,
      };

      (lastRedemption ? stoppedRedeeming : neverRedeemed).push(row);
    }

    const bySalesperson = new Map();
    for (const r of [...neverRedeemed, ...stoppedRedeeming]) {
      const k = r.salesPerson || '(unassigned)';
      if (!bySalesperson.has(k)) bySalesperson.set(k, { salesPerson: k, parties: 0, balance: 0 });
      const e = bySalesperson.get(k);
      e.parties += 1;
      e.balance = round(e.balance + r.currentBalance);
    }

    const sortByBalance = (a, b) => b.currentBalance - a.currentBalance;

    res.status(200).json({
      success: true,
      generatedAt: now,
      window: { months, minBalance, cutoff },
      summary: {
        totalParties: neverRedeemed.length + stoppedRedeeming.length,
        totalBalance: round(
          [...neverRedeemed, ...stoppedRedeeming].reduce((a, r) => a + r.currentBalance, 0)
        ),
        neverRedeemedCount: neverRedeemed.length,
        neverRedeemedValue: round(neverRedeemed.reduce((a, r) => a + r.currentBalance, 0)),
        stoppedCount: stoppedRedeeming.length,
        stoppedValue: round(stoppedRedeeming.reduce((a, r) => a + r.currentBalance, 0)),
      },
      neverRedeemed: neverRedeemed.sort(sortByBalance),
      stoppedRedeeming: stoppedRedeeming.sort(sortByBalance),
      bySalesperson: [...bySalesperson.values()].sort((a, b) => b.balance - a.balance),
    });
  } catch (error) {
    console.error('[dormant-parties]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const FY_START_MONTH = 3; // April (0-indexed)
const fyStartOf = (d) => {
  const y = d.getMonth() >= FY_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, FY_START_MONTH, 1);
};
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * POINT 20.2 — LIABILITY MOVEMENT (monthly roll-forward)
 *
 * Opening + Credited - Redeemed = Closing, month by month.
 *
 * The variance column is the point of this report. It must be zero. Any month
 * where it is not indicates writes that did not complete — this is the standing
 * early-warning system for the drift described in Point 6.
 */
router.get('/liability-movement', protect, authorize('admin'), async (req, res) => {
  try {
    const monthsBack = parseInt(req.query.months || 12, 10);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

    const txns = await WalletTransaction.find({ createdAt: { $gte: from } })
      .select('type amount createdAt')
      .lean();

    // Everything credited and redeemed before the window, to derive the opening
    const priorAgg = await WalletTransaction.aggregate([
      { $match: { createdAt: { $lt: from } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const prior = Object.fromEntries(priorAgg.map((r) => [r._id, r.total]));
    let opening = round((prior.credit || 0) - (prior.debit || 0));

    const buckets = [];
    for (let i = 0; i < monthsBack; i++) {
      const start = new Date(from.getFullYear(), from.getMonth() + i, 1);
      const end = new Date(from.getFullYear(), from.getMonth() + i + 1, 1);
      buckets.push({
        label: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
        start, end, credited: 0, redeemed: 0,
      });
    }

    for (const tx of txns) {
      const d = new Date(tx.createdAt);
      const b = buckets.find((x) => d >= x.start && d < x.end);
      if (!b) continue;
      if (tx.type === 'credit') b.credited += tx.amount || 0;
      else b.redeemed += tx.amount || 0;
    }

    // Actual balance held today, to check the final closing figure against
    const actualNow = round(
      (await Vendor.aggregate([{ $group: { _id: null, t: { $sum: '$walletBalance' } } }]))[0]?.t || 0
    );

    const rows = buckets.map((b, i) => {
      const credited = round(b.credited);
      const redeemed = round(b.redeemed);
      const calculated = round(opening + credited - redeemed);
      const row = {
        month: b.label,
        opening: round(opening),
        credited,
        redeemed,
        closing: calculated,
        // Only the final month can be checked against a real figure; earlier
        // months have no stored snapshot to compare with.
        actual: i === buckets.length - 1 ? actualNow : null,
        variance: i === buckets.length - 1 ? round(actualNow - calculated) : null,
      };
      opening = calculated;
      return row;
    });

    res.status(200).json({
      success: true,
      generatedAt: now,
      rows,
      summary: {
        totalCredited: round(rows.reduce((a, r) => a + r.credited, 0)),
        totalRedeemed: round(rows.reduce((a, r) => a + r.redeemed, 0)),
        closingCalculated: rows.at(-1)?.closing || 0,
        closingActual: actualNow,
        variance: rows.at(-1)?.variance || 0,
        reconciles: Math.abs(rows.at(-1)?.variance || 0) < 0.01,
      },
      note:
        'Only the closing month can be verified against a live figure — there ' +
        'is no stored month-end snapshot for earlier periods. A non-zero ' +
        'variance means writes did not complete.',
    });
  } catch (error) {
    console.error('[liability-movement]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.3 — SCHEME PERFORMANCE
 *
 * Redemption rate and party participation are shown separately on purpose.
 * A scheme can reach 70% redemption from only 20% of parties, meaning a
 * handful of large parties consumed it. Merging the two would hide that.
 */
router.get('/scheme-performance', protect, authorize('admin'), async (req, res) => {
  try {
    const wallets = await Wallet.find().lean();
    const monthly = await MonthlyWallet.find().select('wallet label vendor creditedAmount balance isHold').lean();

    // Redemption dates per monthly wallet, for the days-to-redeem figure
    const debits = await WalletTransaction.find({ type: 'debit', monthlyWallet: { $ne: null } })
      .select('monthlyWallet amount createdAt')
      .lean();
    const debitsByMw = new Map();
    for (const d of debits) {
      const k = String(d.monthlyWallet);
      if (!debitsByMw.has(k)) debitsByMw.set(k, []);
      debitsByMw.get(k).push(d);
    }

    const rows = wallets.map((w) => {
      const mws = monthly.filter(
        (m) => String(m.wallet) === String(w._id) || m.label === w.name
      );
      const credited = round(mws.reduce((a, m) => a + (m.creditedAmount || 0), 0));
      const balance = round(mws.reduce((a, m) => a + (m.balance || 0), 0));
      const redeemed = round(credited - balance);

      const parties = new Set(mws.map((m) => String(m.vendor)));
      const redeemedParties = new Set(
        mws.filter((m) => debitsByMw.has(String(m._id))).map((m) => String(m.vendor))
      );

      // Days from the scheme's own month to each redemption
      const schemeStart = w.year && w.month ? new Date(w.year, w.month - 1, 1) : null;
      const days = [];
      if (schemeStart) {
        for (const m of mws) {
          for (const d of debitsByMw.get(String(m._id)) || []) {
            days.push(Math.round((new Date(d.createdAt) - schemeStart) / 86400000));
          }
        }
      }

      return {
        scheme: w.name,
        period: w.month && w.year ? `${MONTHS[w.month - 1]} ${w.year}` : '',
        partiesCredited: parties.size,
        totalCredited: credited,
        totalRedeemed: redeemed,
        outstanding: balance,
        redemptionRate: credited > 0 ? round((redeemed / credited) * 100) : 0,
        partiesRedeemed: redeemedParties.size,
        participationRate: parties.size > 0 ? round((redeemedParties.size / parties.size) * 100) : 0,
        medianDaysToRedeem: days.length ? Math.round(median(days)) : null,
        onHold: round(mws.filter((m) => m.isHold || w.isHold).reduce((a, m) => a + (m.balance || 0), 0)),
        schemeOnHold: !!w.isHold,
      };
    }).sort((a, b) => b.totalCredited - a.totalCredited);

    res.status(200).json({ success: true, generatedAt: new Date(), rows });
  } catch (error) {
    console.error('[scheme-performance]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.5 — REDEMPTION VELOCITY
 *
 * Days between a credit's month and the redemption drawn from it.
 * The MEDIAN is reported prominently, not the average — a handful of very old
 * redemptions drag an average badly and misrepresent typical behaviour.
 */
router.get('/redemption-velocity', protect, authorize('admin'), async (req, res) => {
  try {
    const debits = await WalletTransaction.find({ type: 'debit' })
      .select('monthlyWallet amount createdAt')
      .lean();

    const mwIds = [...new Set(debits.map((d) => d.monthlyWallet).filter(Boolean).map(String))];
    const mws = await MonthlyWallet.find({ _id: { $in: mwIds } }).select('month year label').lean();
    const mwById = new Map(mws.map((m) => [String(m._id), m]));

    const BUCKETS = [
      { key: 'd0_15',  label: '0–15 days',  min: 0,   max: 16 },
      { key: 'd16_30', label: '16–30 days', min: 16,  max: 31 },
      { key: 'd31_60', label: '31–60 days', min: 31,  max: 61 },
      { key: 'd61_90', label: '61–90 days', min: 61,  max: 91 },
      { key: 'd90',    label: '90+ days',   min: 91,  max: Infinity },
    ];

    const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));
    const values = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));
    const allDays = [];
    const byMonth = new Map();
    let unattributed = 0;
    let unattributedValue = 0;

    for (const d of debits) {
      const mw = d.monthlyWallet ? mwById.get(String(d.monthlyWallet)) : null;
      if (!mw || !mw.year || !mw.month) {
        unattributed += 1;
        unattributedValue += d.amount || 0;
        continue;
      }
      const creditDate = new Date(mw.year, mw.month - 1, 1);
      const days = Math.max(0, Math.round((new Date(d.createdAt) - creditDate) / 86400000));
      allDays.push(days);

      const b = BUCKETS.find((x) => days >= x.min && days < x.max) || BUCKETS.at(-1);
      counts[b.key] += 1;
      values[b.key] += d.amount || 0;

      const rd = new Date(d.createdAt);
      const mk = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(mk)) byMonth.set(mk, { month: `${MONTHS[rd.getMonth()]} ${rd.getFullYear()}`, days: [] });
      byMonth.get(mk).days.push(days);
    }

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      buckets: BUCKETS.map((b) => ({
        ...b, count: counts[b.key], value: round(values[b.key]),
        percent: allDays.length ? round((counts[b.key] / allDays.length) * 100) : 0,
      })),
      summary: {
        redemptions: allDays.length,
        medianDays: allDays.length ? Math.round(median(allDays)) : 0,
        averageDays: allDays.length ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 0,
        unattributedCount: unattributed,
        unattributedValue: round(unattributedValue),
      },
      trend: [...byMonth.entries()].sort().map(([, v]) => ({
        month: v.month,
        medianDays: Math.round(median(v.days)),
        redemptions: v.days.length,
      })),
      note:
        'Median is the figure to trust. Redemptions with no wallet attached ' +
        'cannot be measured and are reported separately.',
    });
  } catch (error) {
    console.error('[redemption-velocity]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.6 — INCENTIVE-TO-PURCHASE RATIO
 *
 * Redeemed amount as a percentage of that party's total invoice value.
 * High outliers are flagged for review, not accusation — but it is the pattern
 * you would expect if invoices were being inflated to release balance.
 */
router.get('/incentive-ratio', protect, authorize('admin'), async (req, res) => {
  try {
    const agg = await Invoice.aggregate([
      { $group: {
        _id: '$vendor',
        invoiceValue: { $sum: '$invoiceAmount' },
        redeemed: { $sum: '$redeemedAmount' },
        invoiceCount: { $sum: 1 },
      } },
    ]);

    const vendors = await Vendor.find({ _id: { $in: agg.map((a) => a._id) } })
      .select('companyName accountNumber partyType partyCity division')
      .lean();
    const vendorById = new Map(vendors.map((v) => [String(v._id), v]));

    const divisions = await require('../models/Division').find().select('_id name').lean();
    const divisionById = new Map(divisions.map((d) => [String(d._id), d.name]));

    const rows = agg
      .filter((a) => a.invoiceValue > 0)
      .map((a) => {
        const v = vendorById.get(String(a._id));
        return {
          partyCode: v?.accountNumber || '(deleted party)',
          partyName: v?.companyName || '(deleted party)',
          partyType: v?.partyType || '',
          location: divisionById.get(String(v?.division)) || '',
          invoiceValue: round(a.invoiceValue),
          redeemed: round(a.redeemed),
          ratio: round((a.redeemed / a.invoiceValue) * 100),
          invoiceCount: a.invoiceCount,
          avgPerInvoice: round(a.redeemed / a.invoiceCount),
        };
      });

    // Flag anything more than two standard deviations above the mean
    const ratios = rows.map((r) => r.ratio);
    const mean = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    const sd = ratios.length
      ? Math.sqrt(ratios.reduce((a, b) => a + (b - mean) ** 2, 0) / ratios.length)
      : 0;
    const threshold = round(mean + 2 * sd);
    for (const r of rows) r.outlier = sd > 0 && r.ratio > threshold;

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      rows: rows.sort((a, b) => b.ratio - a.ratio),
      summary: {
        parties: rows.length,
        meanRatio: round(mean),
        medianRatio: round(median(ratios)),
        outlierThreshold: threshold,
        outlierCount: rows.filter((r) => r.outlier).length,
      },
      note:
        'A high ratio is worth a look, not an accusation. Many are entirely ' +
        'legitimate — but it is the pattern inflated invoicing would produce.',
    });
  } catch (error) {
    console.error('[incentive-ratio]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.8 — BRANCH PERFORMANCE
 *
 * CAVEAT: the branch an invoice belongs to comes from the invoice NUMBER
 * PREFIX, not from the user who created it. A Jodhpur user entering a
 * Jaipur-prefixed number is counted under Jaipur. Attribution must be made
 * reliable before these comparisons carry weight.
 */
router.get('/branch-performance', protect, authorize('admin'), async (req, res) => {
  try {
    const divisions = await require('../models/Division').find().lean();

    const agg = await Invoice.aggregate([
      { $group: {
        _id: '$division',
        invoices: { $sum: 1 },
        invoiceValue: { $sum: '$invoiceAmount' },
        redeemed: { $sum: '$redeemedAmount' },
        parties: { $addToSet: '$vendor' },
      } },
    ]);
    const aggById = new Map(agg.map((a) => [String(a._id), a]));

    const vendorAgg = await Vendor.aggregate([
      { $group: {
        _id: '$division',
        parties: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        balance: { $sum: '$walletBalance' },
      } },
    ]);
    const vendorById = new Map(vendorAgg.map((a) => [String(a._id), a]));

    const rows = divisions.map((d) => {
      const a = aggById.get(String(d._id));
      const v = vendorById.get(String(d._id));
      const invoiceValue = round(a?.invoiceValue || 0);
      const redeemed = round(a?.redeemed || 0);
      return {
        location: d.name,
        locationCode: d.locationCode,
        active: d.isActive,
        parties: v?.parties || 0,
        activeParties: v?.active || 0,
        outstandingBalance: round(v?.balance || 0),
        partiesServed: a?.parties?.length || 0,
        invoices: a?.invoices || 0,
        invoiceValue,
        redeemed,
        avgPerInvoice: a?.invoices ? round(redeemed / a.invoices) : 0,
        redemptionPercent: invoiceValue > 0 ? round((redeemed / invoiceValue) * 100) : 0,
      };
    }).sort((a, b) => b.redeemed - a.redeemed);

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      rows,
      note:
        'Branch comes from the invoice number prefix, not the logged-in user. ' +
        'See Point 20.8 — attribution should be verified before acting on this.',
    });
  } catch (error) {
    console.error('[branch-performance]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.7 — PARTY SCORECARD
 *
 * Everything about one party on one page. This is what a party receives when
 * they query their balance, so it must foot correctly and be readable by
 * someone outside the business.
 */
router.get('/scorecard/:vendorId', protect, authorize('admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId)
      .populate('division', 'name locationCode')
      .lean();
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Party not found' });
    }

    const [monthlyWallets, txns, invoices, wallets] = await Promise.all([
      MonthlyWallet.find({ vendor: vendor._id }).sort({ year: 1, month: 1 }).lean(),
      WalletTransaction.find({ vendor: vendor._id })
        .populate('invoice', 'invoiceNumber referenceNo')
        .populate('processedBy', 'name')
        .sort({ createdAt: 1 })
        .lean(),
      Invoice.find({ vendor: vendor._id }).sort({ createdAt: -1 }).lean(),
      Wallet.find().select('_id name isHold holdReason').lean(),
    ]);

    const walletById = new Map(wallets.map((w) => [String(w._id), w]));
    const now = new Date();
    const nowMonths = now.getFullYear() * 12 + now.getMonth();

    const walletRows = monthlyWallets.map((mw) => {
      const parent = mw.wallet ? walletById.get(String(mw.wallet)) : null;
      const held = mw.isHold || parent?.isHold;
      return {
        scheme: parent?.name || mw.label || '',
        month: mw.month ? MONTHS[mw.month - 1] : '',
        year: mw.year || '',
        creditedAmount: round(mw.creditedAmount),
        redeemed: round((mw.creditedAmount || 0) - (mw.balance || 0)),
        balance: round(mw.balance),
        ageMonths: mw.year && mw.month ? nowMonths - (mw.year * 12 + (mw.month - 1)) : null,
        isHold: !!held,
        holdReason: mw.isHold ? mw.holdReason : parent?.holdReason || null,
        holdLevel: mw.isHold ? 'Party wallet' : parent?.isHold ? 'Whole scheme' : null,
      };
    });

    // Ledger with a running balance, so the statement can be checked line by line
    let running = 0;
    const ledger = txns.map((tx) => {
      running += tx.type === 'credit' ? (tx.amount || 0) : -(tx.amount || 0);
      return {
        date: tx.createdAt,
        type: tx.type,
        particulars: tx.description || (tx.type === 'credit' ? 'Incentive credited' : 'Redeemed'),
        wallet: tx.walletLabel || '',
        invoiceNumber: tx.invoice?.invoiceNumber || '',
        referenceNumber: tx.invoice?.referenceNo || '',
        credit: tx.type === 'credit' ? round(tx.amount) : null,
        debit: tx.type === 'debit' ? round(tx.amount) : null,
        runningBalance: round(running),
        recordedBalanceAfter: round(tx.balanceAfter),
        processedBy: tx.processedBy?.name || '',
      };
    }).reverse();

    const totalCredited = round(txns.filter((t) => t.type === 'credit').reduce((a, t) => a + (t.amount || 0), 0));
    const totalRedeemed = round(txns.filter((t) => t.type === 'debit').reduce((a, t) => a + (t.amount || 0), 0));
    const subTotal = round(walletRows.reduce((a, w) => a + w.balance, 0));
    const masterBalance = round(vendor.walletBalance);

    // Last 12 months of credit and redemption, for the trend strip
    const trend = [];
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inRange = txns.filter((t) => new Date(t.createdAt) >= s && new Date(t.createdAt) < e);
      trend.push({
        month: `${MONTHS[s.getMonth()]} ${String(s.getFullYear()).slice(2)}`,
        credited: round(inRange.filter((t) => t.type === 'credit').reduce((a, t) => a + (t.amount || 0), 0)),
        redeemed: round(inRange.filter((t) => t.type === 'debit').reduce((a, t) => a + (t.amount || 0), 0)),
      });
    }

    res.status(200).json({
      success: true,
      generatedAt: now,
      party: {
        partyCode: vendor.accountNumber,
        partyName: vendor.companyName,
        contactPerson: vendor.personName,
        mobileNumber: vendor.mobileNumber,
        partyCity: vendor.partyCity,
        partyType: vendor.partyType,
        location: vendor.division?.name || '',
        locationCode: vendor.division?.locationCode || '',
        salesPerson: vendor.salesPerson,
        status: vendor.status,
        address: vendor.address || '',
      },
      summary: {
        totalCredited,
        totalRedeemed,
        currentBalance: masterBalance,
        subWalletTotal: subTotal,
        // Surfaced rather than hidden — the two figures should agree
        discrepancy: round(subTotal - masterBalance),
        onHold: round(walletRows.filter((w) => w.isHold).reduce((a, w) => a + w.balance, 0)),
        redemptionRate: totalCredited > 0 ? round((totalRedeemed / totalCredited) * 100) : 0,
        lastRedemption: [...txns].reverse().find((t) => t.type === 'debit')?.createdAt || null,
        invoiceCount: invoices.length,
        totalInvoiceValue: round(invoices.reduce((a, i) => a + (i.invoiceAmount || 0), 0)),
      },
      wallets: walletRows,
      ledger,
      trend,
    });
  } catch (error) {
    console.error('[scorecard]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 20.12 — UNUSUAL PATTERNS
 *
 * Flags for review, NOT accusations. Every threshold is adjustable, because a
 * fixed rule that fires constantly is one people learn to ignore.
 *
 * Expect false positives, particularly early. The value is in patterns that
 * repeat, not in any single hit.
 */
router.get('/unusual-patterns', protect, authorize('admin'), async (req, res) => {
  try {
    const q = req.query;
    const cfg = {
      hourStart: parseInt(q.hourStart ?? 9, 10),
      hourEnd: parseInt(q.hourEnd ?? 20, 10),
      sameDayCount: parseInt(q.sameDayCount ?? 2, 10),
      ratioPercent: parseFloat(q.ratioPercent ?? 40),
      largeMultiple: parseFloat(q.largeMultiple ?? 3),
      rapidDrainHours: parseInt(q.rapidDrainHours ?? 48, 10),
      repeatedAmountCount: parseInt(q.repeatedAmountCount ?? 3, 10),
      days: parseInt(q.days ?? 90, 10),
    };

    const since = new Date();
    since.setDate(since.getDate() - cfg.days);

    const invoices = await Invoice.find({ createdAt: { $gte: since }, redeemedAmount: { $gt: 0 } })
      .populate('vendor', 'companyName accountNumber division')
      .populate('division', 'name')
      .lean();

    const flags = [];
    const add = (pattern, inv, detail) => flags.push({
      date: inv.createdAt,
      pattern,
      partyCode: inv.vendor?.accountNumber || '(deleted party)',
      partyName: inv.vendor?.companyName || '(deleted party)',
      branch: inv.division?.name || '',
      amount: round(inv.redeemedAmount),
      invoiceNumber: inv.invoiceNumber,
      detail,
    });

    // Party averages, for the "unusually large" check
    const byParty = new Map();
    for (const inv of invoices) {
      const k = String(inv.vendor?._id || 'unknown');
      if (!byParty.has(k)) byParty.set(k, []);
      byParty.get(k).push(inv);
    }

    for (const inv of invoices) {
      const d = new Date(inv.createdAt);
      const hour = d.getHours();

      // Outside business hours
      if (hour < cfg.hourStart || hour >= cfg.hourEnd) {
        add('Outside business hours', inv,
          `Processed at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
      }
      if (d.getDay() === 0) {
        add('Sunday redemption', inv, 'Processed on a Sunday');
      }

      // High share of the invoice funded by incentive
      const share = inv.invoiceAmount > 0 ? (inv.redeemedAmount / inv.invoiceAmount) * 100 : 0;
      if (share > cfg.ratioPercent) {
        add('High share of invoice', inv,
          `${share.toFixed(1)}% of the invoice (threshold ${cfg.ratioPercent}%)`);
      }

      // Large relative to that party's own history
      const peers = byParty.get(String(inv.vendor?._id || 'unknown')) || [];
      if (peers.length >= 3) {
        const avg = peers.reduce((a, p) => a + (p.redeemedAmount || 0), 0) / peers.length;
        if (avg > 0 && inv.redeemedAmount > avg * cfg.largeMultiple) {
          add('Large for this party', inv,
            `${(inv.redeemedAmount / avg).toFixed(1)}x their average of ₹${avg.toFixed(0)}`);
        }
      }
    }

    // Several redemptions by one party on the same day
    const dayMap = new Map();
    for (const inv of invoices) {
      const k = `${inv.vendor?._id}|${new Date(inv.createdAt).toDateString()}`;
      if (!dayMap.has(k)) dayMap.set(k, []);
      dayMap.get(k).push(inv);
    }
    for (const group of dayMap.values()) {
      if (group.length > cfg.sameDayCount) {
        add('Multiple redemptions in one day', group[0],
          `${group.length} redemptions on ${new Date(group[0].createdAt).toLocaleDateString('en-IN')}`);
      }
    }

    // The same amount repeated for one party
    const amountMap = new Map();
    for (const inv of invoices) {
      const k = `${inv.vendor?._id}|${round(inv.invoiceAmount)}`;
      if (!amountMap.has(k)) amountMap.set(k, []);
      amountMap.get(k).push(inv);
    }
    for (const group of amountMap.values()) {
      if (group.length >= cfg.repeatedAmountCount) {
        add('Same invoice value repeated', group[0],
          `${group.length} invoices at ₹${round(group[0].invoiceAmount)}`);
      }
    }

    // A newly credited wallet drained almost immediately
    const recentCredits = await WalletTransaction.find({
      type: 'credit', createdAt: { $gte: since }, monthlyWallet: { $ne: null },
    }).select('monthlyWallet vendor amount createdAt').lean();

    for (const credit of recentCredits) {
      const drain = await WalletTransaction.findOne({
        type: 'debit',
        monthlyWallet: credit.monthlyWallet,
        createdAt: {
          $gte: credit.createdAt,
          $lte: new Date(new Date(credit.createdAt).getTime() + cfg.rapidDrainHours * 3600000),
        },
        amount: { $gte: (credit.amount || 0) * 0.9 },
      }).populate('vendor', 'companyName accountNumber').lean();

      if (drain) {
        flags.push({
          date: drain.createdAt,
          pattern: 'Wallet drained immediately after credit',
          partyCode: drain.vendor?.accountNumber || '(deleted party)',
          partyName: drain.vendor?.companyName || '(deleted party)',
          branch: '',
          amount: round(drain.amount),
          invoiceNumber: '',
          detail: `Fully redeemed within ${cfg.rapidDrainHours} hours of being credited`,
        });
      }
    }

    // Count by pattern, so repeats stand out from one-offs
    const byPattern = new Map();
    for (const f of flags) {
      if (!byPattern.has(f.pattern)) byPattern.set(f.pattern, { pattern: f.pattern, count: 0, value: 0 });
      const e = byPattern.get(f.pattern);
      e.count += 1;
      e.value = round(e.value + f.amount);
    }

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      config: cfg,
      summary: {
        totalFlags: flags.length,
        totalValue: round(flags.reduce((a, f) => a + f.amount, 0)),
        patternCount: byPattern.size,
        invoicesChecked: invoices.length,
      },
      byPattern: [...byPattern.values()].sort((a, b) => b.count - a.count),
      flags: flags.sort((a, b) => new Date(b.date) - new Date(a.date)),
      note:
        'These are flags for review, not evidence of wrongdoing. Expect false ' +
        'positives. What matters is a pattern that repeats for the same party ' +
        'or branch, not a single hit.',
    });
  } catch (error) {
    console.error('[unusual-patterns]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POINT 21b — AUDIT TRAIL
 *
 * Everything that has happened to one party, in order.
 *
 * Money movement before this feature was installed can be partially rebuilt
 * from WalletTransaction. Those entries are marked `reconstructed` so they are
 * never mistaken for a real audit record — party edits, holds and OTP events
 * from that period were never recorded and cannot be recovered.
 */
router.get('/audit/:vendorId', protect, authorize('admin'), async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId)
      .select('companyName accountNumber')
      .lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Party not found' });

    const captured = await AuditLog.find({ vendorId: vendor._id })
      .sort({ createdAt: -1 })
      .lean();

    // Rebuild what we can from before the trail existed
    const earliest = captured.length
      ? new Date(Math.min(...captured.map((c) => new Date(c.createdAt))))
      : new Date();

    const older = await WalletTransaction.find({
      vendor: vendor._id,
      createdAt: { $lt: earliest },
    })
      .populate('invoice', 'invoiceNumber referenceNo')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const reconstructed = older.map((tx) => ({
      _id: `recon-${tx._id}`,
      createdAt: tx.createdAt,
      eventType: tx.type === 'credit' ? 'incentive.credited' : 'redemption',
      actorName: tx.processedBy?.name || null,
      source: 'system',
      amount: parseFloat((tx.amount || 0).toFixed(2)),
      balanceAfter: tx.balanceAfter,
      walletLabel: tx.walletLabel || null,
      invoiceNumber: tx.invoice?.invoiceNumber || null,
      referenceNo: tx.invoice?.referenceNo || null,
      summary: tx.description || null,
      changes: [],
      reconstructed: true,
    }));

    const events = [...captured, ...reconstructed]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const byType = new Map();
    for (const e of events) {
      byType.set(e.eventType, (byType.get(e.eventType) || 0) + 1);
    }

    res.status(200).json({
      success: true,
      generatedAt: new Date(),
      party: { partyCode: vendor.accountNumber, partyName: vendor.companyName },
      summary: {
        totalEvents: events.length,
        capturedEvents: captured.length,
        reconstructedEvents: reconstructed.length,
        trailStarted: captured.length ? captured.at(-1).createdAt : null,
        byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
      },
      events,
      note: reconstructed.length
        ? `${reconstructed.length} earlier entries were rebuilt from transaction ` +
          'records. Party edits, holds and OTP events from before the audit trail ' +
          'was installed were never recorded and cannot be recovered.'
        : null,
    });
  } catch (error) {
    console.error('[audit trail]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
