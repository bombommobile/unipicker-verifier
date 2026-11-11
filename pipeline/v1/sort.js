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

// The app's comparison rules, ported byte for byte — they decide the order winners are picked in.
// ⚠ The blank/number/string branches and the ascending/descending sign decide who wins. Do not change them.
// ⚠ String comparison is pinned to a fixed collator, so a replay orders names the same way in every runtime.
//   The five options are spelled out on purpose: any of them left implicit would fall back to a runtime default.

const COLLATOR = new Intl.Collator('ko', { usage: 'sort', sensitivity: 'variant', numeric: false, caseFirst: 'false', ignorePunctuation: false });

// Blank means null, undefined or the empty string. Blanks always sort last.
const isBlankValue = (str) => null == str || '' === str;

// Number-like means Number(v) is not NaN — note that this is true for blanks too, so the blank
// checks above have to come first.
const isNumericLike = (str) => !isNaN(Number(str));

// Compare a against b (orderType 0 = ascending, 1 = descending).
const calSort = (a, b, orderType) => {
  let s;
  if (isBlankValue(a)) s = 1;
  else if (isBlankValue(b)) s = -1;
  else if (a === b) s = 0;
  else if (isNumericLike(a) && isNumericLike(b)) s = a < b ? -1 : 1;
  else s = COLLATOR.compare(a, b);
  return s * (orderType < 1 ? 1 : -1);
};

// Sort by the given field ids in order, returning as soon as one of them decides (multi-key sort).
// With no field ids the list items themselves are compared.
export const sortByFields = (list, orderType = 0, ...orderIds) => {
  return list.sort((a, b) => {
    if (orderIds && orderIds.length > 0) {
      for (const orderId of orderIds) {
        const _cal = calSort(a[orderId], b[orderId], orderType);
        if (_cal === -1 || _cal === 1) return _cal;
      }
      return 0;
    } else return calSort(a, b, orderType);
  });
};
