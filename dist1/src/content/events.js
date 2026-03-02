/**
 * 이벤트 디스패치 유틸 (프레임워크 동기화).
 * optimizeSelect에서 사용.
 */
const SelectHanguk = window.SelectHanguk || {};

SelectHanguk.dispatchSelectChange = function (select) {
  if (!select || select.tagName !== 'SELECT') return;
  try {
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (_) {}
};
