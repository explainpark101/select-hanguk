(function () {
  const enabled = document.getElementById('enabled');
  const autoSelect = document.getElementById('autoSelect');
  const mode = document.getElementById('mode');
  const openOptions = document.getElementById('openOptions');
  const status = document.getElementById('status');

  function load() {
    chrome.storage.sync.get(
      { enabled: true, autoSelect: false, mode: 'safe' },
      (data) => {
        enabled.checked = !!data.enabled;
        autoSelect.checked = !!data.autoSelect;
        mode.value = data.mode || 'safe';
      }
    );
  }

  function save() {
    chrome.storage.sync.set(
      {
        enabled: enabled.checked,
        autoSelect: autoSelect.checked,
        mode: mode.value
      },
      () => {
        status.textContent = '저장됨';
        setTimeout(() => { status.textContent = ''; }, 1500);
      }
    );
  }

  enabled.addEventListener('change', save);
  autoSelect.addEventListener('change', save);
  mode.addEventListener('change', save);

  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/ui/options.html'));
    }
  });

  load();
})();
