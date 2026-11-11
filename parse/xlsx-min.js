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

// Minimal browser reader for the saved .xlsx/.csv/zip files: fflate for inflation plus sheet XML parsing, no spreadsheet library.
// ⚠ The files carry a single sheet ('data') written inline as t="str", but shared strings and inlineStr are handled too, just in case.
// ⚠ Past 1,048,576 rows the writer falls back to csv, so the reader is chosen by extension to keep those files readable.

import { unzipSync, strFromU8 } from '../vendor/fflate.js';
import { MessageError } from '../msg/index.js';

const toBytes = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));

// Restores XML entities (&amp; last, so it cannot re-trigger the others)
const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

// Column letters of a cell reference to a 0-based index ("A" to 0, "AB" to 27)
const colIndex = (ref) => {
  const m = /^([A-Z]+)/.exec(ref);
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// Joins the <t>...</t> fragments into one string, which also covers rich-text runs
const joinT = (xml) =>
  (xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => unescapeXml(t.replace(/<t[^>]*>/, '').replace(/<\/t>/, ''))).join('');

// Shared string table
const parseSharedStrings = (xml) => (xml.match(/<si>[\s\S]*?<\/si>/g) || []).map(joinT);

// Sheet XML to a grid of strings. Cell references fix the column positions, so empty cells survive.
const parseSheet = (xml, shared) => {
  const rows = [];
  for (const rowXml of xml.match(/<row[\s>][\s\S]*?<\/row>/g) || []) {
    const arr = [];
    for (const cell of rowXml.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const rMatch = /\br="([A-Z]+\d+)"/.exec(cell);
      const col = rMatch ? colIndex(rMatch[1]) : arr.length;
      const t = (/\bt="([^"]*)"/.exec(cell) || [, ''])[1];
      let val = '';
      if (t === 's') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(cell);
        val = v ? shared[Number(v[1])] || '' : '';
      } else if (t === 'inlineStr') {
        const is = /<is>[\s\S]*?<\/is>/.exec(cell);
        val = is ? joinT(is[0]) : '';
      } else {
        // A value with leading/trailing spaces is written as <v xml:space="preserve">, so the tag may carry attributes
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cell);
        val = v ? unescapeXml(v[1]) : '';
      }
      arr[col] = val;
    }
    for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
    rows.push(arr);
  }
  return rows;
};

// .xlsx bytes to the grid of the first worksheet
export const readXlsx = (data) => {
  const files = unzipSync(toBytes(data));
  const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings(strFromU8(files['xl/sharedStrings.xml'])) : [];
  const sheet = Object.keys(files)
    .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
    .sort()[0];
  if (!sheet) throw new MessageError('msg.parse.worksheetMissing');
  return parseSheet(strFromU8(files[sheet]), shared);
};

// How these csv files are written: one BOM, rows joined by newlines, each row the default toString of an array (comma joined).
// ⚠ The writer never quotes, so neither does this reader. Reading it as RFC 4180 would strip quotes inside a value and change the identity.
// ⚠ The cost is that a value containing a comma shifts the columns; the caller detects that (a row wider than the header).
export const readCsv = (data) => {
  let text = strFromU8(toBytes(data));
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip the BOM
  if (text === '') return [];
  return text.split(/\r?\n/).map((line) => line.split(','));
};

/**
 * Reads a saved table file into a grid, picking the reader by extension.
 * @param {Uint8Array} data the file bytes
 * @param {string} filename the file name written in the bundle (a .csv name is read as csv)
 */
export const readTable = (data, filename) => (/\.csv$/i.test(String(filename || '')) ? readCsv(data) : readXlsx(data));

// Lists zip entry names only: returning false from filter skips inflation, which keeps memory down on a large zip
export const zipEntryNames = (data) => {
  const names = [];
  unzipSync(toBytes(data), { filter: (f) => (names.push(f.name), false) });
  return names;
};

// Inflates a single zip entry into bytes
export const readZipFile = (data, name) => {
  const files = unzipSync(toBytes(data), { filter: (f) => f.name === name });
  return files[name] || null;
};

// Inflates a single text entry of a zip into a string
export const readZipText = (data, name) => {
  const bytes = readZipFile(data, name);
  return bytes ? strFromU8(bytes) : null;
};
