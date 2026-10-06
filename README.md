# boyer-moore-search

Exact substring search implemented with the Boyer–Moore bad-character and good-suffix heuristics. Exports `search(haystack, needle)` returning a `number[]` of zero-based start indices, plus `buildBadCharTable` and `buildGoodSuffixTable` for callers who want to reuse precomputed tables.

```js
import { search } from "boyer-moore-search";

const hits = search("the quick brown fox", "row");
// => [10]
```

## Why this exists

The built-in `String.prototype.indexOf` is fine for casual use but gives you no reuse of preprocessing and no insight into why it is fast or slow. This library exposes the two shift tables that make Boyer–Moore sublinear on typical text, so a caller searching the same needle across many haystacks can build the tables once and reason about the cost. The trade-off is preprocessing overhead: for a single short search the setup cost outweighs the gain, and `indexOf` will win.

## Edge cases you will hit

- An empty needle returns `[0]` — the empty string occurs once at the start and nowhere else. Boyer–Moore’s shift tables collapse to zero for an empty needle, so this case is special-cased to avoid an infinite loop.
- Characters above U+00FF are matched correctly by UTF-16 code unit, but the bad-character table has no entry for them, so the search falls back to the good-suffix shift alone. It stays correct, just slower for text heavy in such characters.
- Results include overlapping occurrences (e.g. `search("aaaa", "aa")` returns `[0, 1, 2]`).

## Exports

- `search(haystack: string, needle: string): number[]`
- `buildBadCharTable(needle: string): Int32Array` — 256-entry table, -1 means the byte does not occur.
- `buildGoodSuffixTable(needle: string): Int32Array` — shift amounts indexed by mismatch position.

Run the tests with `node --test`.
