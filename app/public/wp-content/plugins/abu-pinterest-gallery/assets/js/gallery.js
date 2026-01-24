(function () {
  const AGENT_LOGGING_ENABLED = false;
  const AGENT_LOG_ENDPOINT = 'http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f';
  if (typeof window !== 'undefined' && window.fetch && !window.fetch.__abuPgWrapped) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input && input.url;
      if (!AGENT_LOGGING_ENABLED && url && url.indexOf(AGENT_LOG_ENDPOINT) === 0) {
        return Promise.resolve();
      }
      return originalFetch(input, init);
    };
    window.fetch.__abuPgWrapped = true;
  }
  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };


  const isMobileDevice = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const downloadFile = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareFile = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = url.split('/').pop() || 'media';
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        window.open(url, '_blank', 'noopener');
        return;
      }

      await navigator.share({ files: [file], title: filename });
    } catch (error) {
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleDownload = (url) => {
    if (isMobileDevice() && navigator.share) {
      shareFile(url);
      return;
    }
    downloadFile(url);
  };

  const setVolumeWithRamp = (video, targetVolume, duration = 120) => {
    const startVolume = video.volume;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      video.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const logDebug = (payload) => {
    if (!AGENT_LOGGING_ENABLED) {
      return;
    }
    if (window.abuPgDebug && window.abuPgDebug.endpoint) {
      fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      }).catch(() => {});
    }
  };

  const waitForImageReady = (img, label = '') => {
    if (!img) {
      return Promise.resolve();
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'A',location:'gallery.js:62',message:'waitForImageReady start',data:{label,complete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,src:img.currentSrc||img.getAttribute('src')||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    // #region agent log
    logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'A',location:'gallery.js:62',message:'waitForImageReady start (https)',data:{label,complete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,src:img.currentSrc||img.getAttribute('src')||''},timestamp:Date.now()});
    // #endregion agent log
    const decodeIfPossible = () => {
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => {});
      }
      return Promise.resolve();
    };
    if (img.complete && img.naturalWidth) {
      return decodeIfPossible().finally(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'A',location:'gallery.js:72',message:'waitForImageReady resolved (complete)',data:{label,naturalWidth:img.naturalWidth||0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        // #region agent log
        logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'A',location:'gallery.js:72',message:'waitForImageReady resolved (complete, https)',data:{label,naturalWidth:img.naturalWidth||0},timestamp:Date.now()});
        // #endregion agent log
      });
    }
    return new Promise((resolve) => {
      const finalize = () => {
        decodeIfPossible().finally(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'A',location:'gallery.js:77',message:'waitForImageReady resolved (event)',data:{label,naturalWidth:img.naturalWidth||0,eventComplete:img.complete?'yes':'no'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          // #region agent log
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'A',location:'gallery.js:77',message:'waitForImageReady resolved (event, https)',data:{label,naturalWidth:img.naturalWidth||0,eventComplete:img.complete?'yes':'no'},timestamp:Date.now()});
          // #endregion agent log
          resolve();
        });
      };
      img.addEventListener('load', finalize, { once: true });
      img.addEventListener('error', finalize, { once: true });
    });
  };

  const waitForImagePaint = (img, label = '', maxFrames = 6) => new Promise((resolve) => {
    let frames = 0;
    const step = () => {
      frames += 1;
      const rect = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
      const hasBox = rect.width > 0 && rect.height > 0;
      const hasNatural = img && img.naturalWidth > 0;
      const hasComplete = img && img.complete;
      const ready = hasBox && hasNatural && hasComplete;
      // #region agent log
      logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'L',location:'gallery.js:85',message:'waitForImagePaint frame',data:{label,frame:frames,width:rect.width||0,height:rect.height||0,hasBox:hasBox?'yes':'no',naturalWidth:img?img.naturalWidth||0:0,complete:hasComplete?'yes':'no'},timestamp:Date.now()});
      // #endregion agent log
      if (ready || frames >= maxFrames) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  const waitForFrames = (frames = 2) => new Promise((resolve) => {
    let count = 0;
    const step = () => {
      count += 1;
      if (count >= frames) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  const getConnectionInfo = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) {
      return null;
    }
    return {
      saveData: Boolean(connection.saveData),
      effectiveType: connection.effectiveType || '',
    };
  };

  const getVideoDataAttr = (video, attrName, datasetKey) => {
    if (!video) {
      return '';
    }
    const datasetValue = video.dataset && Object.prototype.hasOwnProperty.call(video.dataset, datasetKey)
      ? video.dataset[datasetKey]
      : '';
    if (datasetValue) {
      return datasetValue;
    }
    const attrValue = video.getAttribute(attrName);
    return attrValue || '';
  };

  const isDebugEnabled = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('abu_pg_debug')) {
      return params.get('abu_pg_debug') !== '0';
    }
    try {
      return window.localStorage && window.localStorage.getItem('abuPgDebug') === '1';
    } catch (error) {
      return false;
    }
  };

  const pickVideoSource = (video) => {
    const original = getVideoDataAttr(video, 'data-src-original', 'srcOriginal');
    const src360 = getVideoDataAttr(video, 'data-src-360', 'src360');
    const src720 = getVideoDataAttr(video, 'data-src-720', 'src720');
    const poster = getVideoDataAttr(video, 'data-poster', 'poster');
    if (poster) {
      video.setAttribute('poster', poster);
    }

    const connection = getConnectionInfo();
    const smallViewport = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const hasDerivatives = Boolean(src360 || src720);
    let chosen = original;
    if (hasDerivatives) {
      const slowConnection =
        (connection && connection.saveData) ||
        (connection && connection.effectiveType && /(2g|3g)/.test(connection.effectiveType));
      if (slowConnection && src360) {
        chosen = src360;
      } else {
        chosen = src720 || src360 || original;
      }
    }
    return chosen;
  };

  const getVideoSourceLabel = (video, chosen) => {
    if (!chosen) {
      return 'none';
    }
    if (chosen === video.dataset.src360) {
      return '360p';
    }
    if (chosen === video.dataset.src720) {
      return '720p';
    }
    if (chosen === video.dataset.srcOriginal) {
      return 'original';
    }
    return 'custom';
  };

  const updateDebugBadge = (tile, label, details = null) => {
    if (!tile || tile.dataset.debug !== 'true') {
      return;
    }
    let badge = tile.querySelector('.abu-pg-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'abu-pg-badge';
      tile.appendChild(badge);
    }
    const detailText = details
      ? `id:${details.id || 'n/a'} src360:${details.src360 || 'no'} src720:${details.src720 || 'no'} meta360:${details.meta360 || 'no'} meta720:${details.meta720 || 'no'}`
      : '';
    badge.textContent = detailText ? `Video: ${label} (${detailText})` : `Video: ${label}`;

    if (details) {
      let center = tile.querySelector('.abu-pg-debug-center');
      if (!center) {
        center = document.createElement('div');
        center.className = 'abu-pg-debug-center';
        tile.appendChild(center);
      }
      center.textContent = [
        `id: ${details.id || 'n/a'}`,
        `src360: ${details.src360 || 'no'}  src720: ${details.src720 || 'no'}`,
        `meta360: ${details.meta360 || 'no'}  meta720: ${details.meta720 || 'no'}`,
        `metaIds: 360:${details.meta360Id || '0'} 720:${details.meta720Id || '0'} poster:${details.metaPosterId || '0'}`,
      ].join('\n');
    }
  };

  const ensureVideoSource = (video) => {
    if (video.dataset.srcLoaded === 'true') {
      return;
    }
    const chosen = pickVideoSource(video);
    if (!chosen) {
      return;
    }
    const source = video.querySelector('source');
    if (source) {
      source.setAttribute('src', chosen);
      source.setAttribute('type', 'video/mp4');
      video.load();
    } else {
      video.setAttribute('src', chosen);
      video.load();
    }
    video.dataset.srcLoaded = 'true';
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'C',
        location: 'gallery.js:182',
        message: 'ensureVideoSource applied',
        data: { chosen, hasSourceTag: source ? 'yes' : 'no' },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const tile = video.closest('.abu-pg-tile');
    if (tile) {
      updateDebugBadge(tile, getVideoSourceLabel(video, chosen), {
        id: tile.dataset.id || '',
        src360: video.dataset.src360 ? 'yes' : 'no',
        src720: video.dataset.src720 ? 'yes' : 'no',
        meta360: tile.dataset.abuMeta360 || '',
        meta720: tile.dataset.abuMeta720 || '',
        meta360Id: tile.dataset.abuMeta360Id || '',
        meta720Id: tile.dataset.abuMeta720Id || '',
        metaPosterId: tile.dataset.abuMetaPosterId || '',
      });
    }
  };

  const getAspectRatio = (item) => {
    if (item.width > 0 && item.height > 0) {
      return item.height / item.width;
    }
    if (item.type === 'video') {
      return 9 / 16;
    }
    return 1;
  };

  const getFitRect = (ratio, viewportWidth, viewportHeight, padding = 24) => {
    const maxWidth = Math.max(0, viewportWidth - padding * 2);
    const maxHeight = Math.max(0, viewportHeight - padding * 2);
    let width = maxWidth;
    let height = width * ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / ratio;
    }
    return {
      width,
      height,
      left: (viewportWidth - width) / 2,
      top: (viewportHeight - height) / 2,
    };
  };

  const layoutMasonry = (container, items, config) => {
    const containerWidth = container.clientWidth;
    if (!containerWidth) {
      return;
    }
    const isMobileViewport = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const targetColumnWidth = isMobileViewport
      ? Math.max(160, Math.min(200, Math.floor(containerWidth / 2)))
      : config.columnWidth;
    const gutter = config.gutter;
    const cols = isMobileViewport
      ? 2
      : Math.max(1, Math.floor((containerWidth + gutter) / (targetColumnWidth + gutter)));
    const colWidth = Math.floor((containerWidth - gutter * (cols - 1)) / cols);
    const colHeights = new Array(cols).fill(0);

    items.forEach((item) => {
      const ratio = getAspectRatio(item);
      const tileWidth = colWidth;
      const height = Math.round(tileWidth * ratio);
      item.element.style.width = `${tileWidth}px`;
      item.element.style.height = `${height}px`;

      let colIndex = 0;
      for (let i = 1; i < cols; i += 1) {
        if (colHeights[i] < colHeights[colIndex]) {
          colIndex = i;
        }
      }
      const x = (colWidth + gutter) * colIndex;
      const y = colHeights[colIndex];
      item.element.style.transform = `translate(${x}px, ${y}px)`;
      colHeights[colIndex] += height + gutter;
    });

    const maxHeight = Math.max(...colHeights, 0);
    container.style.height = `${maxHeight}px`;
  };

  const lockScroll = (state) => {
    if (state.scrollLocked) {
      return;
    }
    state.scrollLocked = true;
    state.scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${state.scrollY}px`;
    document.body.style.width = '100%';
  };

  const unlockScroll = (state) => {
    if (!state.scrollLocked) {
      return;
    }
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, state.scrollY || 0);
    state.scrollLocked = false;
  };

  const createSpotlight = (state) => {
    const overlay = document.createElement('div');
    overlay.className = 'abu-pg-spotlight';
    const backdrop = document.createElement('div');
    backdrop.className = 'abu-pg-spotlight-backdrop';
    overlay.appendChild(backdrop);
    document.body.appendChild(overlay);
    state.spotlight = {
      overlay,
      backdrop,
      clone: null,
      originRect: null,
    };
  };

  const closeSpotlight = (state) => {
    if (!state.spotlight || !state.spotlight.clone) {
      return;
    }
    const { overlay, clone, targetRect, scale, content } = state.spotlight;
    if (content) {
      content.remove();
      state.spotlight.content = null;
    }
    clone.style.opacity = '1';
    clone.style.transform = `translate(${targetRect.left - state.spotlight.originRect.left}px, ${targetRect.top - state.spotlight.originRect.top}px) scale(${scale})`;
    overlay.classList.remove('is-visible');
    requestAnimationFrame(() => {
      clone.style.transform = 'translate(0px, 0px) scale(1)';
    });
    const cleanup = () => {
      clone.removeEventListener('transitionend', cleanup);
      overlay.remove();
      state.spotlight = null;
      unlockScroll(state);
    };
    clone.addEventListener('transitionend', cleanup);
  };

  const bindSpotlightInteractions = (tile, item, state) => {
    const downloadBtn = tile.querySelector('.abu-pg-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (item.url) {
          handleDownload(item.url);
        }
      });
    }

    let saveBtn = tile.querySelector('.abu-pg-save');
    if (!saveBtn && state.isTouch) {
      saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'abu-pg-save';
      saveBtn.textContent = 'Save';
      tile.appendChild(saveBtn);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (item.url) {
          shareFile(item.url);
        }
      });
    }

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'abu-pg-spotlight-back yp-icon-button';
    if (state.iconTemplates.back) {
      backButton.innerHTML = state.iconTemplates.back;
    }
    tile.appendChild(backButton);
    backButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeSpotlight(state);
    });

    const video = tile.querySelector('video.abu-pg-video');
    if (!video) {
      return;
    }

    tile.classList.add('abu-pg-spotlight-video');
    tile.classList.remove('is-video-ready');
    tile.classList.remove('is-video-playing');
    ensureVideoSource(video);

    const markReady = () => {
      tile.classList.add('is-video-ready');
    };
    if (video.readyState >= 2) {
      markReady();
    } else {
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('canplay', markReady, { once: true });
    }
    video.addEventListener(
      'playing',
      () => {
        tile.classList.add('is-video-playing');
      },
      { once: true }
    );

    requestAnimationFrame(() => {
      video.play().catch(() => {});
    });

    const muteBtn = tile.querySelector('.abu-pg-mute');
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', video.volume === 0 ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', video.volume === 0 ? 'Unmute' : 'Mute');
      muteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.userActivated = true;
        const isMuted = video.volume === 0;
        const nextVolume = isMuted ? 1 : 0;
        video.muted = nextVolume === 0;
        setVolumeWithRamp(video, nextVolume);
        video.dataset.abuVolume = String(nextVolume);
        muteBtn.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
        muteBtn.setAttribute('aria-label', isMuted ? 'Mute' : 'Unmute');
      });
    }

    tile.addEventListener('click', (event) => {
      if (event.target && event.target.closest('button')) {
        return;
      }
      if (video.paused) {
        video.play().catch(() => {});
        tile.classList.add('is-hover-playing');
      } else {
        video.pause();
        tile.classList.remove('is-hover-playing');
      }
    });
  };

  const openSpotlight = (state, tile, item) => {
    if (!state.isSpotlightEnabled) {
      return;
    }
    if (!state.spotlight) {
      createSpotlight(state);
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'E',location:'gallery.js:454',message:'openSpotlight called',data:{type:item.type||'',id:item.id||'',url:item.url||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    // #region agent log
    logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'E',location:'gallery.js:454',message:'openSpotlight called (https)',data:{type:item.type||'',id:item.id||'',url:item.url||''},timestamp:Date.now()});
    // #endregion agent log
    const { overlay } = state.spotlight;
    if (state.spotlight.clone) {
      return;
    }

    const rect = tile.getBoundingClientRect();
    const tileImg = item.type === 'image' ? tile.querySelector('img') : null;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'F',location:'gallery.js:466',message:'openSpotlight rect',data:{type:item.type||'',hasTileImg:tileImg?'yes':'no',rectW:rect.width||0,rectH:rect.height||0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    // #region agent log
    logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'F',location:'gallery.js:466',message:'openSpotlight rect (https)',data:{type:item.type||'',hasTileImg:tileImg?'yes':'no',rectW:rect.width||0,rectH:rect.height||0},timestamp:Date.now()});
    // #endregion agent log
    if (item.type === 'image') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'F',location:'gallery.js:466',message:'tile image state',data:{hasTileImg:tileImg?'yes':'no',tileSrc:tileImg?tileImg.getAttribute('src')||'':'',tileCurrentSrc:tileImg&&tileImg.currentSrc?tileImg.currentSrc:'',tileDataSrc:tileImg?tileImg.getAttribute('data-src')||'':'',tileComplete:tileImg&&tileImg.complete?'yes':'no',tileNaturalWidth:tileImg?tileImg.naturalWidth||0:0},timestamp:Date.now()})}).catch(()=>{});
      if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
        fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'F',location:'gallery.js:466',message:'tile image state',data:{hasTileImg:tileImg?'yes':'no',tileSrc:tileImg?tileImg.getAttribute('src')||'':'',tileCurrentSrc:tileImg&&tileImg.currentSrc?tileImg.currentSrc:'',tileDataSrc:tileImg?tileImg.getAttribute('data-src')||'':'',tileComplete:tileImg&&tileImg.complete?'yes':'no',tileNaturalWidth:tileImg?tileImg.naturalWidth||0:0},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
      }
      // #endregion agent log
    }
    const ratio = getAspectRatio(item);
    const target = getFitRect(ratio, window.innerWidth, window.innerHeight);
    const tileStyles = window.getComputedStyle(tile);
    const tileRadius = tileStyles && tileStyles.borderRadius ? tileStyles.borderRadius : '14px';
    const clone = tile.cloneNode(true);
    clone.classList.add('abu-pg-spotlight-clone');
    clone.style.position = 'fixed';
    clone.style.top = `${rect.top}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.transformOrigin = 'top left';
    clone.style.transform = 'translate(0px, 0px) scale(1)';
    clone.style.setProperty('--abu-pg-radius-start', tileRadius);
    clone.style.setProperty('--abu-pg-radius-end', '0px');

    if (item.type === 'image') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'D',location:'gallery.js:472',message:'spotlight clone start',data:{tileType:item.type||'',hasTileImg:tile.querySelector('img')?'yes':'no',previewSrc:item.previewSrc||''},timestamp:Date.now()})}).catch(()=>{});
      if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
        fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'D',location:'gallery.js:472',message:'spotlight clone start',data:{tileType:item.type||'',hasTileImg:tile.querySelector('img')?'yes':'no',previewSrc:item.previewSrc||''},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
      }
      // #endregion agent log
      const cloneImg = clone.querySelector('img');
      if (cloneImg) {
        let clonePreview =
          (tileImg && (tileImg.currentSrc || tileImg.getAttribute('src'))) ||
          item.previewSrc ||
          item.url;
        let usedDataUrl = 'no';
        if (tileImg && tileImg.complete && tileImg.naturalWidth && tileImg.naturalHeight) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = tileImg.naturalWidth;
            canvas.height = tileImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(tileImg, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              if (dataUrl && dataUrl.indexOf('data:image') === 0) {
                clonePreview = dataUrl;
                usedDataUrl = 'yes';
              }
            }
          } catch (error) {
            usedDataUrl = 'error';
          }
        }
        cloneImg.setAttribute('src', clonePreview);
        cloneImg.setAttribute('loading', 'eager');
        cloneImg.setAttribute('decoding', 'sync');
        cloneImg.setAttribute('fetchpriority', 'high');
        cloneImg.removeAttribute('srcset');
        cloneImg.removeAttribute('sizes');
        cloneImg.removeAttribute('data-src');
        cloneImg.removeAttribute('data-srcset');
        cloneImg.removeAttribute('data-sizes');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'H',location:'gallery.js:512',message:'clone image data url',data:{usedDataUrl,cloneSrc:cloneImg.getAttribute('src')||''},timestamp:Date.now()})}).catch(()=>{});
        if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
          fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'H',location:'gallery.js:512',message:'clone image data url',data:{usedDataUrl,cloneSrc:cloneImg.getAttribute('src')||''},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
        }
        // #endregion agent log
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'D',location:'gallery.js:458',message:'spotlight clone image state',data:{hasCloneImg:cloneImg?'yes':'no',cloneSrc:cloneImg?cloneImg.getAttribute('src')||'':'',cloneDataSrc:cloneImg?cloneImg.getAttribute('data-src')||'':'',previewSrc:item.previewSrc||''},timestamp:Date.now()})}).catch(()=>{});
      if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
        fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'D',location:'gallery.js:458',message:'spotlight clone image state',data:{hasCloneImg:cloneImg?'yes':'no',cloneSrc:cloneImg?cloneImg.getAttribute('src')||'':'',cloneDataSrc:cloneImg?cloneImg.getAttribute('data-src')||'':'',previewSrc:item.previewSrc||''},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
      }
      // #endregion agent log
    }

    overlay.appendChild(clone);
    state.spotlight.clone = clone;
    state.spotlight.originRect = rect;
    state.spotlight.targetRect = target;

    const scale = target.width / rect.width;
    state.spotlight.scale = scale;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target === state.spotlight.backdrop) {
        closeSpotlight(state);
      }
    });

    lockScroll(state);
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      const dx = target.left - rect.left;
      const dy = target.top - rect.top;
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      if (item.type === 'image') {
        const cloneImg = clone.querySelector('img');
        const styles = cloneImg ? window.getComputedStyle(cloneImg) : null;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'E',location:'gallery.js:496',message:'spotlight clone computed style',data:{hasCloneImg:cloneImg?'yes':'no',opacity:styles?styles.opacity:'',visibility:styles?styles.visibility:'',display:styles?styles.display:'',width:cloneImg?cloneImg.clientWidth||0:0,height:cloneImg?cloneImg.clientHeight||0:0,naturalWidth:cloneImg?cloneImg.naturalWidth||0:0},timestamp:Date.now()})}).catch(()=>{});
        if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
          fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'E',location:'gallery.js:496',message:'spotlight clone computed style',data:{hasCloneImg:cloneImg?'yes':'no',opacity:styles?styles.opacity:'',visibility:styles?styles.visibility:'',display:styles?styles.display:'',width:cloneImg?cloneImg.clientWidth||0:0,height:cloneImg?cloneImg.clientHeight||0:0,naturalWidth:cloneImg?cloneImg.naturalWidth||0:0},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
        }
        // #endregion agent log
      }
    });

    const onTransitionEnd = () => {
      clone.removeEventListener('transitionend', onTransitionEnd);
      const content = createTileElement(item, state.templates, state, 'spotlight');
      content.classList.add('abu-pg-spotlight-content');
      content.style.position = 'fixed';
      content.style.top = `${target.top}px`;
      content.style.left = `${target.left}px`;
      content.style.width = `${target.width}px`;
      content.style.height = `${target.height}px`;
      content.style.margin = '0';
      content.style.setProperty('--abu-pg-radius-start', tileRadius);
      content.style.setProperty('--abu-pg-radius-end', '0px');
      overlay.appendChild(content);
      state.spotlight.content = content;
      if (item.type === 'image') {
        const preview = content.querySelector('.abu-pg-spotlight-preview');
        const fullImage = content.querySelector('img:not(.abu-pg-spotlight-preview)');
        // #region agent log
        const previewStyles = preview ? window.getComputedStyle(preview) : null;
        logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'I',location:'gallery.js:589',message:'spotlight content styles',data:{hasPreview:preview?'yes':'no',previewOpacity:previewStyles?previewStyles.opacity:'',previewVisibility:previewStyles?previewStyles.visibility:'',previewW:preview?preview.clientWidth||0:0,previewH:preview?preview.clientHeight||0:0,fullW:fullImage?fullImage.clientWidth||0:0,fullH:fullImage?fullImage.clientHeight||0:0},timestamp:Date.now()});
        // #endregion agent log
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'I',location:'gallery.js:585',message:'spotlight content appended',data:{hasPreview:preview?'yes':'no',previewComplete:preview&&preview.complete?'yes':'no',previewNaturalWidth:preview?preview.naturalWidth||0:0},timestamp:Date.now()})}).catch(()=>{});
        if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
          fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'I',location:'gallery.js:585',message:'spotlight content appended',data:{hasPreview:preview?'yes':'no',previewComplete:preview&&preview.complete?'yes':'no',previewNaturalWidth:preview?preview.naturalWidth||0:0},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
        }
        // #endregion agent log
        const hideClone = () => {
          // #region agent log
          const previewStylesAtHide = preview ? window.getComputedStyle(preview) : null;
          const fullStylesAtHide = fullImage ? window.getComputedStyle(fullImage) : null;
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'J',location:'gallery.js:620',message:'hideClone snapshot',data:{hasPreview:preview?'yes':'no',previewOpacity:previewStylesAtHide?previewStylesAtHide.opacity:'',previewVisibility:previewStylesAtHide?previewStylesAtHide.visibility:'',isImageReady:content.classList.contains('is-image-ready')?'yes':'no'},timestamp:Date.now()});
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'M',location:'gallery.js:621',message:'full image snapshot',data:{fullOpacity:fullStylesAtHide?fullStylesAtHide.opacity:'',fullVisibility:fullStylesAtHide?fullStylesAtHide.visibility:'',fullW:fullImage?fullImage.clientWidth||0:0,fullH:fullImage?fullImage.clientHeight||0:0,fullComplete:fullImage&&fullImage.complete?'yes':'no',fullSrc:fullImage?fullImage.currentSrc||fullImage.getAttribute('src')||'':''},timestamp:Date.now()});
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'O',location:'gallery.js:622',message:'content bg snapshot',data:{bg:window.getComputedStyle(content).backgroundColor||''},timestamp:Date.now()});
          const targetRect = state.spotlight ? state.spotlight.targetRect : null;
          if (targetRect) {
            const centerX = Math.round(targetRect.left + targetRect.width / 2);
            const centerY = Math.round(targetRect.top + targetRect.height / 2);
            const topEl = document.elementFromPoint(centerX, centerY);
            const topStyle = topEl ? window.getComputedStyle(topEl) : null;
            logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'R',location:'gallery.js:623',message:'top element at hideClone',data:{tag:topEl?topEl.tagName:'',className:topEl?topEl.className||'':'',bg:topStyle?topStyle.backgroundColor||'':'',opacity:topStyle?topStyle.opacity||'':''},timestamp:Date.now()});
            requestAnimationFrame(() => {
              const topElNext = document.elementFromPoint(centerX, centerY);
              const topStyleNext = topElNext ? window.getComputedStyle(topElNext) : null;
              logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'T',location:'gallery.js:624',message:'top element post-hide (raf1)',data:{tag:topElNext?topElNext.tagName:'',className:topElNext?topElNext.className||'':'',bg:topStyleNext?topStyleNext.backgroundColor||'':'',opacity:topStyleNext?topStyleNext.opacity||'':'',fullComplete:fullImage&&fullImage.complete?'yes':'no'},timestamp:Date.now()});
              requestAnimationFrame(() => {
                const topElNext2 = document.elementFromPoint(centerX, centerY);
                const topStyleNext2 = topElNext2 ? window.getComputedStyle(topElNext2) : null;
                logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'U',location:'gallery.js:625',message:'top element post-hide (raf2)',data:{tag:topElNext2?topElNext2.tagName:'',className:topElNext2?topElNext2.className||'':'',bg:topStyleNext2?topStyleNext2.backgroundColor||'':'',opacity:topStyleNext2?topStyleNext2.opacity||'':'',fullComplete:fullImage&&fullImage.complete?'yes':'no'},timestamp:Date.now()});
              });
            });
          }
          // #endregion agent log
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'K',location:'gallery.js:608',message:'spotlight clone hide',data:{isImage:item.type==='image'?'yes':'no',previewComplete:preview&&preview.complete?'yes':'no',previewNaturalWidth:preview?preview.naturalWidth||0:0},timestamp:Date.now()})}).catch(()=>{});
          if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
            fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'K',location:'gallery.js:608',message:'spotlight clone hide',data:{isImage:item.type==='image'?'yes':'no',previewComplete:preview&&preview.complete?'yes':'no',previewNaturalWidth:preview?preview.naturalWidth||0:0},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
          }
          // #endregion agent log
          clone.style.opacity = '0';
        };
        const hideCloneWhenReady = (img, label) => {
          if (!img) {
            hideClone();
            return;
          }
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'B',location:'gallery.js:629',message:'hideCloneWhenReady armed',data:{label,hasImg:img?'yes':'no'},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          // #region agent log
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'B',location:'gallery.js:629',message:'hideCloneWhenReady armed (https)',data:{label,hasImg:img?'yes':'no'},timestamp:Date.now()});
          // #endregion agent log
          waitForImageReady(img, label).then(() => waitForImagePaint(img, label)).then(() => {
            requestAnimationFrame(() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'J',location:'gallery.js:595',message:'spotlight preview ready',data:{previewNaturalWidth:img.naturalWidth||0},timestamp:Date.now()})}).catch(()=>{});
              if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
                fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'J',location:'gallery.js:595',message:'spotlight preview ready',data:{previewNaturalWidth:img.naturalWidth||0},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
              }
              // #endregion agent log
              hideClone();
            });
          });
        };
        const cloneTarget = fullImage || preview;
        hideCloneWhenReady(cloneTarget, fullImage ? 'full' : 'preview');
      } else {
        clone.style.opacity = '0';
      }
      bindSpotlightInteractions(content, item, state);
    };
    clone.addEventListener('transitionend', onTransitionEnd);
  };

  const createTemplates = (gallery) => {
    const templates = {
      image: null,
      video: null,
    };
    const tiles = Array.from(gallery.querySelectorAll('.abu-pg-tile'));
    tiles.forEach((tile) => {
      if (tile.dataset.type === 'image' && !templates.image) {
        templates.image = tile.cloneNode(true);
      }
      if (tile.dataset.type === 'video' && !templates.video) {
        templates.video = tile.cloneNode(true);
      }
    });
    return templates;
  };

  const buildItemsFromDOM = (gallery) => {
    return Array.from(gallery.querySelectorAll('.abu-pg-tile')).map((tile) => {
      const video = tile.querySelector('video.abu-pg-video');
      const img = tile.querySelector('img');
      const previewSrc = img
        ? img.currentSrc || img.getAttribute('src') || img.dataset.src || ''
        : '';
      return {
        id: tile.dataset.id || '',
        type: tile.dataset.type || '',
        url: tile.dataset.url || '',
        createdAt: tile.dataset.created || '',
        filename: tile.dataset.filename || '',
        title: tile.dataset.title || '',
        width: Number(tile.dataset.width || 0),
        height: Number(tile.dataset.height || 0),
        meta360: tile.dataset.abuMeta360 || '',
        meta720: tile.dataset.abuMeta720 || '',
        metaPoster: tile.dataset.abuMetaPoster || '',
        meta360Id: tile.dataset.abuMeta360Id || '',
        meta720Id: tile.dataset.abuMeta720Id || '',
        metaPosterId: tile.dataset.abuMetaPosterId || '',
        srcset: img ? img.getAttribute('srcset') || '' : '',
        sizes: img ? img.getAttribute('sizes') || '' : '',
        previewSrc,
        srcOriginal: getVideoDataAttr(video, 'data-src-original', 'srcOriginal'),
        src360: getVideoDataAttr(video, 'data-src-360', 'src360'),
        src720: getVideoDataAttr(video, 'data-src-720', 'src720'),
        poster: getVideoDataAttr(video, 'data-poster', 'poster'),
      };
    });
  };

  const createTileElement = (item, templates, state, context = 'grid') => {
    const template = item.type === 'video' ? templates.video : templates.image;
    const tile = template ? template.cloneNode(true) : document.createElement('div');
    tile.className = 'abu-pg-tile';
    tile.dataset.id = item.id;
    tile.dataset.type = item.type;
    tile.dataset.url = item.url;
    if (item.width) {
      tile.dataset.width = String(item.width);
    }
    if (item.height) {
      tile.dataset.height = String(item.height);
    }

    const isSpotlight = context === 'spotlight';
    if (state.isTouch) {
      tile.classList.add('is-touch');
    }

    if (item.type === 'image') {
      const img = tile.querySelector('img') || document.createElement('img');
      img.removeAttribute('src');
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.dataset.src = item.url;
      if (item.srcset) {
        img.dataset.srcset = item.srcset;
      }
      if (item.sizes) {
        img.dataset.sizes = item.sizes;
      }
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      if (isSpotlight) {
        img.src = item.url;
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        delete img.dataset.src;
        delete img.dataset.srcset;
        delete img.dataset.sizes;
        img.loading = 'eager';
        img.decoding = 'sync';
        img.setAttribute('fetchpriority', 'high');

        tile.classList.add('abu-pg-spotlight-image');
        let poster = tile.querySelector('.abu-pg-spotlight-poster');
        const previewSrc = item.previewSrc || item.url;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'A',location:'gallery.js:640',message:'spotlight image setup',data:{itemUrl:item.url||'',previewSrc:previewSrc||'',hasPosterNode:poster?'yes':'no'},timestamp:Date.now()})}).catch(()=>{});
        if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
          fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'A',location:'gallery.js:640',message:'spotlight image setup',data:{itemUrl:item.url||'',previewSrc:previewSrc||'',hasPosterNode:poster?'yes':'no'},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
        }
        // #endregion agent log
        if (previewSrc) {
          if (!poster) {
            poster = document.createElement('img');
            poster.className = 'abu-pg-spotlight-poster';
            poster.alt = '';
            tile.appendChild(poster);
          }
          poster.src = previewSrc;
        } else if (poster) {
          poster.remove();
        }

        const markReady = () => {
          tile.classList.add('is-image-ready');
          tile.classList.add('is-image-painted');
          tile.dataset.abuReadyAt = String(performance.now());
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'C',location:'gallery.js:772',message:'spotlight image ready (is-image-ready set)',data:{imgComplete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,hasPoster:poster?'yes':'no',posterSrc:poster?poster.currentSrc||poster.getAttribute('src')||'':''},timestamp:Date.now()})}).catch(()=>{});
          // #endregion agent log
          // #region agent log
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'C',location:'gallery.js:772',message:'spotlight image ready (https)',data:{imgComplete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,hasPoster:poster?'yes':'no',posterSrc:poster?poster.currentSrc||poster.getAttribute('src')||'':''},timestamp:Date.now()});
          // #endregion agent log
          // #region agent log
          const posterStylesReady = poster ? window.getComputedStyle(poster) : null;
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'K',location:'gallery.js:775',message:'poster styles on ready',data:{posterOpacity:posterStylesReady?posterStylesReady.opacity:'',posterVisibility:posterStylesReady?posterStylesReady.visibility:''},timestamp:Date.now()});
          const fullStylesReady = img ? window.getComputedStyle(img) : null;
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'N',location:'gallery.js:776',message:'full styles on ready',data:{fullOpacity:fullStylesReady?fullStylesReady.opacity:'',fullVisibility:fullStylesReady?fullStylesReady.visibility:'',fullW:img?img.clientWidth||0:0,fullH:img?img.clientHeight||0:0,fullComplete:img&&img.complete?'yes':'no',fullSrc:img?img.currentSrc||img.getAttribute('src')||'':''},timestamp:Date.now()});
          logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'P',location:'gallery.js:777',message:'content bg on ready',data:{bg:window.getComputedStyle(tile).backgroundColor||''},timestamp:Date.now()});
          const readyRect = state.spotlight ? state.spotlight.targetRect : null;
          if (readyRect) {
            const centerX = Math.round(readyRect.left + readyRect.width / 2);
            const centerY = Math.round(readyRect.top + readyRect.height / 2);
            const topEl = document.elementFromPoint(centerX, centerY);
            const topStyle = topEl ? window.getComputedStyle(topEl) : null;
            logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'S',location:'gallery.js:778',message:'top element at ready',data:{tag:topEl?topEl.tagName:'',className:topEl?topEl.className||'':'',bg:topStyle?topStyle.backgroundColor||'':'',opacity:topStyle?topStyle.opacity||'':''},timestamp:Date.now()});
          }
          // #endregion agent log
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'B',location:'gallery.js:676',message:'spotlight image ready',data:{imgComplete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,hasPosterNode:poster?'yes':'no'},timestamp:Date.now()})}).catch(()=>{});
          if (window.abuPgDebug && window.abuPgDebug.enabled && window.abuPgDebug.endpoint) {
            fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-spotlight',hypothesisId:'B',location:'gallery.js:676',message:'spotlight image ready',data:{imgComplete:img.complete?'yes':'no',naturalWidth:img.naturalWidth||0,hasPosterNode:poster?'yes':'no'},timestamp:Date.now()}),credentials:'same-origin'}).catch(()=>{});
          }
          // #endregion agent log
        };
        waitForImageReady(img, 'full')
          .then(() => waitForImagePaint(img, 'full'))
          .then(() => waitForFrames(2))
          .then(() => {
            markReady();
          });
      }
      if (!isSpotlight) {
        tile.classList.remove('abu-pg-spotlight-image');
        tile.classList.remove('is-image-ready');
        tile.classList.remove('is-image-painted');
        const poster = tile.querySelector('.abu-pg-spotlight-poster');
        if (poster) {
          poster.remove();
        }
      }
      if (!img.parentElement) {
        tile.appendChild(img);
      }
    } else {
      const video = tile.querySelector('video.abu-pg-video') || document.createElement('video');
      video.className = 'abu-pg-video';
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'metadata');
      if (isSpotlight) {
        video.setAttribute('loop', '');
      } else {
        video.removeAttribute('loop');
      }
      video.dataset.srcOriginal = item.srcOriginal || item.url;
      if (item.src360) {
        video.dataset.src360 = item.src360;
        video.setAttribute('data-src-360', item.src360);
      }
      if (item.src720) {
        video.dataset.src720 = item.src720;
        video.setAttribute('data-src-720', item.src720);
      }
      if (item.poster) {
        video.dataset.poster = item.poster;
        video.setAttribute('poster', item.poster);
        video.setAttribute('data-poster', item.poster);
      } else {
        video.removeAttribute('poster');
        video.removeAttribute('data-poster');
      }
      let source = video.querySelector('source');
      if (!source) {
        source = document.createElement('source');
        video.appendChild(source);
      }
      source.removeAttribute('src');
      source.setAttribute('type', 'video/mp4');
      if (!video.parentElement) {
        tile.appendChild(video);
      }

      if (state.debug) {
        tile.dataset.debug = 'true';
        if (item.meta360) {
          tile.dataset.abuMeta360 = item.meta360;
        }
        if (item.meta720) {
          tile.dataset.abuMeta720 = item.meta720;
        }
        if (item.metaPoster) {
          tile.dataset.abuMetaPoster = item.metaPoster;
        }
        if (item.meta360Id) {
          tile.dataset.abuMeta360Id = item.meta360Id;
        }
        if (item.meta720Id) {
          tile.dataset.abuMeta720Id = item.meta720Id;
        }
        if (item.metaPosterId) {
          tile.dataset.abuMetaPosterId = item.metaPosterId;
        }
        const chosen = pickVideoSource(video);
        updateDebugBadge(tile, getVideoSourceLabel(video, chosen), {
          id: item.id || '',
          src360: item.src360 ? 'yes' : 'no',
          src720: item.src720 ? 'yes' : 'no',
          meta360: item.meta360 || '',
          meta720: item.meta720 || '',
          meta360Id: item.meta360Id || '',
          meta720Id: item.meta720Id || '',
          metaPosterId: item.metaPosterId || '',
        });
      }

      let posterOverlay = tile.querySelector('.abu-pg-spotlight-poster');
      if (isSpotlight && item.poster) {
        if (!posterOverlay) {
          posterOverlay = document.createElement('img');
          posterOverlay.className = 'abu-pg-spotlight-poster';
          posterOverlay.alt = '';
          tile.appendChild(posterOverlay);
        }
        posterOverlay.src = item.poster;
      } else if (posterOverlay) {
        posterOverlay.remove();
      }
    }

    if (state.isTouch) {
      const playOverlay = tile.querySelector('.abu-pg-video-play');
      if (playOverlay) {
        playOverlay.remove();
      }
    }

    const downloadBtn = tile.querySelector('.abu-pg-download');
    if (downloadBtn) {
      if (state.isTouch) {
        downloadBtn.remove();
      } else {
        downloadBtn.style.display = '';
      }
    }

    const muteBtn = tile.querySelector('.abu-pg-mute');
    if (muteBtn && state.isTouch && !isSpotlight) {
      muteBtn.remove();
    }

    const existingSave = tile.querySelector('.abu-pg-save');
    if (state.isTouch) {
      if (isSpotlight) {
        if (!existingSave) {
          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'abu-pg-save';
          saveBtn.textContent = 'Save';
          tile.appendChild(saveBtn);
        }
      } else if (existingSave) {
        existingSave.remove();
      }
    } else if (existingSave) {
      existingSave.remove();
    }

    return tile;
  };

  const bindTileInteractions = (tile, item, state) => {
    const downloadBtn = tile.querySelector('.abu-pg-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (item.url) {
          handleDownload(item.url);
        }
      });
    }

    const video = tile.querySelector('video.abu-pg-video');
    if (!video) {
      if (state.isSpotlightEnabled) {
        tile.addEventListener('click', (event) => {
          if (event.target && event.target.closest('button')) {
            return;
          }
          openSpotlight(state, tile, item);
        });
      }
      return;
    }

    const initialVolume = video.dataset.abuVolume ? parseFloat(video.dataset.abuVolume) : 1;
    video.volume = Number.isNaN(initialVolume) ? 1 : initialVolume;
    video.muted = video.volume === 0;

    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (hasHover) {
      tile.addEventListener('mouseenter', () => {
        if (video.dataset.srcLoaded !== 'true') {
          return;
        }
        tile.classList.add('is-hover-playing');
        if (!state.userActivated) {
          video.muted = true;
          video.volume = 0;
        }
        video.play().catch(() => {});
      });
      tile.addEventListener('mouseleave', () => {
        if (video.dataset.srcLoaded !== 'true') {
          return;
        }
        tile.classList.remove('is-hover-playing');
        video.pause();
        video.currentTime = 0;
      });

      video.addEventListener('ended', () => {
        if (video.dataset.srcLoaded !== 'true') {
          return;
        }
        if (tile.classList.contains('is-hover-playing')) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      });
    }

    const muteBtn = tile.querySelector('.abu-pg-mute');
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', video.volume === 0 ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', video.volume === 0 ? 'Unmute' : 'Mute');
      muteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.userActivated = true;
        const isMuted = video.volume === 0;
        const nextVolume = isMuted ? 1 : 0;
        video.muted = nextVolume === 0;
        setVolumeWithRamp(video, nextVolume);
        video.dataset.abuVolume = String(nextVolume);
        muteBtn.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
        muteBtn.setAttribute('aria-label', isMuted ? 'Mute' : 'Unmute');
      });
    }

    tile.addEventListener('click', (event) => {
      if (event.target && event.target.closest('button')) {
        return;
      }
      if (state.isSpotlightEnabled) {
        openSpotlight(state, tile, item);
        return;
      }
      state.userActivated = true;
      if (video.dataset.abuVolume && parseFloat(video.dataset.abuVolume) > 0) {
        video.muted = false;
      }
      if (video.paused) {
        ensureVideoSource(video);
        video.play().catch(() => {});
        tile.classList.add('is-hover-playing');
      } else {
        video.pause();
        tile.classList.remove('is-hover-playing');
      }
    });
  };

  const renderItems = (state, items) => {
    state.container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const tile = createTileElement(item, state.templates, state, 'grid');
      item.element = tile;
      fragment.appendChild(tile);
      bindTileInteractions(tile, item, state);
      const img = tile.querySelector('img');
      if (img && img.dataset.src) {
        if (state.imageObserver) {
          state.imageObserver.observe(img);
        } else {
          img.src = img.dataset.src;
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
          }
          if (img.dataset.sizes) {
            img.sizes = img.dataset.sizes;
          }
          delete img.dataset.src;
          delete img.dataset.srcset;
          delete img.dataset.sizes;
        }
      }
    });
    state.container.appendChild(fragment);
    if (state.sentinel) {
      state.container.appendChild(state.sentinel);
    }
    layoutMasonry(state.container, items, state.layoutConfig);
  };

  const renderChunk = (state) => {
    const end = Math.min(state.visibleCount, state.activeItems.length);
    const itemsToRender = state.activeItems.slice(0, end);
    renderItems(state, itemsToRender);
    layoutMasonry(state.container, itemsToRender, state.layoutConfig);
  };

  const appendChunk = (state) => {
    const prevCount = state.visibleCount;
    const nextCount = Math.min(state.visibleCount + state.chunkSize, state.activeItems.length);
    if (nextCount === prevCount) {
      return;
    }
    state.visibleCount = nextCount;
    const itemsToRender = state.activeItems.slice(0, nextCount);
    renderItems(state, itemsToRender);
    layoutMasonry(state.container, itemsToRender, state.layoutConfig);
  };

  const applyFilter = (state, { type, dateRange, query }) => {
    state.activeItems = state.allItems.slice();
    state.visibleCount = state.initialCount;
    renderChunk(state);
    return state.activeItems;
  };

  const setChapter = (state, chapterId) => {
    state.activeItems = state.allItems.slice();
    state.visibleCount = state.initialCount;
    renderChunk(state);
    return state.activeItems;
  };

  const initGallery = (gallery) => {
    const state = {
      container: gallery,
      layoutConfig: {
        columnWidth: Number(gallery.dataset.columnWidth || 280),
        gutter: Number(gallery.dataset.gutter || 16),
      },
      isTouch: window.matchMedia && window.matchMedia('(hover: none)').matches,
      isSpotlightEnabled: window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
      debug: isDebugEnabled(),
      scrollLocked: false,
      scrollY: 0,
      spotlight: null,
      iconTemplates: {
        back: '',
      },
      userActivated: false,
      templates: createTemplates(gallery),
      allItems: [],
      activeItems: [],
      initialCount: 120,
      chunkSize: 60,
      visibleCount: 0,
      sentinel: null,
      observer: null,
      imageObserver: null,
    };

    if ('IntersectionObserver' in window) {
      state.imageObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset && img.dataset.src) {
                img.src = img.dataset.src;
                if (img.dataset.srcset) {
                  img.srcset = img.dataset.srcset;
                }
                if (img.dataset.sizes) {
                  img.sizes = img.dataset.sizes;
                }
                img.loading = 'lazy';
                img.decoding = 'async';
                delete img.dataset.src;
                delete img.dataset.srcset;
                delete img.dataset.sizes;
              }
              state.imageObserver.unobserve(img);
            }
          });
        },
        {
          root: null,
          rootMargin: '800px 0px',
          threshold: 0.01,
        }
      );
    }

    const backTemplate = gallery.querySelector('.abu-pg-icon-template[data-icon="caret-left"]');
    if (backTemplate) {
      state.iconTemplates.back = backTemplate.innerHTML;
    }

    state.allItems = buildItemsFromDOM(gallery);
    state.activeItems = state.allItems.slice();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'gallery.js:1068',
        message: 'initGallery built items',
        data: {
          total: state.allItems.length,
          videoCount: state.allItems.filter((item) => item.type === 'video').length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    state.visibleCount = Math.min(state.initialCount, state.activeItems.length);

    state.sentinel = document.createElement('div');
    state.sentinel.className = 'abu-pg-sentinel';
    state.sentinel.style.position = 'absolute';
    state.sentinel.style.left = '0';
    state.sentinel.style.right = '0';
    state.sentinel.style.height = '1px';

    renderChunk(state);

    if ('IntersectionObserver' in window) {
      state.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              appendChunk(state);
            }
          });
        },
        {
          root: null,
          rootMargin: '800px 0px',
          threshold: 0.01,
        }
      );
      state.observer.observe(state.sentinel);
    }

    const debouncedLayout = (() => {
      let rafId = null;
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const itemsToRender = state.activeItems.slice(0, state.visibleCount);
          layoutMasonry(state.container, itemsToRender, state.layoutConfig);
        });
      };
    })();

    window.addEventListener('resize', debouncedLayout);

    state.layoutMasonry = debouncedLayout;
    state.renderItems = (items) => renderItems(state, items);
    state.applyFilter = (criteria) => applyFilter(state, criteria);
    state.setChapter = (chapterId) => setChapter(state, chapterId);
    return state;
  };

  ready(() => {
    const galleries = Array.from(document.querySelectorAll('.abu-pg-gallery'));
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'H',location:'gallery.js:1207',message:'bootstrap start',data:{href:window.location.href||'',protocol:window.location.protocol||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    galleries.forEach((gallery) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'G',location:'gallery.js:1208',message:'initGallery bootstrap',data:{hasGallery:'yes'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      initGallery(gallery);
    });
  });
})();
