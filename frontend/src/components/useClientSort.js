'use client';

import { useState, useMemo } from 'react';

/**
 * useClientSort — sorting for tables whose full dataset is already loaded.
 *
 * Point 11. Use this ONLY where every row is in the browser already. Where a
 * table is paginated by the server, sorting must be done server-side instead
 * (see the sortBy / sortOrder parameters on /api/vendors and /api/invoices),
 * because sorting one page of many would be misleading.
 *
 * Handles the three cases that matter:
 *   - numbers sort numerically, so ₹9,000 comes before ₹10,000
 *   - dates sort chronologically, not as text
 *   - text sorts case-insensitively, so "abc" is not pushed below "ZEBRA"
 *
 * Usage:
 *
 *   const { sort, setSort, sorted } = useClientSort(wallets, {
 *     name:          (w) => w.name,
 *     totalCredited: (w) => w.totalCredited,
 *     createdAt:     (w) => w.createdAt,
 *   });
 *
 *   <SortableTh field="name" sort={sort} setSort={setSort}>Wallet Name</SortableTh>
 *
 *   ...then map over `sorted` instead of the original array.
 */
export default function useClientSort(rows, accessors, defaultSort = { by: '', order: '' }) {
  const [sort, setSort] = useState(defaultSort);

  const sorted = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (!sort.by || !accessors[sort.by]) return rows;

    const get = accessors[sort.by];
    const dir = sort.order === 'asc' ? 1 : -1;

    // Copy first — never sort the array in place, it would mutate state
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);

      // Empty values always sort last, whichever direction is chosen
      const aEmpty = va === null || va === undefined || va === '';
      const bEmpty = vb === null || vb === undefined || vb === '';
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      // Numbers
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }

      // Dates — real Date objects or ISO strings
      const da = va instanceof Date ? va : new Date(va);
      const db = vb instanceof Date ? vb : new Date(vb);
      const bothDates =
        !isNaN(da.getTime()) &&
        !isNaN(db.getTime()) &&
        typeof va !== 'number' &&
        /\d{4}-\d{2}-\d{2}|T\d{2}:/.test(String(va));
      if (bothDates) {
        return (da.getTime() - db.getTime()) * dir;
      }

      // Text — case-insensitive, and numeric-aware so "Item 2" precedes "Item 10"
      return (
        String(va).localeCompare(String(vb), 'en', {
          sensitivity: 'base',
          numeric: true,
        }) * dir
      );
    });
  }, [rows, sort, accessors]);

  return { sort, setSort, sorted };
}
