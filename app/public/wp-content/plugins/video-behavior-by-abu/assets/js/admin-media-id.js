(() => {
  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  const ensureIdRow = (details, id) => {
    const settings = details.querySelector('.settings');
    if (!settings) {
      return;
    }
    let row = details.querySelector('.abu-media-attachment-id');
    if (!row) {
      row = document.createElement('div');
      row.className = 'setting abu-media-attachment-id';
      row.innerHTML = '<span class="name">Attachment ID</span><span class="value"></span>';
      settings.appendChild(row);
    }
    const value = row.querySelector('.value');
    if (value) {
      value.textContent = id;
    }
  };

  const updateFromDom = () => {
    const details = document.querySelector('.attachment-details');
    if (!details) {
      return;
    }
    const id = details.getAttribute('data-id') || '';
    if (!id) {
      return;
    }
    ensureIdRow(details, id);
  };

  ready(() => {
    updateFromDom();

    const observer = new MutationObserver(() => {
      updateFromDom();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-id'],
    });
  });
})();
