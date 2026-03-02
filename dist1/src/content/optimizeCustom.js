/**
 * ARIA 기반 커스텀 드롭다운(combobox/listbox) 최적화.
 * Safe: 이미 열린 리스트에서만 Korea 항목 클릭.
 * Aggressive: combobox 열기 + 항목 클릭 시도.
 */
const SelectHanguk = window.SelectHanguk || {};
const DATA_MARK = 'data-country-optimized';
const MAX_RETRY = 2;
const retryCount = new WeakMap();

function getText(el) {
  return (el.textContent || el.innerText || '').trim();
}

/**
 * 후보 combobox/listbox 수집.
 */
SelectHanguk.getCandidateCustomDropdowns = function (root) {
  const out = [];
  const re = /combobox|listbox|dropdown|select|country/i;
  const walk = (node) => {
    const list = node.querySelectorAll
      ? node.querySelectorAll('[role="combobox"], [role="listbox"], [aria-haspopup="listbox"]')
      : [];
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (el.getAttribute(DATA_MARK) === '1') continue;
      const str = [el.className, el.id, el.getAttribute('aria-label')].filter(Boolean).join(' ');
      if (re.test(str) || el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox') {
        out.push(el);
      }
    }
    SelectHanguk.walkShadow(node, (n) => {
      if (n.shadowRoot) walk(n.shadowRoot);
    });
  };
  walk(root);
  return out;
};

/**
 * 열림 상태: aria-expanded="true" 또는 연관 listbox가 DOM에 보임.
 */
function isExpanded(el) {
  if (el.getAttribute('aria-expanded') === 'true') return true;
  const id = el.getAttribute('aria-controls');
  if (id) {
    const doc = el.ownerDocument;
    const ctrl = doc.getElementById(id);
    if (ctrl && ctrl.getAttribute('role') === 'listbox') return true;
  }
  return false;
}

/**
 * listbox 내 [role="option"] 또는 li/div 항목 중 한국 매칭 찾기.
 */
function findKoreaOption(listbox, opts) {
  const items = listbox.querySelectorAll('[role="option"], li, div[role="option"]');
  const candidates = [];
  for (let i = 0; i < items.length; i++) {
    const text = getText(items[i]);
    if (SelectHanguk.isKoreaMatch(text, opts.keywords)) {
      candidates.push({ el: items[i], text, score: SelectHanguk.koreaScore(text) });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].el;
}

/**
 * 단일 커스텀 드롭다운 처리.
 */
SelectHanguk.optimizeCustom = function (element, opts, isDebug) {
  if (!opts || !opts.enabled) return false;
  if (element.getAttribute(DATA_MARK) === '1') return false;

  const count = (retryCount.get(element) || 0);
  if (count >= MAX_RETRY) return false;

  const role = element.getAttribute('role');
  const isCombobox = role === 'combobox';
  const isListbox = role === 'listbox';

  let listbox = element;
  if (isCombobox) {
    const id = element.getAttribute('aria-controls');
    if (id) {
      const ctrl = element.ownerDocument.getElementById(id);
      if (ctrl) listbox = ctrl;
    }
    const expanded = isExpanded(element);
    if (!expanded) {
      if (opts.mode === 'aggressive') {
        try {
          element.click();
          retryCount.set(element, count + 1);
        } catch (_) {}
      }
      return false;
    }
  }

  if (isListbox || listbox.getAttribute('role') === 'listbox') {
    const optionEl = findKoreaOption(listbox, opts);
    if (!optionEl) return false;
    try {
      optionEl.click();
      element.setAttribute(DATA_MARK, '1');
      if (isDebug) console.debug('[SelectHanguk] custom dropdown option clicked');
      return true;
    } catch (_) {
      retryCount.set(element, (retryCount.get(element) || 0) + 1);
      return false;
    }
  }

  const optionEl = findKoreaOption(element, opts);
  if (optionEl) {
    try {
      optionEl.click();
      element.setAttribute(DATA_MARK, '1');
      if (isDebug) console.debug('[SelectHanguk] custom listbox option clicked');
      return true;
    } catch (_) {
      retryCount.set(element, (retryCount.get(element) || 0) + 1);
      return false;
    }
  }
  return false;
}
