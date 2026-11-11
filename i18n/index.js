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

// UI string dictionary: the code holds keys only, and the text to display comes from here.
// ⚠ The Korean tokens used to interpret uploaded files (backup-winner prefixes, the "all" label, class, group,
//   weight, winnable count and so on) never go into a dictionary. They would make the page read an uploaded
//   file differently per language and invent a mismatch that was never there.
// ⚠ Language is display only: reproduction and comparison must give the same result in any language.

import { ko } from './ko.js';
import { en } from './en.js';

const DICTS = { ko, en };

/** Available languages. The first is the default and the fallback for missing keys. The URL decides the language (/ and /en/). */
export const LOCALES = ['ko', 'en'];

let current = LOCALES[0];

/** The current language */
export const getLocale = () => current;

/**
 * Switches the language. An unknown value falls back to the default.
 * @param {string} locale
 * @returns {string} the language actually applied
 */
export const setLocale = (locale) => {
  current = DICTS[locale] ? locale : LOCALES[0];
  return current;
};

/**
 * Formats a number with grouping separators, following the dictionary language rather than the Worker's runtime locale.
 * @param {number} n
 */
export const num = (n) => Number(n).toLocaleString(current);

// Fills {name} placeholders with values, so sentences are never concatenated in languages with a different word order.
// ⚠ A value shaped like a message code is translated too: a pure module must be able to pass a word inside a sentence as a code rather than wording.
// ⚠ The nesting depth is capped so a self-referring placeholder (t('a', { x: msg('a') })) cannot recurse forever.
const MAX_NEST = 4;

const fill = (text, params, depth) =>
  params
    ? text.replace(/\{(\w+)\}/g, (m, k) => {
        const v = params[k];
        if (v == null) return m;
        if (typeof v === 'object' && v.code) return depth >= MAX_NEST ? v.code : t(v.code, v.params, depth + 1);
        // Pure modules pass raw numbers; the grouping separators are added here, where the language is known
        return typeof v === 'number' ? num(v) : String(v);
      })
    : text;

/**
 * Looks a string up in the dictionary.
 * @param {string} key dot-separated key
 * @param {object} [params] placeholder values
 * @returns {string} falls back to the default language, then to the key itself; vanishing into a blank would hide the gap
 */
export const t = (key, params, depth = 0) => {
  const text = DICTS[current][key] != null ? DICTS[current][key] : DICTS[LOCALES[0]][key];
  if (text == null) {
    if (typeof console !== 'undefined') console.warn(`[i18n] 사전에 없는 키: ${key}`);
    return key;
  }
  return fill(text, params, depth);
};

/**
 * Turns a message ({code, params}) from a pure module into text. This is the only place codes become wording.
 * @param {{code:string, params?:object}|Array|string|null} m a message, an array of messages, or an already-built string
 * @returns {string} arrays are joined with sep.list; each item is a complete phrase on its own, so word order is not an issue
 */
export const tm = (m) => {
  if (m == null) return '';
  if (Array.isArray(m)) return m.map(tm).join(t('sep.list'));
  if (typeof m === 'object' && m.code) return t(m.code, m.params);
  return String(m);
};

/**
 * Fills in the text of every element carrying a data-i18n attribute.
 * @param {ParentNode} [root] the element to search within (document by default)
 */
export const applyMarkup = (root) => {
  const scope = root || document;
  for (const el of scope.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of scope.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of scope.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of scope.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of scope.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const el of scope.querySelectorAll('[data-i18n-content]')) el.content = t(el.dataset.i18nContent);
  for (const el of scope.querySelectorAll('[data-i18n-empty]')) el.dataset.empty = t(el.dataset.i18nEmpty);
};
