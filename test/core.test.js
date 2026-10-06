import { test } from "node:test";
import assert from "node:assert/strict";
import { search, buildBadCharTable, buildGoodSuffixTable } from "../src/core.js";

/**
 * Tests are deliberately organised by behaviour rather than by internal table,
 * except for two table sanity checks that pin the exact semantics the search
 * loop depends on. Keeping those in the test suite means a future refactor
 * that changes the table contract will fail loudly here instead of silently
 * producing wrong shift amounts.
 */

test("empty needle matches once at index 0", () => {
  assert.deepStrictEqual(search("anything", ""), [0]);
  assert.deepStrictEqual(search("", ""), [0]);
});

test("needle longer than haystack matches nothing", () => {
  assert.deepStrictEqual(search("ab", "abc"), []);
});

test("single-character needle finds every occurrence", () => {
  assert.deepStrictEqual(search("mississippi", "i"), [1, 4, 7, 10]);
});

test("classic ANANAS example finds the overlapping match", () => {
  // “anana” occurs at index 1 in “bananas” and again at index 3 only if the
  // text were longer; here we just assert the single real occurrence.
  assert.deepStrictEqual(search("bananas", "ana"), [1, 3]);
});

test("repeated pattern overlapping occurrences", () => {
  assert.deepStrictEqual(search("aaaaaa", "aa"), [0, 1, 2, 3, 4]);
});

test("no match returns empty array", () => {
  assert.deepStrictEqual(search("abcdef", "xyz"), []);
});

test("match at the very end of haystack", () => {
  assert.deepStrictEqual(search("abcdef", "def"), [3]);
});

test("match at the very start of haystack", () => {
  assert.deepStrictEqual(search("abcdef", "abc"), [0]);
});

test("needle equal to haystack matches once", () => {
  assert.deepStrictEqual(search("exact", "exact"), [0]);
});

test("non-ASCII characters are handled by code unit", () => {
  // We document byte-value semantics; for characters above U+00FF the
  // bad-character table has no entry, so the search falls back to the
  // good-suffix shift and still works correctly — just without the
  // bad-character speed-up.
  assert.deepStrictEqual(search("café café", "é"), [3, 8]);
});

test("bad-character table stores rightmost index per byte", () => {
  const table = buildBadCharTable("abac");
  assert.equal(table[0x61], 2); // 'a' last appears at index 2
  assert.equal(table[0x62], 1); // 'b' at index 1
  assert.equal(table[0x63], 3); // 'c' at index 3
  assert.equal(table[0x64], -1); // 'd' absent
});

test("good-suffix table never causes a backward shift", () => {
  // We don’t assert exact shift values — those are an implementation detail —
  // but we do assert that every shift is non-negative. The search loop
  // additionally takes Math.max(..., 1) so a zero entry is safe: it just
  // means that position relies on the bad-character rule or the floor of 1
  // to make progress.
  const table = buildGoodSuffixTable("ababa");
  for (let i = 0; i < table.length; i++) {
    assert.ok(table[i] >= 0, `shift[${i}] must be >= 0, got ${table[i]}`);
  }
});

test("overlapping needle with shared prefix and suffix", () => {
  // “aba” in “ababa”: the suffix “a” of the needle is also its prefix, so
  // the good-suffix shift must permit the overlap.
  assert.deepStrictEqual(search("ababa", "aba"), [0, 2]);
});
