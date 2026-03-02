/**
 * MutationObserver + debounce/queue로 DOM 변경 감지 후 배치 처리.
 * addedNodes 중심 탐색, 무한루프 방지(플래그 + 마킹).
 */
const SelectHanguk = window.SelectHanguk || {};

const DEBOUNCE_MS = 300;
let queue = new Set();
let timer = null;
let isApplying = false;

function processNode(root, opts, isDebug) {
  if (!root || typeof root.querySelector !== 'function') return;
  const doc = root.ownerDocument || root;
  const scope = (root === doc || root === doc.documentElement) ? doc : root;

  const selects = SelectHanguk.getCandidateSelects(scope);
  for (let i = 0; i < selects.length; i++) {
    if (SelectHanguk.optimizeSelect(selects[i], opts, isDebug)) {
      // 한 번 처리됨
    }
  }

  if (opts.mode === 'aggressive') {
    const customs = SelectHanguk.getCandidateCustomDropdowns(scope);
    for (let j = 0; j < customs.length; j++) {
      SelectHanguk.optimizeCustom(customs[j], opts, isDebug);
    }
  }
}

function flush() {
  if (isApplying || !queue.size) return;
  isApplying = true;
  const nodes = Array.from(queue);
  queue = new Set();
  timer = null;

  chrome.storage.sync.get(
    {
      enabled: true,
      autoSelect: false,
      mode: 'safe',
      blocklistDomains: [],
      allowlistDomains: [],
      keywords: null,
      debugLog: false
    },
    (data) => {
      const host = (document.location && document.location.host) || '';
      if (Array.isArray(data.blocklistDomains) && data.blocklistDomains.some(d => host.includes(d))) {
        isApplying = false;
        return;
      }
      if (Array.isArray(data.allowlistDomains) && data.allowlistDomains.length > 0) {
        if (!data.allowlistDomains.some(d => host.includes(d))) {
          isApplying = false;
          return;
        }
      }
      const opts = {
        enabled: data.enabled,
        autoSelect: data.autoSelect,
        mode: data.mode || 'safe',
        keywords: Array.isArray(data.keywords) && data.keywords.length ? data.keywords : null
      };

      const roots = new Set();
      if (document.body) roots.add(document.body);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n && n.nodeType === 1) roots.add(n);
        if (n && n.nodeType === 11 && n.host) roots.add(n);
      }
      roots.forEach(root => processNode(root, opts, !!data.debugLog));
      isApplying = false;
    }
  );
}

function schedule(node) {
  if (!node) return;
  let target = node;
  if (target.nodeType === 1 && target.querySelector) {
    queue.add(target);
  }
  if (target.nodeType === 11 && target.host) {
    queue.add(target);
  }
  if (document.body && !queue.has(document.body)) {
    queue.add(document.body);
  }
  if (!timer) {
    timer = setTimeout(flush, DEBOUNCE_MS);
  }
}

function onMutation(mutations) {
  if (isApplying) return;
  for (let i = 0; i < mutations.length; i++) {
    const list = mutations[i].addedNodes;
    if (!list) continue;
    for (let j = 0; j < list.length; j++) {
      const node = list[j];
      if (node && (node.nodeType === 1 || node.nodeType === 11)) schedule(node);
    }
  }
}

SelectHanguk.startScheduler = function () {
  if (SelectHanguk._observer) return;
  const body = document.body;
  if (!body) {
    document.addEventListener('DOMContentLoaded', () => SelectHanguk.startScheduler());
    return;
  }
  const obs = new MutationObserver(onMutation);
  obs.observe(body, { childList: true, subtree: true });
  SelectHanguk._observer = obs;
  schedule(body);
};

SelectHanguk.stopScheduler = function () {
  if (SelectHanguk._observer) {
    SelectHanguk._observer.disconnect();
    SelectHanguk._observer = null;
  }
  queue = new Set();
  if (timer) clearTimeout(timer);
  timer = null;
};
