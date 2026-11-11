# vendor — pinned dependencies

To produce byte-for-byte the same randomness as the app, these libraries must stay pinned to the
**exact versions the app uses**. The original files are copied here verbatim so the static page can
import them with no npm install step.

| File | Source | Version | SHA-256 |
|---|---|---|---|
| `rand-seed.js` | `rand-seed/dist/es/index.js` | 2.1.7 | `ad2f336e6adb691efdc53ecb43b0904a0b7efd3dc2046005216dc72e12728411` |
| `js-sha256.umd.js` | `js-sha256/src/sha256.js` | 0.11.1 | `2db6c8e554fbee14672368a0d7551a8ddd841ee96c91526eb7987a0179cfc717` |
| `fflate.js` | `fflate/esm/browser.js` | 0.8.2 | `8cc1f687e0159e977addb6b85e274dbd11e622cf151f4fcb7b85d49622ea43e7` |

- `rand-seed.js` — the original is already self-contained ESM (`export { PRNG, default }`), so it
  imports directly in both browser and Node with no changes.
- `js-sha256.umd.js` — the original is UMD (it assigns `sha256` to the global scope). `js-sha256.js`
  wraps it and re-exports it as a named ESM export.

⚠ Never edit these files. A single changed character breaks reproduction of the golden hashes.
When bumping a version, update the SHA-256 column in the table as well.

## Licenses

These libraries are MIT licensed. Redistribution requires including the license text, so the
originals are kept in this folder.

- `js-sha256` → `LICENSE-js-sha256.txt`
- `rand-seed` → `LICENSE-rand-seed.txt`
- `fflate` → `LICENSE-fflate.txt`

## fflate

`fflate.js` has nothing to do with reproducing randomness — it decompresses the uploaded `.xlsx`
and bulk zip files in the browser so they can be read (`unzipSync`, `strFromU8`). For large zips
the reader passes a filter so only the needed entries are inflated, keeping memory down.
