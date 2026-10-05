/**
 * Boyer–Moore exact substring search, exported as a single function.
 *
 * This module re-exports the search routine from core.js so the public
 * entry point stays stable even if internals are reorganised.
 */
export { search, buildBadCharTable, buildGoodSuffixTable } from "./core.js";
