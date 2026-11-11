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

// Turns a verification bundle zip into reproduction input. verification.json is authoritative, and the enclosed spreadsheets are read through its headerMap.
// ⚠ Column names are never guessed from a language. A column missing from headerMap is dropped, and a missing required column ends the run with an error instead of a reproduction.
// ⚠ Values are not taken on trust: the weight total is re-summed from the entrant file (in buildReproduceInput) and every enclosed file is checked by hash.

import { readTable, zipEntryNames, readZipFile, readZipText } from '../parse/xlsx-min.js';
import { pairKey } from '../parse/compare.js';
import { FIELD_ID } from '../pipeline/fieldId.js';
import { PRELIMINARY_ORDER_TYPE } from '../pipeline/constants.js';
import { resolveLogicVersion } from '../pipeline/logicVersion.js';
import { findCategory } from '../domain/categories.js';
import { buildReproduceInput } from '../domain/buildInput.js';
import { msg, MessageError } from '../msg/index.js';
import { VERIFICATION_JSON, MASS_JSON, validateBundle, hasPrelimLabel, ALL_LABELS } from './schema.js';
import { sha256Bytes } from './sha256Bytes.js';

const bundleError = (code, params, errors) => {
  const e = new MessageError(code, params);
  e.stage = 'bundle';
  if (errors) e.errors = errors;
  return e;
};

const HEX = '0123456789abcdef';
const bytesToHex = (bytes) => {
  let out = '';
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 15];
  return out;
};
const sha256Hex = async (bytes) => bytesToHex(await sha256Bytes(bytes));

const str = (v) => String(v == null ? '' : v);

/**
 * Turns a sheet grid into rows keyed by the internal field names headerMap points at.
 * ⚠ Columns missing from headerMap are dropped: a value whose meaning is unknown never enters reproduction.
 * @param {Array<Array>} grid row 0 is the header
 * @param {object} headerMap { 'sheet header': 'internalField' }
 * @param {{matchPair?: boolean}} [opt] matchPair marks a tournament pairing result file
 * @returns {{rows: Array<object>, fields: string[], unmapped: string[]}}
 */
export const mapGrid = (grid, headerMap, opt) => {
  if (!grid || grid.length < 1) return { rows: [], fields: [], unmapped: [], overWide: 0 };
  const header = grid[0].map((h) => str(h).trim());
  const fields = header.map((h) => headerMap[h] || null);

  // In a pairing result file both entrant columns share a header, so headerMap keeps only one of them (matchEntryData).
  // ⚠ Unless the first of them is restored as the entrant column there is nothing to build the pair key from, and the comparison cannot run.
  if (opt && opt.matchPair && !fields.includes(FIELD_ID.ENTRY_DATA)) {
    const pair = [];
    fields.forEach((f, i) => { if (f === FIELD_ID.MATCH_ENTRY_DATA) pair.push(i); });
    if (pair.length > 1) fields[pair[0]] = FIELD_ID.ENTRY_DATA;
  }
  const unmapped = header.filter((h, i) => h !== '' && fields[i] == null);

  const rows = [];
  let overWide = 0;
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (!raw || raw.every((c) => c === '' || c == null)) continue; // skip empty rows
    // A row wider than the header means a csv value contained a comma and shifted the columns
    if (raw.length > header.length) overWide++;
    const row = {};
    for (let c = 0; c < fields.length; c++) {
      if (fields[c] == null) continue;
      const v = raw[c];
      if (v !== undefined && v !== null && v !== '') row[fields[c]] = v;
    }
    rows.push(row);
  }
  return { rows, fields: fields.filter(Boolean), unmapped, overWide };
};

// Entrant rows. Entry order is the order rids are assigned in, so the order written in the file becomes seq as it stands.
const toEntryRows = (rows) =>
  rows.map((r, i) => {
    const row = { [FIELD_ID.SEQ]: i + 1, [FIELD_ID.ENTRY_DATA]: str(r[FIELD_ID.ENTRY_DATA]) };
    if (r[FIELD_ID.ENTRY_TYPE] != null) row[FIELD_ID.ENTRY_TYPE] = str(r[FIELD_ID.ENTRY_TYPE]);
    if (r[FIELD_ID.ENTRY_ESSENTIAL_DATA] != null) row[FIELD_ID.ENTRY_ESSENTIAL_DATA] = r[FIELD_ID.ENTRY_ESSENTIAL_DATA];
    return row;
  });

// A lottery-number generator result file writes one line per set, with the drawn numbers joined by commas on that line.
// ⚠ The comparison treats one number as one entrant, so each line is expanded back into numbers, keeping the order it was written in.
const splitLottoSetRows = (rows) =>
  rows.flatMap((r) =>
    str(r[FIELD_ID.ENTRY_DATA])
      .split(',')
      .map((v) => ({ ...r, [FIELD_ID.ENTRY_DATA]: v.trim() })),
  );

// Result rows, in the shape the comparer (parse/compare.js) expects. The group label only says where a row sits; the verdict is decided by identity.
// ⚠ In a prelimOrderMain category the main draw is itself the backup ordering, so a numbered backup label in the result file is an order name.
//   Reading it as a backup marker would push every winner into the backup column and disagree with the reproduction.
const toResultRows = (rows, isMatchDraw, prelimOrderMain) => {
  let mainOrder = 0;
  let preOrder = 0;
  return rows.map((r) => {
    const type = str(r[FIELD_ID.WIN_ENTRY_TYPE] != null ? r[FIELD_ID.WIN_ENTRY_TYPE] : r[FIELD_ID.ENTRY_TYPE]);
    const groupRaw =
      r[FIELD_ID.WIN_LIST_ENTRY_GROUP] != null
        ? r[FIELD_ID.WIN_LIST_ENTRY_GROUP]
        : r[FIELD_ID.WIN_ENTRY_GROUP] != null
        ? r[FIELD_ID.WIN_ENTRY_GROUP]
        : r[FIELD_ID.ENTRY_GROUP];
    const group = str(groupRaw);
    const printed = r[FIELD_ID.WINNER_ORDER];
    // The backup marker normally lives in the winning group or class label, but some categories write it in the order column, so both are checked
    const isPreliminary = prelimOrderMain ? false : hasPrelimLabel(group) || hasPrelimLabel(type) || hasPrelimLabel(printed);
    const seq = isPreliminary ? ++preOrder : ++mainOrder;
    const order = printed == null || printed === '' || Number.isNaN(Number(printed)) ? seq : Number(printed);
    const entryData = isMatchDraw
      ? pairKey(r[FIELD_ID.ENTRY_DATA], r[FIELD_ID.MATCH_ENTRY_DATA])
      : str(r[FIELD_ID.ENTRY_DATA]);
    return { entryData, type, group, order, isPreliminary };
  });
};

// Turns the engine-shaped winSettingList of verification.json back into the shape a parsed win-setting file has.
// ⚠ buildReproduceInput expects a parsed file, but a bundle carries the already-mapped list instead, so it is converted back here.
export const toWinSettingParsed = (winSettingList, wsShape) => {
  const shape = wsShape || [FIELD_ID.WIN_COUNT];
  const hasCount = shape[shape.length - 1] === FIELD_ID.WIN_COUNT;
  const labelFields = shape.slice(0, -1);
  const valueField = hasCount ? null : shape[shape.length - 1];

  const main = [];
  const preliminary = [];
  let prelimMode = null;

  for (const w of winSettingList) {
    const labels = labelFields.map((f) => str(w[f]));
    const value = hasCount ? w[FIELD_ID.WIN_COUNT] : str(w[valueField]);
    if (!w[FIELD_ID.IS_PRELIMINARY]) {
      main.push({ labels, value });
      continue;
    }
    // Backup rows: the all mode carries an internal marker in entryType, the by-group mode carries a group name
    // ⚠ A backup row always carries a count, even in shapes whose main rows have no count column (one person per row)
    const isAll = str(w[FIELD_ID.ENTRY_TYPE]) === FIELD_ID.PRELIMINARY_ALL || labels.every((l) => l === '');
    prelimMode = isAll ? PRELIMINARY_ORDER_TYPE.ALL.id : PRELIMINARY_ORDER_TYPE.TYPE.id;
    preliminary.push({ labels, value: w[FIELD_ID.WIN_COUNT], group: isAll ? null : str(w[FIELD_ID.ENTRY_TYPE]) });
  }
  return { main, preliminary, prelimMode, header: [] };
};

// A backup-order draw in the all mode is saved as one "all" row, so the reconstruction must keep that shape for the mode to be told apart
const prelimOrderParsed = (winSettingList) => {
  const rows = winSettingList.filter((w) => !w[FIELD_ID.IS_PRELIMINARY]);
  const isAll = rows.length === 1 && str(rows[0][FIELD_ID.ENTRY_TYPE]) === FIELD_ID.PRELIMINARY_ALL;
  return {
    parsed: {
      main: rows.map((w) => ({
        labels: [isAll ? ALL_LABELS['예비당첨자'] : str(w[FIELD_ID.ENTRY_TYPE])],
        value: w[FIELD_ID.WIN_COUNT],
      })),
      preliminary: [],
      prelimMode: null,
      header: [],
    },
    method: isAll ? PRELIMINARY_ORDER_TYPE.ALL.id : PRELIMINARY_ORDER_TYPE.TYPE.id,
  };
};

// Total winners of a direct-count category, summed from the main rows of winSettingList.
// ⚠ An SMS-entry draw writes 0 in setting.drawingCount and keeps the count only here, so the list is the fallback source.
const mainWinCount = (winSettingList) =>
  (winSettingList || []).reduce((sum, w) => (w[FIELD_ID.IS_PRELIMINARY] ? sum : sum + (Number(w[FIELD_ID.WIN_COUNT]) || 0)), 0);

// Maps the setting of verification.json onto the form values buildReproduceInput reads.
// ⚠ The four lucky-number values are optional: a bundle without them passes undefined through, and only that category treats them as required.
const toForm = (setting, method, drawingCount) => ({
  weightDrawMethod: setting.weightDrawMethod,
  ballNumber: setting.ballNumber,
  drawingCount: drawingCount == null ? setting.drawingCount : drawingCount,
  dupUse: setting.duplicateWinLimitUse,
  dupCount: setting.duplicateWinnerCount,
  dupDetail: setting.duplicateWinnerCountUseType,
  prelimOrderMethod: method,
  startLuckyNumberRange: setting.startLuckyNumberRange,
  endLuckyNumberRange: setting.endLuckyNumberRange,
  lotteryNumberWeightUse: setting.lotteryNumberWeightUse === true,
  lotteryStat: setting.lotteryStat,
  lotteryNumberTrunStartNum: setting.lotteryNumberTrunStartNum,
  lotteryNumberTrunEndNum: setting.lotteryNumberTrunEndNum,
  drawingResultSort: setting.drawingResultSort,
  lotteryBonusNumberUse: setting.lotteryBonusNumberUse,
});

// Reads one enclosed table file and maps it onto internal field names.
// ⚠ csv files are written without quoting, so a value containing a comma shifts the columns. Even one such row makes the read untrustworthy, so it stops.
const readTableOf = (bytes, file, key, opt) => {
  const mapped = mapGrid(readTable(bytes, file.filename), file.headerMap, opt);
  if (mapped.overWide > 0) {
    throw bundleError('msg.bundle.csvAmbiguous', { key, filename: file.filename, count: mapped.overWide });
  }
  return mapped;
};

/**
 * Reads a bundle zip into reproduction input and the rows to compare against.
 * @param {Uint8Array} bytes the bundle zip bytes
 * @returns {Promise<{meta: object, input: object, expected: {rows: Array}, mass: object|null,
 *   fileHashes: {checked: Array, mismatch: string[], missing: string[]}}>}
 */
export const readBundle = async (bytes) => {
  if (!bytes || bytes.length === 0) throw bundleError('msg.bundle.empty');

  let names;
  try {
    names = zipEntryNames(bytes);
  } catch (e) {
    throw bundleError('msg.bundle.notZip');
  }
  if (!names.includes(VERIFICATION_JSON)) throw bundleError('msg.bundle.jsonMissing');

  let bundle;
  try {
    bundle = JSON.parse(readZipText(bytes, VERIFICATION_JSON));
  } catch (e) {
    throw bundleError('msg.bundle.invalidJson');
  }

  const violations = validateBundle(bundle);
  if (violations.length > 0) {
    throw bundleError(violations[0].code, violations[0].params, violations.map((v) => msg(v.code, v.params)));
  }

  // Logic version, decided by the app version in the certificate; a malformed or out-of-range version propagates as an error
  const resolved = resolveLogicVersion({ appVersion: bundle.appVersion });

  const cat = findCategory(bundle.drawing.category.id);
  if (!cat) throw bundleError('msg.bundle.unknownCategory', { value: bundle.drawing.category.id });

  const isMass = !!cat.categoryInfo.isMassDraw;
  const isMatchDraw = !!cat.categoryInfo.matchUse;
  // Lucky-number draws have no entrant file: the number range is the entrant list, so the only enclosed file is the result
  const isRangeEntry = cat.entrySource === 'range';

  // Hash check of the enclosed files: whether anything changed inside the bundle is settled first
  const fileHashes = { checked: [], mismatch: [], missing: [] };
  const fileBytes = {};
  for (const key of Object.keys(bundle.files)) {
    const f = bundle.files[key];
    const entry = names.includes(f.filename) ? readZipFile(bytes, f.filename) : null;
    if (!entry) {
      fileHashes.missing.push(f.filename);
      continue;
    }
    fileBytes[key] = entry;
    const actual = await sha256Hex(entry);
    fileHashes.checked.push({ key, filename: f.filename, expected: f.sha256, actual });
    if (actual !== f.sha256) fileHashes.mismatch.push(f.filename);
  }

  // Entrants: a mass draw carries mass.json instead of an entrant file
  let mass = null;
  let entry = null;
  let manifest = null;
  if (isMass) {
    if (!names.includes(MASS_JSON)) throw bundleError('msg.bundle.massJsonMissing');
    try {
      mass = JSON.parse(readZipText(bytes, MASS_JSON));
    } catch (e) {
      throw bundleError('msg.bundle.massJsonInvalid');
    }
    const summary = typeof mass.manifest === 'string' ? JSON.parse(mass.manifest) : mass.manifest;
    if (!summary || !(Number(summary.totalLines) > 0)) throw bundleError('msg.bundle.massNoTotalLines');
    mass = { ...mass, manifest: summary };
    // buildReproduceInput expects a manifest that also carries the per-file line sum; a bundle holds only the summary, so the total is used for both
    manifest = { totalLines: Number(summary.totalLines), sumLines: Number(summary.totalLines), linesMatch: true };
  } else if (!isRangeEntry) {
    if (!fileBytes.entry) throw bundleError('msg.bundle.entryFileMissing');
    const mapped = readTableOf(fileBytes.entry, bundle.files.entry, 'entry');
    if (!mapped.fields.includes(FIELD_ID.ENTRY_DATA)) throw bundleError('msg.bundle.entryNoColumn');
    entry = { rows: toEntryRows(mapped.rows), unmapped: mapped.unmapped };
  }

  // Result: what the reproduction is compared against
  if (!fileBytes.result) throw bundleError('msg.bundle.resultFileMissing');
  const resultMapped = readTableOf(fileBytes.result, bundle.files.result, 'result', { matchPair: isMatchDraw });
  if (!resultMapped.fields.includes(FIELD_ID.ENTRY_DATA)) throw bundleError('msg.bundle.resultNoColumn');
  const resultRows = toResultRows(
    cat.categoryInfo.isLottoNumberGenerator ? splitLottoSetRows(resultMapped.rows) : resultMapped.rows,
    isMatchDraw,
    !!cat.prelimOrderMain,
  );

  // Win setting: reconstructed from the list in verification.json rather than from a file
  let winSettingParsed = null;
  let prelimOrderMethod = null;
  if (cat.winSetting === 'prelimOrder') {
    const po = prelimOrderParsed(bundle.winSettingList);
    winSettingParsed = po.parsed;
    prelimOrderMethod = po.method;
  } else if (cat.winSetting === 'file') {
    winSettingParsed = toWinSettingParsed(bundle.winSettingList, cat.wsShape);
  }

  // The typed-in count: taken from the setting, and from winSettingList when the setting carries none
  let directCount = null;
  if (cat.winSetting === 'direct' && !(Number(bundle.setting.drawingCount) >= 1)) {
    const summed = mainWinCount(bundle.winSettingList);
    if (summed >= 1) directCount = summed;
  }

  const built = buildReproduceInput({
    category: cat,
    seed: bundle.setting.seed,
    algorithm: bundle.setting.randomAlgorithmType,
    entry,
    winSettingParsed,
    resultParsed: { rows: resultRows },
    manifest,
    form: toForm(bundle.setting, prelimOrderMethod, directCount),
  });
  if (built.errors.length > 0) {
    throw bundleError('msg.bundle.inputInvalid', null, built.errors.map((e) => msg(e.code, e.params)));
  }

  // The weight total written in the bundle against the one re-summed from the entrant file; a difference would make the reproduction a different draw
  const recomputed = built.input.setting.totalDrawingWeight;
  const declared = bundle.setting.totalDrawingWeight;
  const weighed = cat.weight || built.input.setting.lotteryNumberWeightUse === true;
  if (weighed && declared != null && declared !== '' && Number(declared) !== Number(recomputed)) {
    throw bundleError('msg.bundle.weightTotalMismatch', { declared: Number(declared), actual: Number(recomputed) });
  }

  return {
    meta: {
      schemaVersion: bundle.schemaVersion,
      appVersion: resolved.appVersion,
      logicVersion: resolved.logicVersion,
      appVersionUnconfirmed: resolved.unconfirmed,
      createdAt: bundle.createdAt,
      drawing: bundle.drawing,
      setting: bundle.setting,
      category: cat,
      isMass,
      isMatchDraw,
      // A draw that picked backup winners but whose result file yielded no backup label at all must have its verdict held back
      prelimExpected: bundle.winSettingList.filter((w) => w[FIELD_ID.IS_PRELIMINARY]).length > 0,
      prelimSeen: resultRows.some((r) => r.isPreliminary),
      unmappedHeaders: (entry ? entry.unmapped : []).concat(resultMapped.unmapped),
      summary: built.summary,
      warnings: built.warnings.map((w) => msg(w.code, w.params)),
    },
    input: built.input,
    expected: { rows: resultRows },
    mass,
    fileHashes,
  };
};
