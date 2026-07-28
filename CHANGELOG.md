# Incentive Software — Changelog
**Project:** Friends Trading Corporation — Incentive Management System  
**Period:** July 2026 (Last 1 Month)  
**Generated:** 22 July 2026

---

## Summary of All Changes

---

## 1 July 2026 — Commit: `f4e5c76` (changes)

### New Models Added (Backend)

#### `backend/src/models/MonthlyWallet.js` _(New File)_
- Monthly sub-wallet model create kiya gaya
- Har vendor ke liye har month ka alag wallet track hota hai
- Fields: `vendor`, `month`, `year`, `label`, `balance`, `creditedAmount`
- `getOrCreate()` static method — month+year ke basis par wallet dhundta hai ya naya banaata hai

#### `backend/src/models/IncentiveUpload.js` _(New File)_
- Incentive upload history track karne ke liye model
- Fields: `division`, `uploadedBy`, `fileName`, `totalAmount`, `frequency`, `month`, `year`, `walletLabel`, `status`, `items[]`

#### `backend/src/models/WalletTransaction.js` _(Updated)_
- `monthlyWallet` aur `walletLabel` fields add kiye gaye
- Monthly wallet reference ab transactions mein bhi stored hota hai

### Backend Routes Updated

#### `backend/src/routes/incentives.js`
- Upload ke time monthly sub-wallet automatically credit hota hai (`MonthlyWallet.getOrCreate`)
- `GET /api/incentives/monthly-wallets/:vendorId` — vendor ke saare monthly wallets return karta hai
- Upload history `IncentiveUpload` model mein save hoti hai

#### `backend/src/routes/invoices.js`
- Invoice create karte time monthly wallets se bhi amount deduct hota hai
- `redemptions: [{monthlyWalletId, amount}]` array support — multi-wallet split deduction
- FIFO auto-deduct — agar split nahi di to oldest wallets pehle drain hoti hain
- Monthly wallet balance update + WalletTransaction record per wallet

### Frontend Updated

#### `frontend/src/app/(dashboard)/admin/incentives/page.jsx`
- Upload history table show hota hai ab
- Month/Year selector add kiya incentive upload ke liye
- Upload hone ke baad `walletLabel` (e.g. "July 2026") dikhta hai

#### `frontend/src/app/(dashboard)/branch/page.jsx`
- Monthly sub-wallet selector panel add kiya (Incentives Wallet Redemption section)
- "Use Full" button — ek wallet ka poora balance select karta hai
- "Use All" button — saare wallets use karta hai invoice amount tak
- Split summary bar — kitne wallets select hain aur total amount
- Redemption amount auto-sync splits se hota hai

#### `frontend/src/app/(dashboard)/admin/vendors/page.jsx`
- Vendor list UI improvements

---

## 2 July 2026 — Commit: `16354d1` (new addd)

#### `backend/src/config/seed.js`
- Minor seed data fix

---

## 2 July 2026 — Commit: `a20a1db` (add)

#### `frontend/src/app/(dashboard)/branch/page.jsx` _(Major Update)_
- OTP rate-limit UI add kiya — 3 OTPs per 30 minutes
- Live countdown timer — `mm:ss` format mein cooldown dikhta hai
- OTP attempt dots (orange dots) — kitne OTPs use hue dikhta hai
- Success modal mein Reference No. dikhta hai
- Invoice form validation improved
- Split validation — split total = redeem amount check

---

## 4 July 2026 — Commit: `e488425` (addded)

### Backend

#### `backend/src/routes/incentives.js` _(Major Update)_
- `GET /api/incentives/uploads-without-wallets` — Admin route: purane uploads jinke monthly wallets nahi bane unhe dhundta hai
- `POST /api/incentives/create-wallets-from-upload/:uploadId` — Admin route: kisi specific upload ke liye manually monthly wallets create karta hai (vendor balance touch nahi karta)
- `POST /api/incentives/sync-wallet-balances` — Admin utility: sub-wallet balances aur main wallet balance sync karta hai (FIFO drain)
- Auto-create on fetch: `GET /monthly-wallets/:vendorId` ab purane uploads ke liye automatically wallet bana deta hai pehli baar fetch par

#### `backend/src/routes/reports.js`
- Reports endpoint improvements

### Frontend

#### `frontend/src/app/(dashboard)/admin/incentives/page.jsx` _(Major Update)_
- **"Fix Missing Monthly Wallets" panel** add kiya:
  - "Check Uploads" button — purane uploads scan karta hai
  - Per upload: kitne wallets exist hain, kitne missing hain dikhata hai
  - "Create X Wallets" button — missing wallets ek click mein fix karta hai
- Upload history mein `walletLabel` (incentive month) column add kiya

---

## 7 July 2026 — Commit: `b0b5ac5` (new add)

### Backend

#### `backend/src/routes/incentives.js`
- `GET /monthly-wallets/:vendorId` — **Early return fix**: agar vendor ka main wallet 0 hai to empty array return karta hai, koi sub-wallet nahi dikhata
- **FIFO balance cap**: sub-wallet balances ko main wallet balance se cap karta hai (legacy data fix)
- Auto-create: agar vendor balance 0 hai to nayi wallet nahi banata
- Auto-create: nai wallet ka balance `Math.min(item.amount, vendorBalance)` se cap hota hai

### Frontend

#### `frontend/src/app/(dashboard)/branch/page.jsx`
- Monthly wallet list render — zero balance wallets completely hide hoti hain (filter added)
- Section header: wallet count sirf positive balance wallets count karta hai
- "No wallets" message: tab bhi show hota hai jab saari wallets ka balance 0 ho

#### `frontend/src/app/(dashboard)/admin/incentives/page.jsx`
- Minor UI fix

---

## 15 July 2026 — Commit: `6d56533` (new changes)

### Backend

#### `backend/src/routes/vendors.js`
- `GET /api/vendors/:id/transactions` — `.limit(20)` hata diya
- Ab party statement ke liye **saare transactions** return hote hain, sirf last 20 nahi

### Frontend

#### `frontend/src/app/(dashboard)/branch/reports/page.jsx` _(Major Update)_

**Party Statement Table — Invoice No. column added:**
- Pehle sirf "Particulars / Invoice No." ek column tha
- Ab **alag "Invoice No." column** hai
- Wallet Redemption rows mein Invoice No. dikhta hai (`trx.invoice?.invoiceNumber`)
- Invoice Amount column: Wallet Redemption rows mein bhi invoice amount dikhta hai (`trx.invoice?.invoiceAmount`)
- `mappedTransactions`: `invoiceNo` field add kiya
- `mappedInvoices`: `particulars` clean kiya, `invoiceNo` alag field mein
- PDF export, Excel export, Print — sab mein Invoice No. column add kiya
- Table colspans update kiye (9 → 10 columns)

---

## 22 July 2026 — Kiro Session Changes (Not yet committed)

### Backend

#### `backend/src/routes/incentives.js`
- `GET /monthly-wallets/:vendorId` mein aur improvement:
  - Main wallet 0 hone par empty array return (early exit guard)
  - Legacy sub-wallet data fix: returned balances FIFO cap se correct hote hain

### Frontend

#### `frontend/src/app/(dashboard)/branch/page.jsx`
- Sub-wallet filter: `.filter(mw => mw.balance > 0)` — zero balance wallets render nahi hoti
- Section visibility: sirf tab dikhta hai jab koi wallet positive balance mein ho
- Empty state: zero balance wallets hone par bhi "No wallets" message

#### `frontend/src/app/(dashboard)/branch/reports/page.jsx`
- Invoice No. alag column (jo 15 Jul commit se tha, uski continuity)
- `particulars` aur `invoiceNo` dono alag fields
- PDF, Excel, Print sab update

---

## Files Changed — Complete List

| File | Type | Changes |
|------|------|---------|
| `backend/src/models/MonthlyWallet.js` | NEW | Monthly sub-wallet model |
| `backend/src/models/IncentiveUpload.js` | NEW | Upload history model |
| `backend/src/models/WalletTransaction.js` | UPDATED | Monthly wallet fields added |
| `backend/src/routes/incentives.js` | UPDATED | Monthly wallet CRUD, sync, fix endpoints |
| `backend/src/routes/invoices.js` | UPDATED | Multi-wallet split deduction |
| `backend/src/routes/vendors.js` | UPDATED | Removed limit(20) on transactions |
| `backend/src/routes/reports.js` | UPDATED | Reports improvements |
| `backend/src/config/seed.js` | UPDATED | Minor seed fix |
| `frontend/src/app/(dashboard)/admin/incentives/page.jsx` | UPDATED | Fix Missing Wallets panel, upload history |
| `frontend/src/app/(dashboard)/admin/vendors/page.jsx` | UPDATED | UI improvements |
| `frontend/src/app/(dashboard)/branch/page.jsx` | UPDATED | Sub-wallet selector, OTP rate limit, split redemption |
| `frontend/src/app/(dashboard)/branch/reports/page.jsx` | UPDATED | Invoice No. column, Invoice Amount fix |

---

## Key Features Added This Month

1. **Monthly Sub-Wallet System** — Har month ka incentive alag track hota hai
2. **Split Redemption** — Ek invoice pe multiple months ki wallets use kar sakte hain
3. **OTP Rate Limiting** — 3 OTPs per 30 min, live countdown UI
4. **Fix Missing Wallets** — Admin panel se purani wallets fix kar sakte hain
5. **Wallet Sync Utility** — Sub-wallet aur main wallet balance sync
6. **Zero Balance Wallet Hide** — 0 balance wallets ab show nahi hoti
7. **Party Statement Invoice No.** — Report mein invoice number alag column mein
8. **Invoice Amount in Statement** — Redemption rows mein invoice amount dikhta hai
9. **All Transactions in Statement** — 20 limit hata di, poora history dikhta hai
