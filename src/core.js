/**
 * Boyer–Moore exact substring matching.
 *
 * The algorithm combines two heuristics so that, after a mismatch, the
 * needle can be shifted further than the naive one step:
 *
 *   - Bad-character: shift so the text character that caused the mismatch
 *     lines up with its rightmost earlier occurrence in the needle (if any).
 *   - Good-suffix: when a non-empty suffix of the needle matched, shift so
 *     that another occurrence of that suffix (or a suffix of that suffix)
 *     lines up with the text we already matched.
 *
 * The good-suffix rule is the one most implementations get wrong, because
 * the shift table has two interlocking cases. We precompute it fully below
 * using the standard “border” array approach, which is O(n) in needle
 * length and keeps the inner search loop branch-free with respect to table
 * construction.
 *
 * Trade-off: we do O(m + |alphabet|) preprocessing up front and allocate a
 * fixed 256-entry bad-character table. This is ideal when the same needle is
 * reused across many searches; for a single one-off search of a tiny needle
 * the preprocessing overhead exceeds the gain.
 */

/**
 * Build the bad-character shift table for a needle.
 *
 * For each byte value we record the index of its rightmost occurrence in the
 * needle. On a mismatch we can then shift the needle so that the offending
 * text character aligns with that rightmost occurrence. If the character does
 * not occur at all, the value stays at -1 and the needle can skip entirely
 * past it.
 *
 * We operate over byte values (0–255) rather than full UTF-16 code units so
 * the table size is bounded by a constant regardless of input. Because
 * JavaScript strings are UTF-16, a code point above U+00FF will simply never
 * match any entry — its shift degenerates to “advance one position”, which
 * is correct (there is no earlier occurrence of it to align to).
 *
 * @param {string} needle
 * @returns {Int32Array} 256-entry table of rightmost indices, -1 if absent.
 */
export function buildBadCharTable(needle) {
  const table = new Int32Array(256).fill(-1);
  for (let i = 0; i < needle.length; i++) {
    const code = needle.charCodeAt(i) & 0xff;
    table[code] = i;
  }
  return table;
}

/**
 * Build the good-suffix shift table.
 *
 * `shift[i]` is the amount the needle may safely advance when the mismatch
 * occurs at needle index `i` (so characters `i+1 .. m-1` matched). The table
 * is indexed by the mismatch position, not the match length, which keeps the
 * lookup in the inner loop a single array read.
 *
 * The construction uses a border array `bord` where `bord[i]` is the length
 * of the longest proper suffix of `needle[i..m-1]` that is also a prefix of
 * the needle. A second pass then propagates the best shift to lower indices
 * so every mismatch position gets the smallest safe shift greater than zero.
 *
 * Why not the simpler “suffix is also a suffix of the needle” rule? That rule
 * misses the case where only a suffix of the matched suffix occurs at the
 * start of the needle. The border-array formulation captures both cases in a
 * single uniform table.
 *
 * @param {string} needle
 * @returns {Int32Array} shift amounts, indexed by mismatch position [0..m].
 */
export function buildGoodSuffixTable(needle) {
  const m = needle.length;
  // shift[i] applies when the mismatch is at index i; shift[m] is the
  // "matched the whole needle" case used for the overlap on repeat.
  const shift = new Int32Array(m + 1);
  const bord = new Int32Array(m + 1);

  // Compute borders of the whole needle. bord[i] = length of the longest
  // proper suffix of needle[i..m-1] that equals needle[0..bord[i]-1].
  let i = m;
  let j = m + 1;
  bord[i] = j;
  while (i > 0) {
    while (j <= m && needle.charCodeAt(i - 1) !== needle.charCodeAt(j - 1)) {
      if (shift[j] === 0) {
        shift[j] = j - i;
      }
      j = bord[j];
    }
    i--;
    j--;
    bord[i] = j;
  }

  // Fill shift[1..m] using the border chain. For each j, shift[j] is set to
  // the smallest positive distance to a position whose border covers j.
  j = bord[0];
  let k = 0;
  while (j <= m) {
    for (; k <= j - 1; k++) {
      if (shift[k] === 0) {
        shift[k] = j - k;
      }
    }
    k = j + 1;
    j = bord[j];
  }

  // shift[0] is never read by the search loop (we never mismatch at index -1),
  // but fill it defensively in case callers inspect the table directly.
  if (shift[0] === 0) {
    shift[0] = 1;
  }
  return shift;
}

/**
 * Find all occurrences of `needle` in `haystack` and return their start
 * indices in ascending order. An empty needle returns a single result at
 * index 0, which is the standard convention (the empty string occurs once at
 * the start of any string and nowhere else — Boyer–Moore would otherwise
 * loop forever because both shift tables collapse to zero).
 *
 * Returns a frozen `number[]` so callers cannot mutate the internal result;
 * the type annotation reflects the concrete array type Node’s `--test`
 * reporter expects when comparing with `assert.deepStrictEqual`.
 *
 * @param {string} haystack
 * @param {string} needle
 * @returns {number[]}
 */
export function search(haystack, needle) {
  const n = haystack.length;
  const m = needle.length;

  if (m === 0) {
    return [0];
  }
  if (m > n) {
    return [];
  }

  const badChar = buildBadCharTable(needle);
  const goodSuffix = buildGoodSuffixTable(needle);
  const result = [];

  let s = 0; // alignment of needle[0] against haystack
  while (s <= n - m) {
    let j = m - 1;
    while (j >= 0 && needle.charCodeAt(j) === haystack.charCodeAt(s + j)) {
      j--;
    }
    if (j < 0) {
      result.push(s);
      // Full match: the good-suffix table at index m gives the smallest
      // shift that preserves any overlapping occurrence.
      s += Math.max(1, goodSuffix[m]);
    } else {
      const bc = badChar[haystack.charCodeAt(s + j) & 0xff];
      const bcShift = j - bc; // >= 1 once bc < j, else could be <= 0
      s += Math.max(goodSuffix[j], bcShift, 1);
    }
  }

  return result;
}
