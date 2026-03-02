/**
 * Background service worker.
 * 설정 변경 시 로그 등(필요 시 메시지 처리).
 */
chrome.runtime.onInstalled.addListener(() => {
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
      if (data.keywords === undefined || data.keywords === null) {
        chrome.storage.sync.set({ keywords: [] });
      }
    }
  );
});
