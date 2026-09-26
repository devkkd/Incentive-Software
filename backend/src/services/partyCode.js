/**
 * Party code helpers.
 *
 * Party codes are stored exactly as issued (e.g. "123", "TRJ028") — the branch
 * is NOT part of the code any more. The branch lives in Vendor.division.
 *
 * Older records carry one or more branch prefixes ("WSG-123", "WSG-WSG-123").
 * normalizePartyCode() strips those, so the same party typed with or without
 * a prefix always resolves to one code.
 */
const Division = require('../models/Division');
const Vendor = require('../models/Vendor');

let _divCache = { at: 0, names: [] };

/** Branch names (AJM, WSG, …), cached for a minute. */
async function getDivisionNames() {
  if (Date.now() - _divCache.at < 60 * 1000 && _divCache.names.length) return _divCache.names;
  const names = (await Division.find().select('name').lean())
    .map((d) => String(d.name || '').toUpperCase().trim())
    .filter(Boolean)
    // Longest first, so "BT8" is tried before a shorter name that is its prefix
    .sort((a, b) => b.length - a.length);
  _divCache = { at: Date.now(), names };
  return names;
}

/**
 * Strip every leading "<BRANCH>-" prefix and tidy the code.
 *   "WSg-WSG-123123" → "123123"
 *   " joh-tRj028 "   → "TRJ028"
 */
function stripPrefixes(raw, divisionNames) {
  let code = String(raw ?? '').trim().toUpperCase();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const name of divisionNames) {
      const prefix = `${name}-`;
      if (code.startsWith(prefix) && code.length > prefix.length) {
        code = code.slice(prefix.length).trim();
        stripped = true;
        break;
      }
    }
  }
  return code;
}

async function normalizePartyCode(raw) {
  return stripPrefixes(raw, await getDivisionNames());
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Find the ONE party a code refers to.
 *
 * 1. Exact match on the cleaned code (the normal case once codes are cleaned).
 * 2. Legacy fallback: codes still stored with a prefix ("WSG-123"). Only
 *    accepted when exactly one party matches — if two branches hold the same
 *    code, returning "the first one" is how incentives landed on the wrong
 *    account before, so it is refused instead.
 *
 * Returns { vendor, ambiguous: [...] }.
 */
async function findPartyByCode(raw, { select, lean = false } = {}) {
  const code = await normalizePartyCode(raw);
  if (!code) return { vendor: null, ambiguous: [], code };

  const exactQ = Vendor.find({ accountNumber: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } });
  const legacyQ = Vendor.find({ accountNumber: { $regex: `-${escapeRegex(code)}$`, $options: 'i' } });
  if (select) { exactQ.select(select); legacyQ.select(select); }
  if (lean) { exactQ.lean(); legacyQ.lean(); }

  const exact = await exactQ;
  const names = await getDivisionNames();
  // Legacy matches must genuinely be "<branch prefixes>-code", not e.g. "X-123"
  const legacy = (await legacyQ).filter(
    (v) => stripPrefixes(v.accountNumber, names) === code && String(v.accountNumber).toUpperCase() !== code
  );

  const all = [...exact, ...legacy];
  if (all.length === 1) return { vendor: all[0], ambiguous: [], code };
  if (all.length > 1) return { vendor: null, ambiguous: all, code };
  return { vendor: null, ambiguous: [], code };
}

/**
 * Is this cleaned code already used by another party (with or without prefix)?
 */
async function findCodeConflict(code, excludeId = null) {
  const names = await getDivisionNames();
  const candidates = await Vendor.find({
    accountNumber: { $regex: `(^|-)${escapeRegex(code)}$`, $options: 'i' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('_id accountNumber companyName division')
    .populate('division', 'name')
    .lean();
  return candidates.find((v) => stripPrefixes(v.accountNumber, names) === code) || null;
}

module.exports = {
  getDivisionNames,
  stripPrefixes,
  normalizePartyCode,
  findPartyByCode,
  findCodeConflict,
  escapeRegex,
};
