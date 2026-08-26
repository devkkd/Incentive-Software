'use client';

/**
 * MockApi.jsx — run the frontend with NO backend and NO database.
 *
 * Place in:  frontend/src/components/MockApi.jsx
 *
 * Then add two lines to frontend/src/app/layout.js — see the bottom
 * of this file for exactly what to add and where.
 *
 * Switch it off by setting NEXT_PUBLIC_MOCK_API=false in .env.local
 * (or just deleting the two lines from layout.js).
 *
 * HOW IT WORKS
 * It replaces the browser's fetch() so that any request to /api/...
 * returns canned data instead of travelling to a server. Everything
 * else (images, fonts, Google Translate) passes through untouched.
 *
 * WHICH SCREEN YOU GET
 * The role is taken from the URL you are on:
 *   /admin/...   -> you are an admin
 *   /branch/...  -> you are a branch user
 * So just navigate to http://localhost:3000/admin and it works.
 * No login needed — though the login pages work too, any password.
 */

const ENABLED = process.env.NEXT_PUBLIC_MOCK_API !== 'false';

// ─────────────────────────────────────────────────────────────────────────────
// DUMMY DATA — edit freely, it only exists in your browser
// ─────────────────────────────────────────────────────────────────────────────

const DIVISIONS = [
  { _id: 'd1', name: 'JODHPUR',  location: 'Jodhpur',  locationCode: '1', isActive: true, invoiceCount: 412 },
  { _id: 'd2', name: 'JAIPUR',   location: 'Jaipur',   locationCode: '2', isActive: true, invoiceCount: 388 },
  { _id: 'd3', name: 'AJMER',    location: 'Ajmer',    locationCode: '3', isActive: true, invoiceCount: 155 },
  { _id: 'd4', name: 'BEAWAR',   location: 'Beawar',   locationCode: '4', isActive: false, invoiceCount: 44 },
];

const VENDORS = [
  { _id: 'v1', companyName: 'SHREE BALAJI AUTO PARTS', personName: 'Ramesh Sharma',
    accountNumber: 'ZTEST01', mobileNumber: '9000000001', partyCity: 'Jodhpur',
    partyType: 'Retailer', status: 'active', walletBalance: 30000,
    division: DIVISIONS[0], salesPerson: 'Sumer Singh' },
  { _id: 'v2', companyName: 'MARUDHAR MOTORS', personName: 'Vikram Rathore',
    accountNumber: 'ZTEST02', mobileNumber: '9000000002', partyCity: 'Jodhpur',
    partyType: 'Workshop', status: 'active', walletBalance: 0,
    division: DIVISIONS[0], salesPerson: 'Vinod Kumar' },
  { _id: 'v3', companyName: 'JAIPUR SPARE CENTRE', personName: 'Anil Agarwal',
    accountNumber: 'ZTEST03', mobileNumber: '9000000003', partyCity: 'Jaipur',
    partyType: 'Retailer', status: 'active', walletBalance: 6000,
    division: DIVISIONS[1], salesPerson: 'Nitin Singh' },
  { _id: 'v4', companyName: 'RAJASTHAN TRUCK SPARES', personName: 'Mohan Lal',
    accountNumber: 'ZTEST04', mobileNumber: '9000000004', partyCity: 'Ajmer',
    partyType: 'Fleet', status: 'active', walletBalance: 6000,
    division: DIVISIONS[2], salesPerson: 'Ramesh Prajapat' },
  { _id: 'v5', companyName: 'DESERT AUTO AGENCY', personName: 'Suresh Bhati',
    accountNumber: 'ZTEST05', mobileNumber: '9000000005', partyCity: 'Jodhpur',
    partyType: 'Sub-distributor', status: 'blocked', walletBalance: 20000,
    division: DIVISIONS[0], salesPerson: 'Sumer Singh' },
];

// Sub-wallets per party. Deliberately includes the broken states
// so you can see how each one renders.
const MONTHLY_WALLETS = {
  v1: [
    { _id: 'm1', month: 6, year: 2026, label: 'June 2026',   creditedAmount: 10000, balance: 10000, isHold: false },
    { _id: 'm2', month: 7, year: 2026, label: 'July 2026',   creditedAmount: 20000, balance: 20000, isHold: false },
  ],
  v2: [],                                    // zero balance — panel hides
  v3: [
    { _id: 'm3', month: 7,  year: 2025, label: 'July 2025',     creditedAmount: 5000, balance: 5000, isHold: false },
    { _id: 'm4', month: 12, year: 2025, label: 'December 2025', creditedAmount: 5000, balance: 1000, isHold: false },
  ],
  v4: [
    { _id: 'm5', month: 7, year: 2026, label: 'July 2026',   creditedAmount: 4000, balance: 4000, isHold: true,
      holdReason: 'Disputed claim' },
    { _id: 'm6', month: 8, year: 2026, label: 'August 2026', creditedAmount: 6000, balance: 6000, isHold: false },
  ],
  v5: [
    { _id: 'm7', month: 7, year: 2026, label: 'July 2026', creditedAmount: 5000, balance: 5000, isHold: false },
  ],
};

const WALLETS = [
  { _id: 'w1', name: 'August 2026',   month: 8, year: 2026, isHold: false, holdReason: null,
    totalCredited: 600000, totalBalance: 445000, totalParties: 118, heldPartiesCount: 2,  partiesWithBalance: 96 },
  { _id: 'w2', name: 'July 2026',     month: 7, year: 2026, isHold: false, holdReason: null,
    totalCredited: 580000, totalBalance: 212000, totalParties: 124, heldPartiesCount: 5,  partiesWithBalance: 71 },
  { _id: 'w3', name: 'Diwali Scheme', month: 10, year: 2025, isHold: true,
    holdReason: 'Scheme closed, pending audit',
    totalCredited: 350000, totalBalance: 88000,  totalParties: 90,  heldPartiesCount: 90, partiesWithBalance: 34 },
  { _id: 'w4', name: 'June 2026',     month: 6, year: 2026, isHold: false, holdReason: null,
    totalCredited: 540000, totalBalance: 41000,  totalParties: 121, heldPartiesCount: 1,  partiesWithBalance: 22 },
];

const INVOICES = [
  { _id: 'i1', invoiceNumber: '1/RS/40012287', referenceNo: '48120073',
    invoiceAmount: 84500, redeemedAmount: 12000, status: 'processed',
    invoiceDate: '2026-08-24T00:00:00.000Z', createdAt: '2026-08-24T09:14:00.000Z',
    vendor: VENDORS[0], division: DIVISIONS[0] },
  { _id: 'i2', invoiceNumber: '2/CSI/40012288', referenceNo: '71905522',
    invoiceAmount: 46200, redeemedAmount: 5000, status: 'processed',
    invoiceDate: '2026-08-23T00:00:00.000Z', createdAt: '2026-08-23T15:41:00.000Z',
    vendor: VENDORS[2], division: DIVISIONS[1] },
  { _id: 'i3', invoiceNumber: '1/RS/40012290', referenceNo: '30044819',
    invoiceAmount: 128000, redeemedAmount: 24000, status: 'processed',
    invoiceDate: '2026-08-22T00:00:00.000Z', createdAt: '2026-08-22T11:02:00.000Z',
    vendor: VENDORS[4], division: DIVISIONS[0] },
];

const TRANSACTIONS = [
  { _id: 't1', type: 'credit', amount: 20000, balanceAfter: 30000, walletLabel: 'July 2026',
    description: 'Monthly incentive credited', createdAt: '2026-07-05T10:00:00.000Z' },
  { _id: 't2', type: 'debit',  amount: 12000, balanceAfter: 18000, walletLabel: 'June 2026',
    description: 'Redeemed against invoice 1/RS/40012287', createdAt: '2026-08-24T09:14:00.000Z' },
  { _id: 't3', type: 'credit', amount: 10000, balanceAfter: 28000, walletLabel: 'June 2026',
    description: 'Monthly incentive credited', createdAt: '2026-06-04T10:00:00.000Z' },
];

const BRANCH_USERS = [
  { _id: 'u2', name: 'Jodhpur Counter', email: 'jodhpur@example.com', role: 'branch',
    division: DIVISIONS[0], isActive: true },
  { _id: 'u3', name: 'Jaipur Counter',  email: 'jaipur@example.com',  role: 'branch',
    division: DIVISIONS[1], isActive: true },
];

const DASHBOARD_STATS = {
  totalIncentives: 2070000, weeklyTotal: 48000, weeklyChange: 12.4,
  monthlyTotal: 600000, monthlyChange: -3.1, yearlyTotal: 2070000,
  totalRedeemed: 1284000, totalOutstanding: 786000,
  totalParties: 453, activeParties: 421, blockedParties: 32,
  totalInvoices: 999, invoicesThisMonth: 87,
  monthlyTrend: [
    { month: 'Apr', credited: 480000, redeemed: 302000 },
    { month: 'May', credited: 510000, redeemed: 355000 },
    { month: 'Jun', credited: 540000, redeemed: 499000 },
    { month: 'Jul', credited: 580000, redeemed: 368000 },
    { month: 'Aug', credited: 600000, redeemed: 155000 },
  ],
  divisionBreakdown: [
    { name: 'JODHPUR', value: 880000, color: '#2B3B8A' },
    { name: 'JAIPUR',  value: 690000, color: '#D97706' },
    { name: 'AJMER',   value: 340000, color: '#059669' },
    { name: 'BEAWAR',  value: 160000, color: '#0088FE' },
  ],
  topParties: VENDORS.slice(0, 4).map(v => ({
    companyName: v.companyName, accountNumber: v.accountNumber, total: v.walletBalance * 3,
  })),
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING — match the request, return the data
// ─────────────────────────────────────────────────────────────────────────────

function currentRole() {
  if (typeof window === 'undefined') return 'admin';
  return window.location.pathname.startsWith('/branch') ? 'branch' : 'admin';
}

function mockUser() {
  const role = currentRole();
  return role === 'branch'
    ? { _id: 'u2', name: 'Jodhpur Counter', email: 'jodhpur@example.com',
        role: 'branch', division: DIVISIONS[0] }
    : { _id: 'u1', name: 'Head Office', email: 'admin@example.com',
        role: 'admin', division: null };
}

function resolve(path, method, body) {
  const id = (n) => path.split('/')[n];

  // ── auth ──────────────────────────────────────────────────────────────────
  if (path.endsWith('/api/auth/me'))     return { success: true, data: mockUser() };
  if (path.endsWith('/api/auth/logout')) return { success: true, message: 'Logged out' };
  if (path.endsWith('/api/auth/login'))  return {
    success: true, token: 'mock-token', data: mockUser(),
  };

  // ── dashboard ─────────────────────────────────────────────────────────────
  if (path.includes('/api/dashboard/stats')) return { success: true, data: DASHBOARD_STATS };

  // ── divisions ─────────────────────────────────────────────────────────────
  if (path.includes('/api/divisions')) return { success: true, data: DIVISIONS };

  // ── vendors ───────────────────────────────────────────────────────────────
  if (path.includes('/api/vendors/search')) return { success: true, data: VENDORS.slice(0, 5) };
  if (path.match(/\/api\/vendors\/[^/]+\/transactions/)) {
    return { success: true, data: TRANSACTIONS };
  }
  if (path.match(/\/api\/vendors\/[^/]+$/) && method === 'GET') {
    const vid = path.split('/').pop();
    return { success: true, data: VENDORS.find(v => v._id === vid) || VENDORS[0] };
  }
  if (path.includes('/api/vendors')) {
    return {
      success: true, data: VENDORS,
      pagination: { total: VENDORS.length, page: 1, limit: 20, pages: 1 },
    };
  }

  // ── wallets ───────────────────────────────────────────────────────────────
  if (path.includes('/api/wallets/diagnostics')) {
    return { success: true, data: {
      vendorBalanceSum: 786000, vendorCount: 453,
      totalCredits: 2070000, creditCount: 1812,
      totalDebits: 1284000, debitCount: 999,
      expectedBalance: 786000,
      orphanDebitTotal: 41500, orphanDebitCount: 27,
      newFlowDebitTotal: 1242500, adjustedExpectedBalance: 827500,
      isReconciled: true, wouldReconcileAfterCleanup: false,
      discrepancy: 0, discrepancyAfterCleanup: -41500,
    }};
  }
  if (path.match(/\/api\/wallets\/[^/]+\/parties/)) {
    const wid = path.split('/')[path.split('/').length - 2];
    const w = WALLETS.find(x => x._id === wid) || WALLETS[0];
    return {
      success: true,
      wallet: { _id: w._id, name: w.name, isHold: w.isHold, holdReason: w.holdReason },
      count: VENDORS.length,
      data: VENDORS.map((v, i) => ({
        monthlyWalletId: `mw${i}`, vendorId: v._id,
        companyName: v.companyName, personName: v.personName,
        accountNumber: v.accountNumber, mobileNumber: v.mobileNumber,
        partyCity: v.partyCity, partyType: v.partyType, vendorStatus: v.status,
        divisionName: v.division.name, totalVendorBalance: v.walletBalance,
        creditedAmount: v.walletBalance + 5000, balance: v.walletBalance,
        isHold: i === 3, holdReason: i === 3 ? 'Disputed claim' : null,
        walletIsHold: w.isHold,
      })),
    };
  }
  if (path.includes('/api/wallets')) {
    return {
      success: true, count: WALLETS.length, data: WALLETS,
      trueSystemBalance: 786000, totalCreditedFromTxn: 2070000, totalRedeemed: 1284000,
    };
  }

  // ── incentives ────────────────────────────────────────────────────────────
  if (path.includes('/api/incentives/monthly-wallets/')) {
    const vid = path.split('/').pop().split('?')[0];
    return { success: true, data: MONTHLY_WALLETS[vid] || [] };
  }
  if (path.includes('/api/incentives/history')) {
    return { success: true, data: [
      { _id: 'up1', fileName: 'incentive_july_2026.xlsx', walletLabel: 'July 2026',
        month: 7, year: 2026, totalAmount: 580000, status: 'processed',
        frequency: 'monthly', division: DIVISIONS[0],
        uploadedBy: { name: 'Head Office' }, items: [],
        createdAt: '2026-07-05T09:30:00.000Z' },
      { _id: 'up2', fileName: 'incentive_aug_2026.xlsx', walletLabel: 'August 2026',
        month: 8, year: 2026, totalAmount: 600000, status: 'processed',
        frequency: 'monthly', division: DIVISIONS[1],
        uploadedBy: { name: 'Head Office' }, items: [],
        createdAt: '2026-08-04T09:30:00.000Z' },
    ]};
  }
  if (path.includes('/api/incentives/uploads-without-wallets')) {
    return { success: true, count: 1, data: [
      { uploadId: 'up3', fileName: 'incentive_may_2026.xlsx', walletLabel: 'May 2026',
        month: 5, year: 2026, itemCount: 96, totalAmount: 470000 },
    ]};
  }
  if (path.includes('/api/incentives/send-otp')) {
    return { success: true, message: 'OTP sent', otp: '123456', devOtp: '123456' };
  }

  // ── invoices ──────────────────────────────────────────────────────────────
  if (path.includes('/api/invoices/redeem/send-otp')) {
    return { success: true, message: 'OTP sent to party', otp: '123456', devOtp: '123456' };
  }
  if (path.includes('/api/invoices') && method === 'POST') {
    return { success: true, message: 'Invoice created', data: {
      ...INVOICES[0], _id: 'new', referenceNo: String(Math.floor(10000000 + Math.random() * 89999999)),
    }};
  }
  if (path.includes('/api/invoices')) {
    return {
      success: true, data: INVOICES,
      pagination: { total: INVOICES.length, page: 1, limit: 20, pages: 1 },
    };
  }

  // ── users / branches ──────────────────────────────────────────────────────
  if (path.includes('/api/users/branches')) return { success: true, data: BRANCH_USERS };

  // ── reports ───────────────────────────────────────────────────────────────
  if (path.includes('/api/reports')) {
    return {
      success: true, data: INVOICES,
      totals: { invoiceAmount: 258700, redeemedAmount: 41000, count: INVOICES.length },
      pagination: { total: INVOICES.length, page: 1, limit: 20, pages: 1 },
    };
  }

  // ── settings ──────────────────────────────────────────────────────────────
  if (path.includes('/api/settings/me')) return { success: true, data: mockUser() };
  if (path.includes('/api/settings')) return { success: true, message: 'Saved', otp: '123456' };

  // ── anything unmatched ────────────────────────────────────────────────────
  // Returns an empty-but-valid response so the page renders instead of
  // crashing. If a screen looks blank, add a case for it above.
  console.warn('[MockApi] no mock for:', method, path, '— returning empty');
  return { success: true, data: [], message: 'Mocked (no handler)' };
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL THE INTERCEPTOR
// ─────────────────────────────────────────────────────────────────────────────

if (ENABLED && typeof window !== 'undefined' && !window.__mockApiInstalled) {
  window.__mockApiInstalled = true;

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const method = (init.method || 'GET').toUpperCase();

    // Not an API call? Let it through untouched.
    if (!url.includes('/api/')) return realFetch(input, init);

    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch { /* FormData etc */ }

    const payload = resolve(url, method, body);

    // Small delay so loading spinners actually appear — makes the UI
    // behave the way it will against a real server.
    await new Promise(r => setTimeout(r, 180));

    console.log('[MockApi]', method, url.replace(/^https?:\/\/[^/]+/, ''), payload);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // Pretend we are already logged in.
  try {
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('role', currentRole());
  } catch { /* private browsing */ }

  console.log(
    '%c[MockApi] ON — no backend needed. Set NEXT_PUBLIC_MOCK_API=false to disable.',
    'background:#2B3B8A;color:#fff;padding:2px 6px;border-radius:3px'
  );
}

export default function MockApi() {
  return null;
}

/* ───────────────────────────────────────────────────────────────────────────
   HOW TO SWITCH IT ON

   Open  frontend/src/app/layout.js

   1) Add this near the other imports at the top:

        import MockApi from "@/components/MockApi";

   2) Inside <body>, just above <LanguageProvider>, add:

        <MockApi />

   Save. Then go to http://localhost:3000/admin

   TO TURN IT OFF LATER
   Add this line to frontend/.env.local:

        NEXT_PUBLIC_MOCK_API=false

   ...and restart the frontend. The two lines in layout.js can stay.
   ─────────────────────────────────────────────────────────────────────────── */
