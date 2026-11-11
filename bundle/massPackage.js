// Copyright (c) 2026 ㈜유니피커. All rights reserved.
//
// 이 소스 코드는 추첨 로직을 제3자가 확인할 수 있도록 열람 목적으로 공개합니다.
// 개별 추첨 결과의 검증은 저작권자가 제공하는 공식 웹 검증 환경에서 수행합니다.
// 열람은 허용하지만 직접 실행하거나 빌드할 수 없습니다. 저작권자의 사전 서면 동의 없이
// 복제, 수정, 배포, 재배포, 2차적저작물 작성과 그 밖의 상업적·비상업적 이용을 할 수 없습니다.
// 자세한 이용 조건은 저장소 루트의 LICENSE 를 참조하십시오.
//
// This source code is published so third parties can inspect the draw logic. Verification of an
// individual draw result is performed in the official web verification environment provided by
// the copyright holder. Inspection is permitted; direct execution or building is not. Copying,
// modification, distribution, redistribution, creation of derivative works, and any other
// commercial or non-commercial use are prohibited without the copyright holder's prior written
// consent. See LICENSE in the repository root for the complete terms.

// Checks the original mass-draw package zip against the bundle's mass.json: package identity, per-file sha256, merkle root and the identity of each winning line.
// ⚠ Each file is inflated once, hashed, and mined for its winning lines in the same pass. Inflating everything, or twice, blows up memory on a large package.
// ⚠ The merkle root and file-name rules must match the package writer character for character, or a genuine package looks tampered with.

import { unzipSync, strFromU8 } from '../vendor/fflate.js';
import { MessageError } from '../msg/index.js';
import { sha256Bytes } from './sha256Bytes.js';

const MANIFEST_NAME = 'manifest.json';

// Data file naming rule, {firstLine}-{lastLine}.txt|csv: the same expression the manifest check uses
const RANGE_NAME = /^(\d+)-(\d+)\.(txt|csv)$/i;

const packageError = (code, params) => {
  const e = new MessageError(code, params);
  e.stage = 'package';
  return e;
};

const HEX = '0123456789abcdef';

const bytesToHex = (bytes) => {
  let out = '';
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 15];
  return out;
};

const hexToBytes = (hex) => {
  const s = String(hex || '');
  const out = new Uint8Array(s.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
};

/**
 * Merkle root of a list of hex hashes.
 * ⚠ Each layer pairs its nodes and duplicates the last leaf when the count is odd, exactly as the package writer does. A different rule changes the value entirely.
 * @param {string[]} hexList sha256 hex values in file order
 * @returns {Promise<string|null>} null for an empty list
 */
export const merkleRootFromHexList = async (hexList) => {
  if (!hexList || hexList.length === 0) return null;
  let layer = hexList.map(hexToBytes);
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left; // an odd count duplicates the last node
      const pair = new Uint8Array(left.length + right.length);
      pair.set(left, 0);
      pair.set(right, left.length);
      next.push(await sha256Bytes(pair));
    }
    layer = next;
  }
  return bytesToHex(layer[0]);
};

// Lists zip entry names only: returning false from filter keeps fflate from inflating the entry
const entryNames = (zipBytes) => {
  const names = [];
  unzipSync(zipBytes, {
    filter: (f) => {
      names.push(f.name);
      return false;
    },
  });
  return names;
};

const readEntry = (zipBytes, name) => {
  const files = unzipSync(zipBytes, { filter: (f) => f.name === name });
  return files[name] || null;
};

/**
 * Maps a global line number to a file and a line inside it.
 * @param {Array} files manifest.files ([{filename,start,end}])
 * @param {number} lineNo 1-based global line number
 * @returns {{filename: string, offset: number}|null} offset is the 0-based line index within the file
 */
export const locateLine = (files, lineNo) => {
  for (const f of files) {
    if (lineNo >= f.start && lineNo <= f.end) return { filename: f.filename, offset: lineNo - f.start };
  }
  return null;
};

const asObject = (v) => {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch (e) {
      return null;
    }
  }
  return typeof v === 'object' ? v : null;
};

// Compares the package summary written in the bundle with the same fields in the package manifest, returning the first difference only
const summaryDiff = (summary, manifest) => {
  for (const field of ['totalLines', 'totalFiles']) {
    const want = summary[field];
    if (want == null) continue; // a field the bundle does not carry is not compared
    const got = field === 'totalFiles' && manifest.totalFiles == null ? manifest.files.length : manifest[field];
    if (Number(want) !== Number(got)) return { field, expected: want, actual: got };
  }
  return null;
};

// Consistency between the file name ({first}-{last}.ext) and its metadata (start, end, lines, ext): the same check the manifest writer applies
const rangeDefect = (f) => {
  const m = RANGE_NAME.exec(String(f.filename || ''));
  if (!m) return null; // a name outside the rule is skipped, as it is when the package is written
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (f.lines !== end - start + 1) return { filename: f.filename, reason: 'lines' };
  if (f.start !== start || f.end !== end) return { filename: f.filename, reason: 'range' };
  if (f.ext !== `.${m[3].toLowerCase()}`) return { filename: f.filename, reason: 'ext' };
  return null;
};

/**
 * Verifies the original mass-draw package zip.
 * ⚠ No file is inflated twice: the winning lines are taken in the same pass that hashes it, then the bytes are dropped.
 * @param {Uint8Array} packageBytes the original package zip the user uploaded
 * @param {{manifest: object|string, winnerLines: number[]}} massJson mass.json from the bundle
 * @param {{onFile?: (info: {filename: string, index: number, total: number}) => void}} [opts] onFile is called once per entry actually inflated
 * @returns {Promise<{ok: boolean, packageHash: string, packageHashMatch: boolean|null,
 *   manifestMatch: boolean, manifestDiff: object|null, rangeMismatch: Array,
 *   fileHashMismatch: Array<{filename: string, expected: string, actual: string|null}>,
 *   merkleMatch: boolean, merkleRoot: string|null, expectedMerkleRoot: string|null,
 *   identities: Map<number, string>, missingLines: number[]}>}
 */
export const verifyMassPackage = async (packageBytes, massJson, opts = {}) => {
  const onFile = opts.onFile || (() => {});

  if (!packageBytes || packageBytes.length === 0) throw packageError('msg.package.empty');

  const summary = asObject(massJson && massJson.manifest);
  if (!summary) throw packageError('msg.package.massJsonNoManifest');

  const names = entryNames(packageBytes);
  // When manifest.json sits in a subfolder the data files are relative to that folder too, so its directory is the base
  const manifestName = names.find((n) => n === MANIFEST_NAME || n.endsWith(`/${MANIFEST_NAME}`));
  if (!manifestName) throw packageError('msg.package.manifestMissing');
  const baseDir = manifestName.slice(0, manifestName.length - MANIFEST_NAME.length);

  const manifestBytes = readEntry(packageBytes, manifestName);
  onFile({ filename: MANIFEST_NAME, index: 0, total: 0 });

  let manifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch (e) {
    throw packageError('msg.package.manifestInvalidJson');
  }
  if (manifest.schema !== 'manifest') throw packageError('msg.package.manifestSchema', { value: String(manifest.schema) });
  if (!Array.isArray(manifest.files) || manifest.files.length < 1) throw packageError('msg.package.manifestNoFiles');

  // ① Compare against the summary written in the bundle
  const manifestDiff = summaryDiff(summary, manifest);

  // ② Hash of the whole package zip: the bundle's hashCode decides whether this is the very package the draw ran on
  const packageHash = bytesToHex(await sha256Bytes(packageBytes));
  const packageHashMatch = summary.hashCode == null ? null : packageHash === String(summary.hashCode);

  // ③ Group the winning lines by file, so they can be taken while that file is inflated
  const winnerLines = Array.isArray(massJson.winnerLines) ? massJson.winnerLines : [];
  const wantByFile = new Map();
  const missingLines = [];
  for (const raw of winnerLines) {
    const lineNo = Number(raw);
    const loc = Number.isFinite(lineNo) ? locateLine(manifest.files, lineNo) : null;
    if (!loc) {
      missingLines.push(raw);
      continue;
    }
    if (!wantByFile.has(loc.filename)) wantByFile.set(loc.filename, []);
    wantByFile.get(loc.filename).push({ lineNo, offset: loc.offset });
  }

  // ④ Inflate each file once: hash it and pull its winning lines
  const rangeMismatch = [];
  const fileHashMismatch = [];
  const identities = new Map();
  const hashes = [];
  const total = manifest.files.length;

  for (let i = 0; i < total; i++) {
    const f = manifest.files[i];
    const defect = rangeDefect(f);
    if (defect) rangeMismatch.push(defect);

    const entry = readEntry(packageBytes, `${baseDir}${f.filename}`);
    onFile({ filename: f.filename, index: i, total });

    if (!entry) {
      fileHashMismatch.push({ filename: f.filename, expected: f.sha256, actual: null });
      hashes.push(null);
      continue;
    }

    const hex = bytesToHex(await sha256Bytes(entry));
    hashes.push(hex);
    if (hex !== f.sha256) fileHashMismatch.push({ filename: f.filename, expected: f.sha256, actual: hex });

    const wants = wantByFile.get(f.filename);
    if (wants) {
      // Same line splitting as the writer: split on \n and strip the \r of a Windows CRLF
      const lines = strFromU8(entry).split(/\r?\n/);
      for (const { lineNo, offset } of wants) {
        const v = lines[offset];
        if (v == null) missingLines.push(lineNo);
        else identities.set(lineNo, v);
      }
    }
  }

  // ⑤ Merkle root: with even one file missing there is nothing to recompute
  const merkleRoot = hashes.includes(null) ? null : await merkleRootFromHexList(hashes);
  const expectedMerkleRoot = (manifest.aggregate && manifest.aggregate.merkleRoot) || null;
  const merkleMatch = merkleRoot != null && merkleRoot === expectedMerkleRoot;

  const manifestMatch = manifestDiff === null;
  const ok =
    manifestMatch &&
    packageHashMatch !== false &&
    rangeMismatch.length === 0 &&
    fileHashMismatch.length === 0 &&
    merkleMatch &&
    missingLines.length === 0;

  return {
    ok,
    packageHash,
    packageHashMatch,
    manifestMatch,
    manifestDiff,
    rangeMismatch,
    fileHashMismatch,
    merkleMatch,
    merkleRoot,
    expectedMerkleRoot,
    identities,
    missingLines,
  };
};
