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
  const isIOSWebKit = () => {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIpadOS;
  };

  const downloadFile = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const attachSharePromptListener = (onPrompt) => {
    if (!onPrompt) {
      return () => {};
    }
    let fired = false;
    const fire = () => {
      if (fired) {
        return;
      }
      fired = true;
      onPrompt();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        fire();
      }
    };
    const handleBlur = () => {
      setTimeout(() => {
        const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
        if (document.visibilityState === 'hidden' || !hasFocus) {
          fire();
        }
      }, 0);
    };
    const handlePageHide = () => {
      fire();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', handlePageHide);
    };
  };

  const ensureSaveButtonContents = (saveBtn) => {
    if (!saveBtn || saveBtn.querySelector('.abu-pg-save__label')) {
      return;
    }
    const label = document.createElement('span');
    label.className = 'abu-pg-save__label';
    label.textContent = saveBtn.textContent || 'Save';
    const spinner = document.createElement('span');
    spinner.className = 'abu-pg-save__spinner';
    saveBtn.textContent = '';
    saveBtn.append(label, spinner);
  };

  const setSaveButtonLoading = (saveBtn, isLoading) => {
    if (!saveBtn) {
      return;
    }
    ensureSaveButtonContents(saveBtn);
    saveBtn.classList.toggle('is-sharing', isLoading);
    saveBtn.dataset.isSharing = isLoading ? 'true' : 'false';
    saveBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  };

  const shareFile = async (url, options = {}) => {
    const { onSharePrompt, onShareSettled } = options;
    let detachPromptListener = null;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const filename = url.split('/').pop() || 'media';
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        window.open(url, '_blank', 'noopener');
        return;
      }

      if (navigator.share) {
        detachPromptListener = attachSharePromptListener(onSharePrompt);
        await navigator.share({ files: [file], title: filename });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch (error) {
      window.open(url, '_blank', 'noopener');
    } finally {
      if (detachPromptListener) {
        detachPromptListener();
      }
      if (onShareSettled) {
        onShareSettled();
      }
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

  /**
   * Create and update performance overlay
   * Shows: tiles rendered, images loaded, videos loaded, chunk count
   */
  const createPerformanceOverlay = () => {
    let overlay = document.getElementById('abu-pg-perf-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'abu-pg-perf-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.85);
        color: #0f0;
        padding: 12px 16px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  };

  const updatePerformanceOverlay = (state) => {
    if (!state.debug) return;
    
    const overlay = createPerformanceOverlay();
    const container = state.container;
    
    // Count rendered tiles
    const tiles = container.querySelectorAll('.abu-pg-tile');
    const tilesCount = tiles.length;
    
    // Count images with src attached (loaded or loading)
    let imagesLoaded = 0;
    tiles.forEach(tile => {
      const img = tile.querySelector('img');
      if (img && img.src && !img.dataset.src) {
        imagesLoaded++;
      }
    });
    
    // Count videos with src attached (loaded or loading)
    let videosLoaded = 0;
    tiles.forEach(tile => {
      const video = tile.querySelector('video');
      if (video) {
        const source = video.querySelector('source');
        if ((source && source.src) || video.src) {
          videosLoaded++;
        }
      }
    });
    
    // Calculate chunk count
    const chunkCount = Math.ceil(state.visibleCount / state.chunkSize);
    
    overlay.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #fff;">ABU Gallery Performance</div>
      <div>Tiles Rendered: <span style="color: #0ff;">${tilesCount}</span></div>
      <div>Images Loaded: <span style="color: #0f0;">${imagesLoaded}</span> / ${tilesCount}</div>
      <div>Videos Loaded: <span style="color: #f0f;">${videosLoaded}</span></div>
      <div>Chunks: <span style="color: #ff0;">${chunkCount}</span></div>
      <div>Visible Count: <span style="color: #fff;">${state.visibleCount}</span></div>
      <div>Total Items: <span style="color: #fff;">${state.allItems.length}</span></div>
    `;
  };

  /**
   * Show desktop download popover with Web and Print options
   */
  const showDesktopDownloadPopover = (button, item) => {
    // Remove any existing popover
    const existingPopover = document.querySelector('.abu-pg-download-popover');
    if (existingPopover) {
      existingPopover.remove();
    }
    
    const popover = document.createElement('div');
    popover.className = 'abu-pg-download-popover';
    
    const webBtn = document.createElement('button');
    webBtn.type = 'button';
    webBtn.className = 'abu-pg-download-option';
    webBtn.textContent = 'Web';
    webBtn.title = 'Download high-quality version for sharing';
    
    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'abu-pg-download-option';
    printBtn.textContent = 'Print';
    printBtn.title = 'Download original for print/archival';
    
    popover.appendChild(webBtn);
    popover.appendChild(printBtn);
    
    // Position popover relative to button
    const updatePosition = () => {
      const rect = button.getBoundingClientRect();
      popover.style.position = 'fixed';
      popover.style.top = `${rect.bottom + 8}px`;
      popover.style.left = `${rect.left + rect.width / 2}px`;
      popover.style.transform = 'translateX(-50%)';
      popover.style.zIndex = '10000';
    };
    
    updatePosition();
    document.body.appendChild(popover);
    
    // Track if user has ever hovered the popover
    let hasHoveredPopover = false;
    
    // Hover listeners for popover
    popover.addEventListener('mouseenter', () => {
      hasHoveredPopover = true;
    });
    
    popover.addEventListener('mouseleave', () => {
      // Only close on hover out if user has hovered it
      if (hasHoveredPopover) {
        popover.remove();
        cleanup();
      }
    });
    
    // Update position on scroll to keep it below button
    const handleScroll = () => {
      updatePosition();
    };
    
    window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
    
    // Add click event listeners for options
    webBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const webUrl = item.webUrl || item.url;
      if (webUrl) {
        downloadFile(webUrl);
      }
      popover.remove();
      cleanup();
    });
    
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const originalUrl = item.originalUrl || item.url;
      if (originalUrl) {
        downloadFile(originalUrl);
      }
      popover.remove();
      cleanup();
    });
    
    // Close popover on any click event (including other buttons)
    const closeOnAnyClick = (e) => {
      // Don't close if clicking inside the popover (on the option buttons)
      if (!popover.contains(e.target)) {
        popover.remove();
        cleanup();
      }
    };
    
    // Cleanup function to remove all listeners
    const cleanup = () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('click', closeOnAnyClick, true);
    };
    
    // Delay adding click listener to avoid immediate close from the download button click
    setTimeout(() => {
      document.addEventListener('click', closeOnAnyClick, true);
    }, 10);
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

  const hashCode = (str) => {
    if (!str) {
      return 0;
    }
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const calculateMasonryAspectRatio = (item) => {
    const original = item.originalAspectRatio || getAspectRatio(item);
    const MIN_ASPECT = 9 / 16;
    const MAX_ASPECT = 16 / 9;
    const MAX_VARIATION = 0.20;
    const seed = hashCode(item.id);
    const random = seededRandom(seed);
    let minRatio;
    let maxRatio;
    if (original <= MIN_ASPECT) {
      minRatio = original;
      maxRatio = Math.min(original * (1 + MAX_VARIATION), MAX_ASPECT);
    } else if (original >= MAX_ASPECT) {
      minRatio = Math.max(original * (1 - MAX_VARIATION), MIN_ASPECT);
      maxRatio = original;
    } else {
      minRatio = Math.max(original * (1 - MAX_VARIATION), MIN_ASPECT);
      maxRatio = Math.min(original * (1 + MAX_VARIATION), MAX_ASPECT);
    }
    return minRatio + (maxRatio - minRatio) * random;
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
    const gutterHorizontal = isMobileViewport ? 6 : config.gutter;
    const gutterVertical = isMobileViewport ? 16 : config.gutter;
    const cols = isMobileViewport
      ? 2
      : Math.max(1, Math.floor((containerWidth + gutterHorizontal) / (targetColumnWidth + gutterHorizontal)));
    const colWidth = Math.floor((containerWidth - gutterHorizontal * (cols - 1)) / cols);
    const colHeights = new Array(cols).fill(0);

    items.forEach((item) => {
      const ratio = item.masonryAspectRatio || getAspectRatio(item);
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
      const x = (colWidth + gutterHorizontal) * colIndex;
      const y = colHeights[colIndex];
      item.element.style.transform = `translate(${x}px, ${y}px)`;
      colHeights[colIndex] += height + gutterVertical;
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
    document.documentElement.classList.add('abu-pg-scroll-lock');
    document.body.classList.add('abu-pg-scroll-lock');
    if (!state.isIOSWebKit) {
      document.body.style.position = 'fixed';
      document.body.style.top = `-${state.scrollY}px`;
      document.body.style.width = '100%';
    }
  };

  const unlockScroll = (state) => {
    if (!state.scrollLocked) {
      return;
    }
    document.documentElement.classList.remove('abu-pg-scroll-lock');
    document.body.classList.remove('abu-pg-scroll-lock');
    if (!state.isIOSWebKit) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    }
    window.scrollTo(0, state.scrollY || 0);
    state.scrollLocked = false;
  };

  const createSpotlight = (state) => {
    const overlay = document.createElement('div');
    overlay.className = 'abu-pg-spotlight';
    const backdrop = document.createElement('div');
    backdrop.className = 'abu-pg-spotlight-backdrop';
    overlay.appendChild(backdrop);
    
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'abu-pg-spotlight-carousel';
    overlay.appendChild(carouselContainer);
    
    document.body.appendChild(overlay);
    state.spotlight = {
      overlay,
      backdrop,
      carouselContainer,
      clone: null,
      originRect: null,
      currentIndex: 0,
      loadedIndices: new Set(),
      tiles: new Map(),
      isTransitioning: false,
      touchStartX: 0,
      touchStartY: 0,
      touchCurrentX: 0,
      touchCurrentY: 0,
      touchStartTime: 0,
      isDragging: false,
      dragDirection: null,
    };
    
    bindSpotlightGestures(state);
  };

  const bindSpotlightGestures = (state) => {
    const { overlay, carouselContainer } = state.spotlight;
    let isPrimaryTouch = false;
    
    const handleTouchStart = (event) => {
      if (state.spotlight.isTransitioning) {
        return;
      }
      if (event.target.closest('button')) {
        return;
      }
      
      const touch = event.touches[0];
      state.spotlight.touchStartX = touch.clientX;
      state.spotlight.touchStartY = touch.clientY;
      state.spotlight.touchCurrentX = touch.clientX;
      state.spotlight.touchCurrentY = touch.clientY;
      state.spotlight.touchStartTime = event.timeStamp;
      state.spotlight.isDragging = false;
      state.spotlight.dragDirection = null;
      isPrimaryTouch = true;
    };
    
    const handleTouchMove = (event) => {
      if (!isPrimaryTouch || state.spotlight.isTransitioning) {
        return;
      }
      
      const touch = event.touches[0];
      state.spotlight.touchCurrentX = touch.clientX;
      state.spotlight.touchCurrentY = touch.clientY;
      
      const deltaX = touch.clientX - state.spotlight.touchStartX;
      const deltaY = touch.clientY - state.spotlight.touchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      if (!state.spotlight.isDragging && (absDeltaX > 10 || absDeltaY > 10)) {
        state.spotlight.isDragging = true;
        state.spotlight.dragDirection = absDeltaX > absDeltaY ? 'horizontal' : 'vertical';
      }
      
      if (state.spotlight.isDragging) {
        event.preventDefault();
        
        const currentTile = carouselContainer.querySelector('.abu-pg-spotlight-slide.is-active');
        if (!currentTile) return;
        
        if (state.spotlight.dragDirection === 'horizontal') {
          const clampedDelta = Math.max(-window.innerWidth, Math.min(window.innerWidth, deltaX));
          currentTile.style.transform = `translateX(${clampedDelta}px)`;
          currentTile.style.transition = 'none';
          
          const adjacentTiles = carouselContainer.querySelectorAll('.abu-pg-spotlight-slide:not(.is-active)');
          adjacentTiles.forEach(tile => {
            const offset = parseFloat(tile.dataset.offset || 0);
            tile.style.transform = `translateX(${offset * window.innerWidth + clampedDelta}px)`;
            tile.style.transition = 'none';
          });
        } else if (state.spotlight.dragDirection === 'vertical') {
          const progress = Math.min(1, absDeltaY / (window.innerHeight * 0.4));
          const scale = 1 - (progress * 0.15);
          currentTile.style.transform = `translateY(${deltaY}px) scale(${scale})`;
          currentTile.style.transition = 'none';
          overlay.style.opacity = 1 - (progress * 0.5);
        }
      }
    };
    
    const handleTouchEnd = (event) => {
      if (!isPrimaryTouch) {
        return;
      }
      isPrimaryTouch = false;
      
      if (!state.spotlight.isDragging) {
        return;
      }
      
      const deltaX = state.spotlight.touchCurrentX - state.spotlight.touchStartX;
      const deltaY = state.spotlight.touchCurrentY - state.spotlight.touchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      const currentTile = carouselContainer.querySelector('.abu-pg-spotlight-slide.is-active');
      if (!currentTile) return;
      
      if (state.spotlight.dragDirection === 'horizontal') {
        const threshold = window.innerWidth * 0.25;
        const velocity = absDeltaX / (event.timeStamp - state.spotlight.touchStartTime || 1);
        
        if (absDeltaX > threshold || velocity > 0.5) {
          if (deltaX > 0 && state.spotlight.currentIndex > 0) {
            navigateSpotlight(state, 'prev');
          } else if (deltaX < 0 && state.spotlight.currentIndex < state.allItems.length - 1) {
            navigateSpotlight(state, 'next');
          } else {
            resetSpotlightPosition(state);
          }
        } else {
          resetSpotlightPosition(state);
        }
      } else if (state.spotlight.dragDirection === 'vertical') {
        const threshold = window.innerHeight * 0.2;
        if (absDeltaY > threshold) {
          closeSpotlight(state);
        } else {
          resetSpotlightPosition(state);
          overlay.style.opacity = '';
        }
      }
      
      state.spotlight.isDragging = false;
      state.spotlight.dragDirection = null;
    };
    
    overlay.addEventListener('touchstart', handleTouchStart, { passive: false });
    overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
    overlay.addEventListener('touchend', handleTouchEnd, { passive: true });
    overlay.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  };
  
  const resetSpotlightPosition = (state) => {
    const { carouselContainer } = state.spotlight;
    const slides = carouselContainer.querySelectorAll('.abu-pg-spotlight-slide');
    
    slides.forEach(slide => {
      slide.style.transition = '';
      if (slide.classList.contains('is-active')) {
        slide.style.transform = 'translateX(0)';
      } else {
        const offset = parseFloat(slide.dataset.offset || 0);
        slide.style.transform = `translateX(${offset * window.innerWidth}px)`;
      }
    });
  };
  
  const navigateSpotlight = (state, direction) => {
    if (state.spotlight.isTransitioning) {
      return;
    }
    
    const newIndex = direction === 'next' 
      ? state.spotlight.currentIndex + 1 
      : state.spotlight.currentIndex - 1;
    
    if (newIndex < 0 || newIndex >= state.allItems.length) {
      resetSpotlightPosition(state);
      return;
    }
    
    state.spotlight.isTransitioning = true;
    const { carouselContainer } = state.spotlight;
    
    let newSlide = carouselContainer.querySelector(`.abu-pg-spotlight-slide[data-index="${newIndex}"]`);
    
    if (!newSlide) {
      const newItem = state.allItems[newIndex];
      const slide = createSpotlightSlide(state, newItem, newIndex);
      slide.dataset.offset = direction === 'next' ? 1 : -1;
      slide.style.transform = `translateX(${(direction === 'next' ? 1 : -1) * window.innerWidth}px)`;
      carouselContainer.appendChild(slide);
      preloadSpotlightTile(state, newItem, slide, false);
      newSlide = slide;
    }
    
    const offset = direction === 'next' ? -1 : 1;
    const slides = carouselContainer.querySelectorAll('.abu-pg-spotlight-slide');
    
    slides.forEach(slide => {
      slide.style.transition = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      const currentOffset = parseFloat(slide.dataset.offset || 0);
      const newOffset = currentOffset + offset;
      slide.dataset.offset = newOffset;
      slide.style.transform = `translateX(${newOffset * window.innerWidth}px)`;
      
      if (newOffset === 0) {
        slide.classList.add('is-active');
      } else {
        slide.classList.remove('is-active');
        const video = slide.querySelector('video');
        if (video) {
          video.pause();
        }
      }
    });
    
    state.spotlight.currentIndex = newIndex;
    
    setTimeout(() => {
      state.spotlight.isTransitioning = false;
      
      const activeSlide = carouselContainer.querySelector('.abu-pg-spotlight-slide.is-active');
      if (activeSlide) {
        const video = activeSlide.querySelector('video');
        if (video && video.readyState >= 2) {
          video.play().catch(() => {});
        }
      }
      
      preloadAdjacentTiles(state);
      cleanupDistantTiles(state);
      syncMasonryPosition(state);
    }, 350);
  };
  
  const preloadAdjacentTiles = (state) => {
    const { currentIndex } = state.spotlight;
    const { carouselContainer } = state.spotlight;
    
    [-1, 1].forEach(offset => {
      const index = currentIndex + offset;
      if (index >= 0 && index < state.allItems.length) {
        if (!state.spotlight.loadedIndices.has(index)) {
          const existingSlide = carouselContainer.querySelector(`.abu-pg-spotlight-slide[data-index="${index}"]`);
          if (!existingSlide) {
            const item = state.allItems[index];
            const slide = createSpotlightSlide(state, item, index);
            slide.dataset.offset = offset;
            slide.style.transform = `translateX(${offset * window.innerWidth}px)`;
            carouselContainer.appendChild(slide);
            preloadSpotlightTile(state, item, slide, false);
          }
        }
      }
    });
  };
  
  const cleanupDistantTiles = (state) => {
    const { currentIndex, carouselContainer } = state.spotlight;
    const threshold = 3;
    
    const slides = carouselContainer.querySelectorAll('.abu-pg-spotlight-slide');
    slides.forEach(slide => {
      const index = parseInt(slide.dataset.index, 10);
      const distance = Math.abs(index - currentIndex);
      
      if (distance > threshold) {
        const video = slide.querySelector('video');
        if (video) {
          video.pause();
          video.src = '';
          video.load();
        }
        slide.remove();
        state.spotlight.loadedIndices.delete(index);
      }
    });
  };
  
  const syncMasonryPosition = (state) => {
    const { currentIndex } = state.spotlight;
    const item = state.allItems[currentIndex];
    
    if (item && item.element) {
      const rect = item.element.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset;
      const elementTop = rect.top + scrollTop;
      const offset = window.innerHeight * 0.2;
      
      state.scrollY = Math.max(0, elementTop - offset);
    }
  };
  
  const createSpotlightSlide = (state, item, index) => {
    const slide = document.createElement('div');
    slide.className = 'abu-pg-spotlight-slide';
    slide.dataset.index = index;
    
    const ratio = item.originalAspectRatio || getAspectRatio(item);
    const target = getFitRect(ratio, window.innerWidth, window.innerHeight);
    
    slide.style.position = 'fixed';
    slide.style.top = `${target.top}px`;
    slide.style.left = `${target.left}px`;
    slide.style.width = `${target.width}px`;
    slide.style.height = `${target.height}px`;
    
    return slide;
  };
  
  const preloadSpotlightTile = (state, item, slide, shouldAutoplay = false) => {
    const content = createTileElement(item, state.templates, state, 'spotlight');
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.position = 'absolute';
    content.style.top = '0';
    content.style.left = '0';
    
    slide.appendChild(content);
    bindSpotlightInteractions(content, item, state, shouldAutoplay);
    
    const index = parseInt(slide.dataset.index, 10);
    state.spotlight.loadedIndices.add(index);
    
    return content;
  };
  
  const closeSpotlight = (state, skipAnimation = false) => {
    if (!state.spotlight) {
      return;
    }
    
    const { overlay, carouselContainer } = state.spotlight;
    const currentSlide = carouselContainer ? carouselContainer.querySelector('.abu-pg-spotlight-slide.is-active') : null;
    
    if (skipAnimation || !currentSlide) {
      if (overlay) {
        overlay.remove();
      }
      state.spotlight = null;
      unlockScroll(state);
      return;
    }
    
    // Pre-scroll masonry grid to target position while spotlight is still visible
    // This prevents the visible "jump" when the spotlight closes
    if (state.isIOSWebKit) {
      // iOS WebKit: Can scroll directly since position:fixed is not used
      window.scrollTo(0, state.scrollY || 0);
    } else {
      // Non-iOS: Update the fixed position top value to match new scroll position
      // This makes the page appear at the new position before unlock
      document.body.style.top = `-${state.scrollY || 0}px`;
    }
    
    overlay.classList.remove('is-visible');
    
    if (currentSlide) {
      currentSlide.style.transition = 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease';
      currentSlide.style.opacity = '0';
      currentSlide.style.transform = 'translateY(100px) scale(0.95)';
    }
    
    const cleanup = () => {
      overlay.remove();
      state.spotlight = null;
      unlockScroll(state);
    };
    
    setTimeout(cleanup, 350);
  };

  const bindSpotlightInteractions = (tile, item, state, shouldAutoplay = true) => {
    const downloadBtn = tile.querySelector('.abu-pg-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Desktop: show popover with Web/Print options
        // Mobile: direct download of original
        if (!state.isTouch) {
          showDesktopDownloadPopover(downloadBtn, item);
        } else {
          // Mobile: download original directly
          const downloadUrl = item.originalUrl || item.url;
          if (downloadUrl) {
            handleDownload(downloadUrl);
          }
        }
      });
    }

    let saveBtn = tile.querySelector('.abu-pg-save');
    if (!saveBtn && state.isTouch) {
      saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'abu-pg-save';
      tile.appendChild(saveBtn);
    }
    if (saveBtn) {
      ensureSaveButtonContents(saveBtn);
      // Update button label to "Share" for clarity
      const label = saveBtn.querySelector('.abu-pg-save__label');
      if (label) {
        label.textContent = 'Share';
      }
      saveBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (saveBtn.dataset.isSharing === 'true') {
          return;
        }
        // Use web variant for sharing (good balance of quality and file size)
        const shareUrl = item.webUrl || item.url;
        if (shareUrl) {
          setSaveButtonLoading(saveBtn, true);
          shareFile(shareUrl, {
            onSharePrompt: () => setSaveButtonLoading(saveBtn, false),
            onShareSettled: () => setSaveButtonLoading(saveBtn, false),
          });
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

    if (shouldAutoplay) {
      requestAnimationFrame(() => {
        video.play().catch(() => {});
      });
    }

    const muteBtn = tile.querySelector('.abu-pg-mute');
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', video.muted ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      muteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.userActivated = true;
        const isMuted = video.muted;
        const nextVolume = isMuted ? 1 : 0;
        video.muted = !isMuted;
        video.volume = nextVolume;
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
    const { overlay, carouselContainer } = state.spotlight;
    if (state.spotlight.clone) {
      return;
    }
    
    state.allItems = sortItemsByMasonryOrder(state.allItems);
    
    const itemIndex = state.allItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) {
      return;
    }
    state.spotlight.currentIndex = itemIndex;

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
    const ratio = item.originalAspectRatio || getAspectRatio(item);
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

    const startAnimation = () => {
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
    };
    if (state.isIOSWebKit) {
      requestAnimationFrame(() => {
        startAnimation();
        requestAnimationFrame(() => {
          lockScroll(state);
        });
      });
    } else {
      lockScroll(state);
      requestAnimationFrame(() => {
        startAnimation();
      });
    }

    const onTransitionEnd = () => {
      clone.removeEventListener('transitionend', onTransitionEnd);
      
      const slide = createSpotlightSlide(state, item, itemIndex);
      slide.classList.add('is-active');
      slide.dataset.offset = 0;
      slide.style.transform = 'translateX(0)';
      
      const content = createTileElement(item, state.templates, state, 'spotlight');
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      
      slide.appendChild(content);
      carouselContainer.appendChild(slide);
      state.spotlight.loadedIndices.add(itemIndex);
      if (item.type === 'image') {
        const preview = content.querySelector('.abu-pg-spotlight-poster');
        const fullImage = content.querySelector('img:not(.abu-pg-spotlight-poster)');
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
          setTimeout(() => {
            if (clone && clone.parentElement) {
              clone.remove();
              state.spotlight.clone = null;
            }
          }, 200);
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
        setTimeout(() => {
          if (clone && clone.parentElement) {
            clone.remove();
            state.spotlight.clone = null;
          }
        }, 200);
      }
      bindSpotlightInteractions(content, item, state, true);
      
      preloadAdjacentTiles(state);
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
    const tiles = Array.from(gallery.querySelectorAll('.abu-pg-tile'));
    
    return tiles.map((tile, originalIndex) => {
      const video = tile.querySelector('video.abu-pg-video');
      const img = tile.querySelector('img');
      const previewSrc = img
        ? img.currentSrc || img.getAttribute('src') || img.dataset.src || ''
        : '';
      const width = Number(tile.dataset.width || 0);
      const height = Number(tile.dataset.height || 0);
      const type = tile.dataset.type || '';
      const originalAspectRatio = (width > 0 && height > 0)
        ? height / width
        : (type === 'video' ? 9 / 16 : 1);
      const item = {
        id: tile.dataset.id || '',
        type,
        url: tile.dataset.url || '',
        createdAt: tile.dataset.created || '',
        filename: tile.dataset.filename || '',
        title: tile.dataset.title || '',
        width,
        height,
        originalAspectRatio,
        masonryAspectRatio: null,
        meta360: tile.dataset.abuMeta360 || '',
        meta720: tile.dataset.abuMeta720 || '',
        metaPoster: tile.dataset.abuMetaPoster || '',
        meta360Id: tile.dataset.abuMeta360Id || '',
        meta720Id: tile.dataset.abuMeta720Id || '',
        metaPosterId: tile.dataset.abuMetaPosterId || '',
        srcset: img ? img.getAttribute('srcset') || '' : '',
        sizes: img ? img.getAttribute('sizes') || '' : '',
        previewSrc,
        // Image variant URLs (grid, web, original)
        gridUrl: tile.dataset.gridUrl || '',
        webUrl: tile.dataset.webUrl || '',
        originalUrl: tile.dataset.originalUrl || tile.dataset.url || '',
        gridSrcset: tile.dataset.gridSrcset || '',
        gridSizes: tile.dataset.gridSizes || '(max-width: 600px) 50vw, 280px',
        // Video source URLs
        srcOriginal: getVideoDataAttr(video, 'data-src-original', 'srcOriginal'),
        src360: getVideoDataAttr(video, 'data-src-360', 'src360'),
        src720: getVideoDataAttr(video, 'data-src-720', 'src720'),
        poster: getVideoDataAttr(video, 'data-poster', 'poster'),
        element: tile,
        originalIndex,
      };
      item.masonryAspectRatio = calculateMasonryAspectRatio(item);
      return item;
    });
  };
  
  const sortItemsByMasonryOrder = (items) => {
    const itemsWithPositions = items.map(item => {
      if (!item.element) {
        return { ...item, x: 0, y: 0 };
      }
      const transform = item.element.style.transform || '';
      const match = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
      const x = match ? parseFloat(match[1]) : 0;
      const y = match ? parseFloat(match[2]) : 0;
      return { ...item, x, y };
    });
    
    itemsWithPositions.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 10) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });
    
    return itemsWithPositions;
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
      
      // Use appropriate variant based on context
      // Grid: use gridUrl (small, optimized for masonry)
      // Spotlight: use webUrl (high quality for viewing/sharing)
      const imageUrl = isSpotlight 
        ? (item.webUrl || item.url) 
        : (item.gridUrl || item.url);
      const imageSrcset = isSpotlight ? '' : (item.gridSrcset || '');
      const imageSizes = isSpotlight ? '' : (item.gridSizes || '');
      
      img.dataset.src = imageUrl;
      if (imageSrcset) {
        img.dataset.srcset = imageSrcset;
      }
      if (imageSizes) {
        img.dataset.sizes = imageSizes;
      }
      img.alt = '';
      img.decoding = 'async';
      if (isSpotlight) {
        // In spotlight, attach src immediately for fast display
        img.src = imageUrl;
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
      // Show download button on both mobile and desktop in spotlight
      // Mobile: downloads original for print/high-quality
      // Desktop: downloads original as well
      if (isSpotlight) {
        downloadBtn.style.display = '';
      } else if (state.isTouch) {
        // Hide in grid on mobile (only show in spotlight)
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
          tile.appendChild(saveBtn);
        }
      } else if (existingSave) {
        existingSave.remove();
      }
    } else if (existingSave) {
      existingSave.remove();
    }

    if (state.isTouch && isSpotlight) {
      const spotlightSave = tile.querySelector('.abu-pg-save');
      if (spotlightSave) {
        ensureSaveButtonContents(spotlightSave);
      }
    }

    return tile;
  };

  const createDesktopSpotlight = (state) => {
    const overlay = document.createElement('div');
    overlay.className = 'abu-pg-desktop-spotlight';
    
    const container = document.createElement('div');
    container.className = 'abu-pg-desktop-spotlight-container';
    
    const leftColumn = document.createElement('div');
    leftColumn.className = 'abu-pg-desktop-spotlight-left';
    
    const rightColumn = document.createElement('div');
    rightColumn.className = 'abu-pg-desktop-spotlight-right';
    
    container.appendChild(leftColumn);
    container.appendChild(rightColumn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    state.desktopSpotlight = {
      overlay,
      container,
      leftColumn,
      rightColumn,
      currentItem: null,
      rightGrid: null,
      isTransitioning: false,
    };
  };
  
  const getAdjacentItems = (state, currentItem, count = 20) => {
    const sortedItems = sortItemsByMasonryOrder(state.allItems);
    const currentIndex = sortedItems.findIndex(item => item.id === currentItem.id);
    
    if (currentIndex === -1) {
      return sortedItems.slice(0, count);
    }
    
    const halfCount = Math.floor(count / 2);
    let start = Math.max(0, currentIndex - halfCount);
    let end = Math.min(sortedItems.length, currentIndex + halfCount + 1);
    
    if (end - start < count) {
      if (start === 0) {
        end = Math.min(sortedItems.length, count);
      } else {
        start = Math.max(0, end - count);
      }
    }
    
    return sortedItems.slice(start, end).filter(item => item.id !== currentItem.id);
  };
  
  const renderDesktopSpotlightMedia = (state, item) => {
    const { leftColumn } = state.desktopSpotlight;
    leftColumn.innerHTML = '';
    
    if (!item || !item.type) {
      console.error('Invalid item passed to renderDesktopSpotlightMedia:', item);
      return;
    }
    
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'abu-pg-desktop-spotlight-back-btn yp-icon-button';
    if (state.iconTemplates.back) {
      backBtn.innerHTML = state.iconTemplates.back;
    }
    leftColumn.appendChild(backBtn);
    
    backBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeDesktopSpotlight(state);
    });
    
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'abu-pg-desktop-spotlight-media-container';
    
    const buttonsTop = document.createElement('div');
    buttonsTop.className = 'abu-pg-desktop-spotlight-buttons-top';
    
    const buttonsLeft = document.createElement('div');
    buttonsLeft.className = 'abu-pg-desktop-spotlight-buttons-left';
    
    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = 'abu-pg-social-btn abu-pg-like-btn';
    likeBtn.dataset.mediaId = item.id;
    likeBtn.dataset.mediaFilename = item.filename || '';
    likeBtn.dataset.mediaUrl = item.url || '';
    likeBtn.dataset.state = 'unliked';
    likeBtn.setAttribute('aria-label', 'Like');
    if (state.iconTemplates.heart) {
      likeBtn.innerHTML = state.iconTemplates.heart;
    }
    
    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'abu-pg-social-btn abu-pg-comment-btn';
    commentBtn.dataset.mediaId = item.id;
    commentBtn.dataset.mediaFilename = item.filename || '';
    commentBtn.dataset.mediaUrl = item.url || '';
    commentBtn.setAttribute('aria-label', 'Comment');
    if (state.iconTemplates.chatBubble) {
      commentBtn.innerHTML = state.iconTemplates.chatBubble;
    }
    
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'abu-pg-social-btn abu-pg-share-btn';
    shareBtn.dataset.mediaId = item.id;
    shareBtn.dataset.mediaFilename = item.filename || '';
    shareBtn.dataset.mediaUrl = item.url || '';
    shareBtn.setAttribute('aria-label', 'Share');
    if (state.iconTemplates.share2) {
      shareBtn.innerHTML = state.iconTemplates.share2;
    }
    
    buttonsLeft.appendChild(likeBtn);
    buttonsLeft.appendChild(commentBtn);
    buttonsLeft.appendChild(shareBtn);
    
    const buttonsRight = document.createElement('div');
    buttonsRight.className = 'abu-pg-desktop-spotlight-buttons-right';
    
    let muteBtn = null;
    if (item.type === 'video') {
      muteBtn = document.createElement('button');
      muteBtn.type = 'button';
      muteBtn.className = 'abu-pg-desktop-spotlight-mute';
      muteBtn.setAttribute('aria-pressed', 'false');
      muteBtn.setAttribute('aria-label', 'Mute');
      if (state.iconTemplates.speakerLoud && state.iconTemplates.speakerOff) {
        muteBtn.innerHTML = `
          <span class="abu-pg-desktop-spotlight-mute-icon-on">${state.iconTemplates.speakerLoud}</span>
          <span class="abu-pg-desktop-spotlight-mute-icon-off">${state.iconTemplates.speakerOff}</span>
        `;
      }
      buttonsRight.appendChild(muteBtn);
    }
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'abu-pg-desktop-spotlight-save-btn';
    saveBtn.textContent = 'Download';
    buttonsRight.appendChild(saveBtn);
    
    saveBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      // Show popover with Web/Print options
      showDesktopDownloadPopover(saveBtn, item);
    });
    
    buttonsTop.appendChild(buttonsLeft);
    buttonsTop.appendChild(buttonsRight);
    mediaContainer.appendChild(buttonsTop);
    
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'abu-pg-desktop-spotlight-media-wrapper';
    
    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.title || '';
      img.style.cursor = 'default';
      mediaWrapper.appendChild(img);
    } else if (item.type === 'video') {
      console.log('Rendering desktop spotlight video:', {
        id: item.id,
        url: item.url,
        src720: item.src720,
        src360: item.src360,
        srcOriginal: item.srcOriginal,
        poster: item.poster
      });
      
      const video = document.createElement('video');
      video.className = 'abu-pg-video';
      video.setAttribute('playsinline', '');
      video.setAttribute('loop', '');
      video.setAttribute('preload', 'auto');
      video.style.cursor = 'pointer';
      
      const chosenSrc = item.src720 || item.src360 || item.srcOriginal || item.url;
      if (!chosenSrc) {
        console.error('No video source available for item:', item);
        return;
      }
      
      const source = document.createElement('source');
      source.setAttribute('src', chosenSrc);
      source.setAttribute('type', 'video/mp4');
      video.appendChild(source);
      
      video.volume = 1;
      video.muted = false;
      
      const posterUrl = item.poster || '';
      if (posterUrl) {
        const posterImg = document.createElement('img');
        posterImg.className = 'abu-pg-desktop-spotlight-poster';
        posterImg.src = posterUrl;
        posterImg.style.position = 'absolute';
        posterImg.style.inset = '0';
        posterImg.style.width = '100%';
        posterImg.style.height = '100%';
        posterImg.style.objectFit = 'contain';
        posterImg.style.zIndex = '2';
        posterImg.style.pointerEvents = 'none';
        mediaWrapper.appendChild(posterImg);
      }
      
      mediaWrapper.appendChild(video);
      
      if (muteBtn) {
        muteBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.userActivated = true;
          const isMuted = video.muted;
          const nextVolume = isMuted ? 1 : 0;
          video.muted = !isMuted;
          video.volume = nextVolume;
          video.dataset.abuVolume = String(nextVolume);
          muteBtn.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
          muteBtn.setAttribute('aria-label', isMuted ? 'Mute' : 'Unmute');
        });
      }
      
      video.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
      
      const hidePosterAndPlay = () => {
        const posterImg = mediaWrapper.querySelector('.abu-pg-desktop-spotlight-poster');
        if (posterImg) {
          posterImg.style.opacity = '0';
          posterImg.style.transition = 'opacity 180ms ease';
          setTimeout(() => posterImg.remove(), 200);
        }
      };
      
      video.addEventListener('playing', hidePosterAndPlay, { once: true });
      
      const attemptPlay = () => {
        if (video.readyState >= 2) {
          video.play().catch(() => {});
        } else {
          video.addEventListener('loadeddata', () => {
            video.play().catch(() => {});
          }, { once: true });
        }
      };
      
      video.load();
      setTimeout(attemptPlay, 50);
    }
    
    mediaContainer.appendChild(mediaWrapper);
    leftColumn.appendChild(mediaContainer);
  };
  
  const renderDesktopSpotlightRightColumn = (state, adjacentItems) => {
    const { rightColumn } = state.desktopSpotlight;
    
    let grid = rightColumn.querySelector('.abu-pg-desktop-spotlight-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'abu-pg-desktop-spotlight-grid';
      rightColumn.appendChild(grid);
    }
    
    grid.innerHTML = '';
    state.desktopSpotlight.rightGrid = grid;
    
    const rightItems = adjacentItems.map((item, index) => {
      const tile = createTileElement(item, state.templates, state, 'grid');
      tile.style.position = 'absolute';
      tile.style.top = '0';
      tile.style.left = '0';
      
      grid.appendChild(tile);
      
      tile.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.target && event.target.closest('button')) {
          return;
        }
        switchDesktopSpotlightMedia(state, item);
      });
      
      // Attach download button event listener (desktop spotlight right column)
      const downloadBtn = tile.querySelector('.abu-pg-download');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          
          // Desktop spotlight: show popover with Web/Print options
          showDesktopDownloadPopover(downloadBtn, item);
          
          // Blur the button to remove focus state and allow hover state to clear
          downloadBtn.blur();
          tile.blur();
        });
      }
      
      const img = tile.querySelector('img');
      if (img && img.dataset.src) {
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
      
      const video = tile.querySelector('video.abu-pg-video');
      if (video) {
        ensureVideoSource(video);
        video.removeAttribute('loop');
        video.pause();
        video.currentTime = 0;
        video.removeAttribute('autoplay');
        
        const playOverlay = tile.querySelector('.abu-pg-video-play');
        if (playOverlay) {
          playOverlay.style.display = 'none';
        }
        const darkOverlay = tile.querySelector('.abu-pg-video-overlay');
        if (darkOverlay) {
          darkOverlay.style.display = 'none';
        }
        
        // Remove mute button from right column video tiles (can't play from here)
        const muteButton = tile.querySelector('.abu-pg-mute');
        if (muteButton) {
          muteButton.remove();
        }
      }
      
      return {
        ...item,
        element: tile,
      };
    });
    
    const gridWidth = grid.clientWidth || rightColumn.clientWidth;
    const cols = Math.min(3, Math.max(1, Math.floor((gridWidth + 16) / (200 + 16))));
    const colWidth = Math.floor((gridWidth - 16 * (cols - 1)) / cols);
    const colHeights = new Array(cols).fill(0);
    
    rightItems.forEach((item) => {
      const ratio = item.masonryAspectRatio || getAspectRatio(item);
      const height = Math.round(colWidth * ratio);
      item.element.style.width = `${colWidth}px`;
      item.element.style.height = `${height}px`;
      
      let colIndex = 0;
      for (let i = 1; i < cols; i += 1) {
        if (colHeights[i] < colHeights[colIndex]) {
          colIndex = i;
        }
      }
      
      const x = (colWidth + 16) * colIndex;
      const y = colHeights[colIndex];
      item.element.style.transform = `translate(${x}px, ${y}px)`;
      colHeights[colIndex] += height + 16;
    });
    
    const maxHeight = Math.max(...colHeights, 0);
    grid.style.height = `${maxHeight}px`;
  };
  
  const switchDesktopSpotlightMedia = (state, newItem) => {
    if (state.desktopSpotlight.isTransitioning) {
      return;
    }
    
    state.desktopSpotlight.isTransitioning = true;
    state.desktopSpotlight.overlay.classList.add('is-transitioning');
    
    setTimeout(() => {
      const oldVideo = state.desktopSpotlight.leftColumn.querySelector('video');
      if (oldVideo) {
        oldVideo.pause();
        oldVideo.src = '';
      }
      
      state.desktopSpotlight.currentItem = newItem;
      renderDesktopSpotlightMedia(state, newItem);
      
      const adjacentItems = getAdjacentItems(state, newItem);
      renderDesktopSpotlightRightColumn(state, adjacentItems);
      
      setTimeout(() => {
        state.desktopSpotlight.overlay.classList.remove('is-transitioning');
        state.desktopSpotlight.isTransitioning = false;
      }, 220);
    }, 200);
  };
  
  const openDesktopSpotlight = (state, item) => {
    
    if (!state.desktopSpotlight) {
      createDesktopSpotlight(state);
    }
    
    state.desktopSpotlight.currentItem = item;
    
    renderDesktopSpotlightMedia(state, item);
    
    const adjacentItems = getAdjacentItems(state, item);
    renderDesktopSpotlightRightColumn(state, adjacentItems);
    
    lockScroll(state);
    
    // Store initial column count to detect breakpoint changes
    const grid = state.desktopSpotlight.rightGrid;
    const rightColumn = state.desktopSpotlight.rightColumn;
    const initialGridWidth = grid.clientWidth || rightColumn.clientWidth;
    state.desktopSpotlight.currentColumnCount = Math.min(3, Math.max(1, Math.floor((initialGridWidth + 16) / (200 + 16))));
    
    // Add resize handler that only re-layouts when crossing column breakpoints
    let resizeTimeout;
    const handleResize = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        if (state.desktopSpotlight && state.desktopSpotlight.currentItem) {
          const currentGrid = state.desktopSpotlight.rightGrid;
          const currentRightColumn = state.desktopSpotlight.rightColumn;
          const gridWidth = currentGrid.clientWidth || currentRightColumn.clientWidth;
          const newColumnCount = Math.min(3, Math.max(1, Math.floor((gridWidth + 16) / (200 + 16))));
          
          // Only recalculate layout if column count changed (breakpoint crossed)
          if (newColumnCount !== state.desktopSpotlight.currentColumnCount) {
            state.desktopSpotlight.currentColumnCount = newColumnCount;
            const currentAdjacentItems = getAdjacentItems(state, state.desktopSpotlight.currentItem);
            renderDesktopSpotlightRightColumn(state, currentAdjacentItems);
          }
        }
      }, 150);
    };
    
    state.desktopSpotlight.resizeHandler = handleResize;
    window.addEventListener('resize', handleResize);
    
    requestAnimationFrame(() => {
      state.desktopSpotlight.overlay.classList.add('is-visible');
    });
  };
  
  const closeDesktopSpotlight = (state) => {
    if (!state.desktopSpotlight) {
      return;
    }
    
    const video = state.desktopSpotlight.leftColumn.querySelector('video');
    if (video) {
      video.pause();
      video.src = '';
    }
    
    // Remove resize handler
    if (state.desktopSpotlight.resizeHandler) {
      window.removeEventListener('resize', state.desktopSpotlight.resizeHandler);
    }
    
    state.desktopSpotlight.overlay.classList.remove('is-visible');
    
    setTimeout(() => {
      if (state.desktopSpotlight.overlay && state.desktopSpotlight.overlay.parentElement) {
        state.desktopSpotlight.overlay.remove();
      }
      state.desktopSpotlight = null;
      unlockScroll(state);
    }, 260);
  };

  const bindTileInteractions = (tile, item, state) => {
    const downloadBtn = tile.querySelector('.abu-pg-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Desktop: show popover with Web/Print options
        // Mobile: direct download of original
        if (!state.isTouch) {
          showDesktopDownloadPopover(downloadBtn, item);
        } else {
          // Mobile: download original directly
          const downloadUrl = item.originalUrl || item.url;
          if (downloadUrl) {
            handleDownload(downloadUrl);
          }
        }
      });
    }

    const video = tile.querySelector('video.abu-pg-video');
    if (!video) {
      const shouldUseDesktopSpotlight = !isMobileDevice() && 
                                        window.matchMedia && 
                                        window.matchMedia('(pointer: fine)').matches;
      
      if (shouldUseDesktopSpotlight) {
        tile.addEventListener('click', (event) => {
          if (event.target && event.target.closest('button')) {
            return;
          }
          openDesktopSpotlight(state, item);
        });
      } else if (state.isSpotlightEnabled) {
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

    const shouldUseDesktopSpotlight = !isMobileDevice() && 
                                      window.matchMedia && 
                                      window.matchMedia('(pointer: fine)').matches;
    
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (hasHover && !shouldUseDesktopSpotlight) {
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
    } else if (hasHover && shouldUseDesktopSpotlight) {
      tile.addEventListener('mouseenter', () => {
        if (video.dataset.srcLoaded !== 'true') {
          ensureVideoSource(video);
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
      muteBtn.setAttribute('aria-pressed', video.muted ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      muteBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.userActivated = true;
        const isMuted = video.muted;
        const nextVolume = isMuted ? 1 : 0;
        video.muted = !isMuted;
        video.volume = nextVolume;
        video.dataset.abuVolume = String(nextVolume);
        muteBtn.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
        muteBtn.setAttribute('aria-label', isMuted ? 'Mute' : 'Unmute');
      });
    }

    tile.addEventListener('click', (event) => {
      if (event.target && event.target.closest('button')) {
        return;
      }
      
      const shouldUseDesktopSpotlight = !isMobileDevice() && 
                                        window.matchMedia && 
                                        window.matchMedia('(pointer: fine)').matches;
      
      if (shouldUseDesktopSpotlight) {
        openDesktopSpotlight(state, item);
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
    
    // Update performance overlay if debug is enabled
    if (state.debug) {
      requestAnimationFrame(() => updatePerformanceOverlay(state));
    }
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
    const chapterId = gallery.dataset.chapterId || 'unknown';
    const isDebug = isDebugEnabled();
    
    const state = {
      container: gallery,
      layoutConfig: {
        columnWidth: Number(gallery.dataset.columnWidth || 280),
        gutter: Number(gallery.dataset.gutter || 16),
      },
      isTouch: window.matchMedia && window.matchMedia('(hover: none)').matches,
      isSpotlightEnabled: window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
      isIOSWebKit: isIOSWebKit(),
      debug: isDebug,
      chapterId: chapterId,
      scrollLocked: false,
      scrollY: 0,
      spotlight: null,
      desktopSpotlight: null,
      iconTemplates: {
        back: '',
        heart: '',
        heartFilled: '',
        chatBubble: '',
        share2: '',
        speakerLoud: '',
        speakerOff: '',
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
      // Configure lazy loading with buffer zone (~2 viewport heights)
      // This preloads images before they enter viewport for smoother scrolling
      state.imageObserver = new IntersectionObserver(
        (entries) => {
          let shouldUpdateOverlay = false;
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
                img.decoding = 'async';
                delete img.dataset.src;
                delete img.dataset.srcset;
                delete img.dataset.sizes;
                shouldUpdateOverlay = true;
              }
              state.imageObserver.unobserve(img);
            }
          });
          // Update performance overlay if debug is enabled
          if (shouldUpdateOverlay && state.debug) {
            requestAnimationFrame(() => updatePerformanceOverlay(state));
          }
        },
        {
          root: null,
          rootMargin: '1000px 0px', // 1000px buffer above and below viewport
          threshold: 0.01,
        }
      );
    }

    const backTemplate = document.querySelector('.abu-pg-icon-template[data-icon="caret-left"]');
    if (backTemplate) {
      state.iconTemplates.back = backTemplate.innerHTML;
    }
    
    const heartTemplate = document.querySelector('.abu-pg-icon-template[data-icon="heart"]');
    if (heartTemplate) {
      state.iconTemplates.heart = heartTemplate.innerHTML;
    }
    
    const heartFilledTemplate = document.querySelector('.abu-pg-icon-template[data-icon="heart-filled"]');
    if (heartFilledTemplate) {
      state.iconTemplates.heartFilled = heartFilledTemplate.innerHTML;
    }
    
    const chatBubbleTemplate = document.querySelector('.abu-pg-icon-template[data-icon="chat-bubble"]');
    if (chatBubbleTemplate) {
      state.iconTemplates.chatBubble = chatBubbleTemplate.innerHTML;
    }
    
    const share2Template = document.querySelector('.abu-pg-icon-template[data-icon="share-2"]');
    if (share2Template) {
      state.iconTemplates.share2 = share2Template.innerHTML;
    }
    
    const speakerLoudTemplate = document.querySelector('.abu-pg-icon-template[data-icon="speaker-loud"]');
    if (speakerLoudTemplate) {
      state.iconTemplates.speakerLoud = speakerLoudTemplate.innerHTML;
    }
    
    const speakerOffTemplate = document.querySelector('.abu-pg-icon-template[data-icon="speaker-off"]');
    if (speakerOffTemplate) {
      state.iconTemplates.speakerOff = speakerOffTemplate.innerHTML;
    }

    const builtItems = buildItemsFromDOM(gallery);
    state.allItems = builtItems;
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
    
    const debouncedSort = (() => {
      let rafId = null;
      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
          rafId = null;
          state.allItems = sortItemsByMasonryOrder(state.allItems);
        });
      };
    })();

    state.sentinel = document.createElement('div');
    state.sentinel.className = 'abu-pg-sentinel';
    state.sentinel.style.position = 'absolute';
    state.sentinel.style.left = '0';
    state.sentinel.style.right = '0';
    state.sentinel.style.height = '1px';

    renderChunk(state);
    
    requestAnimationFrame(() => {
      state.allItems = sortItemsByMasonryOrder(state.allItems);
    });

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
          if (debouncedSort) {
            debouncedSort();
          }
        });
      };
    })();

    window.addEventListener('resize', debouncedLayout);
    
    state.debouncedSort = debouncedSort;

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
