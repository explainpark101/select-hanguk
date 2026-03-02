/**
 * Content script 진입점: 설정 로드 후 스케줄러 시작.
 */
(function () {
  const SelectHanguk = window.SelectHanguk || {};
  chrome.storage.sync.get(
    { enabled: true, blocklistDomains: [], allowlistDomains: [] },
    (data) => {
      const host = (document.location && document.location.host) || '';
      if (!data.enabled) return;
      if (Array.isArray(data.blocklistDomains) && data.blocklistDomains.some(d => host.includes(d))) return;
      if (Array.isArray(data.allowlistDomains) && data.allowlistDomains.length > 0) {
        if (!data.allowlistDomains.some(d => host.includes(d))) return;
      }
      SelectHanguk.startScheduler();
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.enabled) return;
    if (changes.enabled.newValue === false) SelectHanguk.stopScheduler();
    else if (changes.enabled.newValue === true) SelectHanguk.startScheduler();
  });
})();
