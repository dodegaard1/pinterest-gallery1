(function () {
  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  ready(() => {
    const metaBox = document.querySelector('.abu-pg-meta-box');
    if (!metaBox || typeof wp === 'undefined' || !wp.media) {
      return;
    }

    const input = metaBox.querySelector('#abu-gallery-media-ids');
    const selectBtn = metaBox.querySelector('.abu-pg-select-media');
    const clearBtn = metaBox.querySelector('.abu-pg-clear-media');
    const selected = metaBox.querySelector('.abu-pg-selected');

    const renderSelection = (attachments) => {
      selected.innerHTML = '';

      if (!attachments.length) {
        const empty = document.createElement('div');
        empty.className = 'abu-pg-empty';
        empty.textContent = 'No media selected.';
        selected.appendChild(empty);
        return;
      }

      attachments.forEach((attachment) => {
        const item = document.createElement('div');
        item.className = 'abu-pg-item';
        item.dataset.id = attachment.id;

        if (attachment.type === 'image' && attachment.sizes && attachment.sizes.thumbnail) {
          const img = document.createElement('img');
          img.src = attachment.sizes.thumbnail.url;
          img.alt = '';
          item.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'abu-pg-item-placeholder';
          placeholder.textContent = 'Video';
          item.appendChild(placeholder);
        }

        const label = document.createElement('div');
        label.className = 'abu-pg-item-label';
        label.textContent = attachment.title || attachment.filename;
        item.appendChild(label);

        selected.appendChild(item);
      });
    };

    const setIds = (attachments) => {
      const ids = attachments.map((item) => item.id);
      input.value = ids.join(',');
    };

    let frame = null;

    const openFrame = () => {
      if (frame) {
        frame.open();
        return;
      }

      frame = wp.media({
        title: (window.abuPgAdmin && abuPgAdmin.labels && abuPgAdmin.labels.title) || 'Select Media',
        button: {
          text: (window.abuPgAdmin && abuPgAdmin.labels && abuPgAdmin.labels.buttonText) || 'Use selected media',
        },
        library: {
          type: ['image', 'video'],
        },
        multiple: true,
      });

      frame.on('select', () => {
        const selection = frame.state().get('selection');
        const attachments = selection.map((item) => item.toJSON());
        renderSelection(attachments);
        setIds(attachments);
      });

      frame.open();
    };

    selectBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openFrame();
    });

    clearBtn.addEventListener('click', (event) => {
      event.preventDefault();
      input.value = '';
      renderSelection([]);
    });
  });
})();