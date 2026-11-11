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

// Schema of verification.json: required fields, their types, and the violation codes. The bundle writer owns the schema itself.
// ⚠ Only bundles that pass here reach reproduction. Loosening this lets a bundle with missing values come back "verified".

import { findCategory } from '../domain/categories.js';

export const SCHEMA_NAME = 'unipicker-verify-bundle';
export const SCHEMA_VERSION = 1;

export const VERIFICATION_JSON = 'verification.json';
export const MASS_JSON = 'mass.json';

// Kinds of enclosed data file: these are the keys of files and the unit a headerMap applies to
export const FILE_KEYS = ['entry', 'winSetting', 'result'];

// Backup-winner prefixes and their "all" labels. The draw writes these into the result file in whichever UI language it ran in.
// ⚠ Never take them from the screen dictionary: what matters is the language written in the file, not the language on screen.
// ⚠ The same list also lives in domain/buildInput.js; adding a language means changing both.
export const PRELIM_PREFIXES = ['예비당첨자', 'Backup Winner'];
export const ALL_LABELS = { 예비당첨자: '전체', 'Backup Winner': 'All' };

// Whether a result-file label names a backup winner. Group draws prefix it with the group name, so this is a substring test.
export const hasPrelimLabel = (v) => PRELIM_PREFIXES.some((p) => String(v == null ? '' : v).includes(p));

// Required verification.json fields as [path, type]. 'any' only requires a value to be present; empty strings are allowed on the optional side.
const REQUIRED = [
  ['appVersion', 'string'],
  ['createdAt', 'any'],
  ['drawing', 'object'],
  ['drawing.category', 'object'],
  ['drawing.category.id', 'string'],
  ['setting', 'object'],
  ['setting.seed', 'any'],
  ['setting.randomAlgorithmType', 'string'],
  ['winSettingList', 'array'],
  ['files', 'object'],
];

// Optional setting fields, written only by lucky-number draws. A bundle without them must still pass (the schema only gained fields, so schemaVersion stays 1).
// startLuckyNumberRange/endLuckyNumberRange bound the generated entrants; lotteryNumberTrunStartNum/EndNum are the round range lotteryStat was aggregated over.
const OPTIONAL_NUMERIC_SETTING = [
  'startLuckyNumberRange',
  'endLuckyNumberRange',
  'lotteryNumberTrunStartNum',
  'lotteryNumberTrunEndNum',
];

// Result ordering (setting.drawingResultSort), an optional field written only by lucky-number draws.
// ⚠ An empty string is a value: the draw reads it as draw order, so treating it as absent would change the reproduced order.
export const RESULT_SORT_VALUES = ['', 'ASC', 'DESC', 'DRAW'];

const isEmpty = (v) => v === undefined || v === null || v === '';
// A required value that is only whitespace carries no information — it is treated the same as a missing one
const isBlank = (v) => isEmpty(v) || (typeof v === 'string' && v.trim() === '');
// Values the draw reads through Number(): a string is fine as long as it reads as a number
const numberLike = (v) => !isEmpty(v) && Number.isFinite(Number(v));

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const typeOk = (v, type) => {
  if (v == null || v === '') return false;
  if (type === 'any') return true;
  if (type === 'array') return Array.isArray(v);
  if (type === 'object') return typeof v === 'object' && !Array.isArray(v);
  if (type === 'string') return typeof v === 'string';
  if (type === 'number') return typeof v === 'number' && Number.isFinite(v);
  return true;
};

/**
 * Validates the structure of verification.json, collecting every violation (stopping at the first would hide the rest of the causes).
 * @param {object} b the parsed verification.json
 * @returns {Array<{code: string, params: object|null}>} an empty array means it passed
 */
export const validateBundle = (b) => {
  const out = [];
  const add = (code, params) => out.push({ code, params: params || null });

  if (!b || typeof b !== 'object' || Array.isArray(b)) {
    add('msg.bundle.notObject');
    return out;
  }
  if (b.schema !== SCHEMA_NAME) add('msg.bundle.schema', { value: String(b.schema), expected: SCHEMA_NAME });
  if (Number(b.schemaVersion) !== SCHEMA_VERSION) {
    add('msg.bundle.schemaVersion', { value: String(b.schemaVersion), expected: SCHEMA_VERSION });
  }

  for (const [path, type] of REQUIRED) {
    const v = at(b, path);
    // ⚠ A blank string counts as missing: it passes a type check but reads as "nothing was passed" downstream,
    //   which would skip the support-floor check on the app version.
    if (isBlank(v)) add('msg.bundle.fieldMissing', { field: path });
    else if (!typeOk(v, type)) add('msg.bundle.fieldType', { field: path, type });
  }

  if (b.setting && typeof b.setting === 'object' && !Array.isArray(b.setting)) {
    for (const key of OPTIONAL_NUMERIC_SETTING) {
      const v = b.setting[key];
      if (isEmpty(v)) continue; // optional field: absent is fine
      if (!numberLike(v)) add('msg.bundle.fieldType', { field: `setting.${key}`, type: 'number' });
    }

    // Whether a bonus number was used, written only by lottery-number draws. When present it must be a boolean.
    const bonus = b.setting.lotteryBonusNumberUse;
    if (bonus !== undefined && typeof bonus !== 'boolean') {
      add('msg.bundle.fieldType', { field: 'setting.lotteryBonusNumberUse', type: 'boolean' });
    }

    const sort = b.setting.drawingResultSort;
    if (sort !== undefined && !RESULT_SORT_VALUES.includes(sort)) {
      add('msg.bundle.fieldType', { field: 'setting.drawingResultSort', type: RESULT_SORT_VALUES.map((v) => v || "''").join('|') });
    }

    // Lottery weight snapshot: the weight of number i is read as lotteryStat[i - 1].
    // ⚠ The array index is the number. A gap, or an array shorter than the number range, makes reproduction run on different weights.
    const stat = b.setting.lotteryStat;
    if (stat !== undefined && stat !== null) {
      const end = Number(b.setting.endLuckyNumberRange);
      const need = Number.isFinite(end) && end > 0 ? end : 1;
      const ok = Array.isArray(stat) && stat.length >= need && stat.slice(0, need).every(numberLike);
      if (!ok) add('msg.bundle.fieldType', { field: 'setting.lotteryStat', type: `array(1..${need})` });
    }
  }

  if (Array.isArray(b.winSettingList)) {
    // Categories with no win setting at all, such as tournament pairings (winSetting: 'none' in domain/categories.js), legitimately have an empty list.
    // ⚠ An unknown category is not allowed to be empty, or a bundle with a missing setting would pass.
    const cat = findCategory(at(b, 'drawing.category.id'));
    if (b.winSettingList.length < 1) {
      if (!cat || cat.winSetting !== 'none') add('msg.bundle.winSettingEmpty');
    }
    else {
      for (let i = 0; i < b.winSettingList.length; i++) {
        const w = b.winSettingList[i];
        if (!w || typeof w !== 'object') add('msg.bundle.winSettingRow', { index: i + 1 });
        else if (w.winCount == null || w.winCount === '') add('msg.bundle.winSettingCount', { index: i + 1 });
      }
    }
  }

  if (b.files && typeof b.files === 'object') {
    for (const key of Object.keys(b.files)) {
      const f = b.files[key];
      if (!f || typeof f !== 'object') add('msg.bundle.fileEntry', { key });
      else if (!f.filename) add('msg.bundle.fileFilename', { key });
      else if (!f.sha256) add('msg.bundle.fileSha256', { key });
      else if (!f.headerMap || typeof f.headerMap !== 'object' || Object.keys(f.headerMap).length < 1) {
        add('msg.bundle.fileHeaderMap', { key });
      }
    }
  }

  return out;
};
