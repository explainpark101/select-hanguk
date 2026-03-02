(function () {
  const blocklistDomains = document.getElementById('blocklistDomains');
  const allowlistDomains = document.getElementById('allowlistDomains');
  const keywords = document.getElementById('keywords');
  const debugLog = document.getElementById('debugLog');
  const saveBtn = document.getElementById('save');
  const allowThisSiteBtn = document.getElementById('allowThisSite');
  const status = document.getElementById('status');

  function showStatus(msg) {
    status.textContent = msg;
    setTimeout(() => { status.textContent = ''; }, 2500);
  }

  function parseLines(text) {
    return (text || '')
      .split(/\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function load() {
    chrome.storage.sync.get(
      {
        blocklistDomains: [],
        allowlistDomains: [],
        keywords: [],
        debugLog: false
      },
      (data) => {
        blocklistDomains.value = Array.isArray(data.blocklistDomains) ? data.blocklistDomains.join('\n') : '';
        allowlistDomains.value = Array.isArray(data.allowlistDomains) ? data.allowlistDomains.join('\n') : '';
        keywords.value = Array.isArray(data.keywords) && data.keywords.length
          ? data.keywords.join('\n')
          : '';
        debugLog.checked = !!data.debugLog;
      }
    );
  }

  function save() {
    const blocklist = parseLines(blocklistDomains.value);
    const allowlist = parseLines(allowlistDomains.value);
    const kw = parseLines(keywords.value);
    chrome.storage.sync.set(
      {
        blocklistDomains: blocklist,
        allowlistDomains: allowlist,
        keywords: kw,
        debugLog: debugLog.checked
      },
      () => showStatus('저장되었습니다.')
    );
  }

  function allowThisSite() {
    const optionsUrl = chrome.runtime.getURL('src/ui/options.html');
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      let tab = tabs[0];
      if (tab && tab.url && tab.url.startsWith(optionsUrl)) {
        chrome.tabs.query({}, (all) => {
          const other = all.filter(t => t.url && !t.url.startsWith('chrome-extension://')).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
          addDomainToList(other ? other.url : null);
        });
      } else {
        addDomainToList(tab ? tab.url : null);
      }
    });
  }

  function addDomainToList(url) {
    if (!url) {
      showStatus('대상 탭 URL을 가져올 수 없습니다. 해당 사이트 탭을 연 뒤 다시 시도하세요.');
      return;
    }
    try {
      const u = new URL(url);
      const host = u.hostname || '';
      if (!host) {
        showStatus('도메인을 추출할 수 없습니다.');
        return;
      }
      chrome.storage.sync.get({ allowlistDomains: [] }, (data) => {
        const list = Array.isArray(data.allowlistDomains) ? data.allowlistDomains : [];
        if (list.includes(host)) {
          showStatus('이미 허용 목록에 있습니다.');
          return;
        }
        list.push(host);
        chrome.storage.sync.set({ allowlistDomains: list }, () => {
          allowlistDomains.value = list.join('\n');
          showStatus('이 사이트를 허용 목록에 추가했습니다: ' + host);
        });
      });
    } catch (_) {
      showStatus('URL을 파싱할 수 없습니다.');
    }
  }

  saveBtn.addEventListener('click', save);
  allowThisSiteBtn.addEventListener('click', allowThisSite);
  load();
})();
