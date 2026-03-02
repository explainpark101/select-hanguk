/**
 * Shadow DOM 재귀 탐색.
 * 오픈된 shadowRoot만 탐색 가능.
 */
const SelectHanguk = window.SelectHanguk || {};

/**
 * root 하위를 DFS로 순회하며 콜백을 호출.
 * element.shadowRoot가 있으면 shadowRoot도 재귀 탐색.
 * @param {Document|DocumentFragment|ShadowRoot} root
 * @param {function(Element): boolean|void} callback - true 반환 시 해당 서브트리 스킵
 */
SelectHanguk.walkShadow = function (root, callback) {
  if (!root || !root.querySelector) return;
  const walk = (node) => {
    const elements = node.querySelectorAll ? node.querySelectorAll('*') : [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (callback(el) === true) continue;
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(root);
};

/**
 * root 하위에서 selector에 맞는 요소들을 수집 (Shadow DOM 포함).
 * @param {Document|DocumentFragment|ShadowRoot} root
 * @param {string} selector
 * @returns {Element[]}
 */
SelectHanguk.querySelectorAllShadow = function (root, selector) {
  const out = [];
  if (!root || !root.querySelectorAll) return out;
  const add = (node) => {
    try {
      const list = node.querySelectorAll(selector);
      for (let i = 0; i < list.length; i++) out.push(list[i]);
    } catch (_) {}
    SelectHanguk.walkShadow(node, (el) => {
      if (el.shadowRoot) add(el.shadowRoot);
    });
  };
  add(root);
  return out;
};
