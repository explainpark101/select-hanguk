/**
 * 표준 HTML <select> 최적화: 한국 옵션 상단 이동 및 선택.
 */
const SelectHanguk = window.SelectHanguk || {};
const DATA_MARK = 'data-country-optimized';

/**
 * select 후보 수집: name/id/class/aria-label에 country|nation|region|shipping 등 포함 우선.
 * @param {Document|DocumentFragment|ShadowRoot} root
 * @returns {HTMLSelectElement[]}
 */
SelectHanguk.getCandidateSelects = function (root) {
  const all = SelectHanguk.querySelectorAllShadow(root, 'select') || [];
  const priority = [];
  const rest = [];
  const re = /country|nation|region|shipping|state|addr/i;
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    if (s.tagName !== 'SELECT') continue;
    if (s.getAttribute(DATA_MARK) === '1') continue;
    const str = [s.name, s.id, s.className, s.getAttribute('aria-label')].filter(Boolean).join(' ');
    if (re.test(str)) priority.push(s);
    else rest.push(s);
  }
  return priority.length ? priority : rest;
};

/**
 * option의 표시 텍스트 + value를 합쳐서 한국 매칭 여부 확인.
 */
function getOptionText(opt) {
  const label = (opt.textContent || opt.text || '').trim();
  const val = (opt.value != null ? String(opt.value) : '').trim();
  if (label && val && label !== val) return label + ' ' + val;
  return label || val;
}

/**
 * 단일 select 처리: 한국 옵션 찾기 → 상단 이동 → (설정 시) 자동 선택.
 * @param {HTMLSelectElement} select
 * @param {{ enabled: boolean, autoSelect: boolean, keywords: string[] }} opts
 * @param {boolean} isDebug
 * @returns {boolean} 처리 여부
 */
SelectHanguk.optimizeSelect = function (select, opts, isDebug) {
  if (!select || select.getAttribute(DATA_MARK) === '1') return false;
  if (!opts || !opts.enabled) return false;

  const options = Array.from(select.options || []);
  const candidates = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const text = getOptionText(opt);
    if (SelectHanguk.isKoreaMatch(text, opts.keywords)) {
      candidates.push({ opt, text, score: SelectHanguk.koreaScore(text) });
    }
  }
  if (!candidates.length) return false;

  candidates.sort((a, b) => (b.score - a.score));
  const best = candidates[0].opt;

  if (best === select.options[0]) {
    if (opts.autoSelect && select.value !== best.value) {
      setSelectValue(select, best.value, isDebug);
    }
    select.setAttribute(DATA_MARK, '1');
    return true;
  }

  try {
    select.insertBefore(best, select.firstChild);
  } catch (_) {
    return false;
  }

  if (opts.autoSelect) {
    const currentMatch = SelectHanguk.isKoreaMatch(getOptionText(select.options[select.selectedIndex]), opts.keywords);
    if (!currentMatch) setSelectValue(select, best.value, isDebug);
  }

  select.setAttribute(DATA_MARK, '1');
  if (isDebug) console.debug('[SelectHanguk] select optimized:', select.name || select.id);
  return true;
};

function setSelectValue(select, value, isDebug) {
  try {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(select, value);
    } else {
      select.value = value;
    }
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (isDebug) console.debug('[SelectHanguk] select value set:', value);
  } catch (e) {
    if (isDebug) console.debug('[SelectHanguk] set value error:', e);
  }
}
