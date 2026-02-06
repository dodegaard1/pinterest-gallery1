(function () {
  // CLEAN BREAK: Removed telemetry/agent logging code
  
  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };


  /**
   * Determines if mobile spotlight layout should be used.
   * CONSERVATIVE: Only returns true for actual mobile devices, never for desktops.
   * 
   * Requirements:
   * - Viewport width <= 900px (mobile/tablet range)
   * - AND (coarse pointer OR touch support)
   * - AND no hover capability (avoids touch-enabled laptops)
   * 
   * This is the SINGLE source of truth for layout decisions.
   */
  const shouldUseMobileLayout = () => {
    // Check viewport width
    const isNarrowViewport = window.innerWidth <= 900;
    
    // Check pointer capability
    const hasCoarsePointer = window.matchMedia && (
      window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    );
    
    // Check hover capability (avoid touch-enabled laptops)
    const lacksHover = window.matchMedia && window.matchMedia('(hover: none)').matches;
    
    // Conservative: ALL conditions must be true for mobile layout
    return isNarrowViewport && hasCoarsePointer && lacksHover;
  };
  
  /**
   * Legacy mobile detection (DEPRECATED - only use for iOS-specific quirks).
   * For layout decisions, use shouldUseMobileLayout() instead.
   */
  const isMobileDevice = () => /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  /**
   * iOS WebKit detection for Safari-specific workarounds.
   */
  const isIOSWebKit = () => {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
    const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleMobile || isIpadOS;
  };
  
  /**
   * Determines if Web Share API should be used (for share vs download button).
   * 
   * Criteria:
   * - navigator.share available
   * - AND mobile layout active
   * - OPTIONAL: Can check for iPhone UA if needed for button variant
   */
  const shouldUseShareButton = () => {
    const hasShareAPI = typeof navigator.share === 'function';
    const isMobile = shouldUseMobileLayout();
    return hasShareAPI && isMobile;
  };

  // #region agent log
  // Helper for mobile debugging - uses WordPress AJAX endpoint for tunnel compatibility
  function logMobile(payload) {
    if (!payload) return;
    payload.sessionId = 'mobile-debug-session';
    payload.timestamp = Date.now();
    
    // Use WordPress AJAX endpoint (works via tunnel)
    const ajaxUrl = (typeof window.abuPgConfig !== 'undefined' && window.abuPgConfig.ajaxUrl) ? window.abuPgConfig.ajaxUrl : '/wp-admin/admin-ajax.php';
    fetch(`${ajaxUrl}?action=abu_pg_debug_log`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    }).catch(() => {});
  }
  
  // Stub for logDeepLinkTiming (was removed but still referenced in code)
  const logDeepLinkTiming = () => {};
  // #endregion agent log

  /**
   * Auth state refresh helper
   * 
   * Fetches current auth state from server and updates UI gating.
   * Called when spotlight opens and on visibility change to prevent
   * stale client-side state from showing buttons incorrectly.
   */
  let authStateCache = null;
  let authStateLastFetch = 0;
  const AUTH_STATE_CACHE_MS = 30000; // Cache for 30 seconds

  const refreshAuthState = async () => {
    // Use cached value if recent
    const now = Date.now();
    if (authStateCache !== null && (now - authStateLastFetch) < AUTH_STATE_CACHE_MS) {
      return authStateCache;
    }

    try {
      const config = window.abuUsersConfig || window.abuPgConfig;
      if (!config || !config.ajaxUrl) {
        return { isLoggedIn: false };
      }

      const response = await fetch(`${config.ajaxUrl}?action=abu_users_get_auth_state`, {
        method: 'GET',
        credentials: 'same-origin'
      });

      if (!response.ok) {
        return { isLoggedIn: false };
      }

      const data = await response.json();
      if (data.success && data.data) {
        authStateCache = data.data;
        authStateLastFetch = now;
        return data.data;
      }

      return { isLoggedIn: false };
    } catch (error) {
      console.warn('[ABU] Auth state refresh failed:', error);
      return { isLoggedIn: false };
    }
  };

  /**
   * Update UI based on auth state
   * 
   * Shows/hides gated buttons (download, share, like, comment) based on login state.
   */
  const updateAuthGating = (authState) => {
    const isLoggedIn = authState && authState.isLoggedIn;

    // Update global config
    if (window.abuPgConfig) {
      window.abuPgConfig.isLoggedIn = isLoggedIn;
      window.abuPgConfig.canDownload = isLoggedIn;
      window.abuPgConfig.canShare = isLoggedIn;
      window.abuPgConfig.canLike = isLoggedIn;
      window.abuPgConfig.canComment = isLoggedIn;
    }

    // Update spotlight UI if open
    const spotlight = document.querySelector('.abu-pg-spotlight-overlay');
    if (spotlight && spotlight.classList.contains('is-visible')) {
      // Update download/save button visibility
      const saveBtn = spotlight.querySelector('.abu-pg-save');
      if (saveBtn) {
        saveBtn.style.display = isLoggedIn ? '' : 'none';
      }

      // Update share button visibility (desktop Web Share API button)
      const shareBtn = spotlight.querySelector('.abu-pg-share-btn');
      if (shareBtn) {
        shareBtn.style.display = isLoggedIn ? '' : 'none';
      }

      // Update like button state
      const likeBtn = spotlight.querySelector('.abu-pg-like');
      if (likeBtn) {
        if (!isLoggedIn) {
          // Add login prompt handler
          const existingHandler = likeBtn.onclick;
          if (!existingHandler || !existingHandler.toString().includes('loginUrl')) {
            likeBtn.onclick = (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (window.abuPgConfig && window.abuPgConfig.loginUrl) {
                window.location.href = window.abuPgConfig.loginUrl;
              }
            };
          }
        }
      }

      // Update comment bar
      const commentBar = spotlight.querySelector('.abu-pg-spotlight-comment-bar');
      if (commentBar) {
        const commentInput = commentBar.querySelector('input[type="text"]');
        if (commentInput) {
          if (isLoggedIn) {
            commentBar.classList.remove('logged-out');
            commentInput.placeholder = 'Add a comment...';
            commentInput.readOnly = false;
          } else {
            commentBar.classList.add('logged-out');
            commentInput.placeholder = 'Log in to comment';
            commentInput.readOnly = true;
            // Add login prompt handler
            commentInput.onclick = (event) => {
              event.preventDefault();
              if (window.abuPgConfig && window.abuPgConfig.loginUrl) {
                window.location.href = window.abuPgConfig.loginUrl;
              }
            };
          }
        }
      }
    }

    // Update masonry tile buttons
    document.querySelectorAll('.abu-pg-tile .abu-pg-download').forEach(btn => {
      btn.style.display = isLoggedIn ? '' : 'none';
    });
  };

  /**
   * Visibility change handler
   * 
   * Refreshes auth state when page becomes visible again to catch
   * login/logout that happened in another tab.
   */
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      const authState = await refreshAuthState();
      updateAuthGating(authState);
    }
  });

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

  // Debug logging helper (uses WP admin-ajax endpoint only, only when debug mode enabled)
  const logDebug = (payload) => {
    if (!window.abuPgDebug || !window.abuPgDebug.enabled) {
      return;
    }
    if (window.abuPgDebug.endpoint) {
      fetch(`${window.abuPgDebug.endpoint}?action=abu_pg_debug_log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      }).catch(() => {});
    }
  };
  
  // Navigation debug logger (always logs to console when ?abu_pg_debug=1)
  const logNav = (context, data) => {
    if (!window.abuPgDebug || !window.abuPgDebug.enabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, context, ...data };
    console.log(`[NAV DEBUG] ${context}:`, logEntry);
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
   * ========================================
   * URL State Manager with History API
   * ========================================
   * 
   * CLEAN BREAK: Uses canonical tile permalinks for deep linking.
   * 
   * Manages URL state for chapter navigation and spotlight deep-linking.
   * Uses History API (pushState/replaceState) for no-reload updates.
   * 
   * URL Parameters:
   * - chapter=<slug>: Current active chapter
   * - kit=<id>: Kit context for tile permalinks (optional)
   * 
   * Deep Linking:
   * - On kit page: clicking tile pushState to tile permalink (/tile/slug/?kit=kitId)
   * - On tile permalink: opens spotlight immediately
   * - Closing spotlight: replaceState back to kit URL
   * - Back button: closes spotlight if open
   */
  const URLStateManager = (() => {
    let internalState = {
      chapterSlug: null,
      kitBaseURL: null, // Store original kit URL for restoration
    };
    
    let isPopStateUpdate = false;
    let isInitialLoad = false;
    let galleries = [];
    
    /**
     * Parse current URL parameters
     */
    const parseURL = () => {
      const params = new URLSearchParams(window.location.search);
      
      return {
        chapterSlug: params.get('chapter') || null,
        kitId: params.get('kit') || null,
      };
    };
    
    /**
     * Build URL search string from state object
     */
    const buildSearchString = (state) => {
      const params = new URLSearchParams();
      
      // Preserve existing params (like abu_pg_debug)
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.forEach((value, key) => {
        if (key !== 'chapter' && key !== 'kit') {
          params.set(key, value);
        }
      });
      
      // Add chapter param if present
      if (state.chapterSlug) {
        params.set('chapter', state.chapterSlug);
      }
      
      const search = params.toString();
      return search ? '?' + search : '';
    };
    
    /**
     * Update URL using History API
     * @param {Object} newState - { chapterSlug, openTileId }
     * @param {boolean} replace - Use replaceState instead of pushState
     */
    const updateURL = (newState, replace = false) => {
      internalState = { ...internalState, ...newState };
      const searchString = buildSearchString(internalState);
      const url = window.location.pathname + searchString + window.location.hash;
      
      if (replace) {
        window.history.replaceState(internalState, '', url);
      } else {
        window.history.pushState(internalState, '', url);
      }
    };
    
    /**
     * Get active chapter slug from DOM
     */
    const getActiveChapterSlug = () => {
      const activeLink = document.querySelector('.abu-pg-chapter-link.is-active');
      if (activeLink) {
        return activeLink.getAttribute('data-chapter-slug');
      }
      
      // Fallback: get first chapter
      const firstLink = document.querySelector('.abu-pg-chapter-link');
      return firstLink ? firstLink.getAttribute('data-chapter-slug') : null;
    };
    
    /**
     * Find which chapter contains a given item ID
     */
    const findChapterForItem = (itemId) => {
      for (const gallery of galleries) {
        const item = gallery.allItems.find(i => i.id === itemId);
        if (item) {
          const section = gallery.container.closest('.abu-pg-chapter-section');
          if (section) {
            return section.getAttribute('data-chapter-slug');
          }
        }
      }
      return null;
    };
    
    /**
     * Find item in all galleries
     */
    const findItem = (itemId) => {
      for (const gallery of galleries) {
        const item = gallery.allItems.find(i => i.id === itemId);
        if (item) {
          return { item, gallery };
        }
      }
      return null;
    };
    
    /**
     * Build fast lookup map: id -> index for current active items
     */
    const buildItemIndexMap = (gallery) => {
      const map = new Map();
      gallery.activeItems.forEach((item, index) => {
        map.set(item.id, index);
      });
      return map;
    };
    
    /**
     * Render enough chunks to include target item
     * @returns {Promise} Resolves when chunks are rendered and layout is complete
     */
    const renderChunksUpToItem = async (gallery, itemId) => {
      const indexMap = buildItemIndexMap(gallery);
      const targetIndex = indexMap.get(itemId);
      
      if (targetIndex === undefined) {
        return false; // Item not found
      }
      
      // Calculate how many items we need to render
      const targetVisibleCount = targetIndex + 1;
      
      // If already visible, we're done
      if (targetVisibleCount <= gallery.visibleCount) {
        return true;
      }
      
      // Render chunks up to target item
      gallery.visibleCount = Math.min(targetVisibleCount, gallery.activeItems.length);
      const itemsToRender = gallery.activeItems.slice(0, gallery.visibleCount);
      gallery.renderItems(itemsToRender);
      
      // Wait for layout to complete
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      return true;
    };
    
    /**
     * Scroll tile into view smoothly
     */
    const scrollTileIntoView = async (tile) => {
      if (!tile) return;
      
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const nav = document.querySelector('.abu-pg-chapters-nav');
      const navHeight = nav ? nav.offsetHeight : 0;
      
      // Calculate position with nav offset
      const rect = tile.getBoundingClientRect();
      const targetY = window.pageYOffset + rect.top - navHeight - 20; // 20px extra padding
      
      window.scrollTo({
        top: targetY,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      
      // Wait for scroll to complete (approximate)
      if (!prefersReducedMotion) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    };
    
    /**
     * Switch to a specific chapter
     */
    const switchToChapter = async (targetSlug) => {
      if (!targetSlug) return false;
      
      const targetSection = document.querySelector(`.abu-pg-chapter-section[data-chapter-slug="${targetSlug}"]`);
      if (!targetSection) return false;
      
      const nav = document.querySelector('.abu-pg-chapters-nav');
      const navHeight = nav ? nav.offsetHeight : 0;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // Calculate position with nav offset
      const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
      
      window.scrollTo({
        top: targetPosition,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
      
      // Wait for scroll and intersection observer to update active state
      if (!prefersReducedMotion) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      return true;
    };
    
    /**
     * Open spotlight for a specific item (deep link handler)
     */
    const openSpotlightForItem = async (itemId) => {
      const result = findItem(itemId);
      if (!result) {
        console.warn(`ABU Gallery: Item ${itemId} not found`);
        // Clear invalid item param
        updateURL({ openTileId: null }, true);
        return false;
      }
      
      const { item, gallery } = result;
      const itemChapterSlug = gallery.container.closest('.abu-pg-chapter-section')?.getAttribute('data-chapter-slug');
      
      // Switch to correct chapter if needed
      const currentChapterSlug = getActiveChapterSlug();
      if (itemChapterSlug && itemChapterSlug !== currentChapterSlug) {
        await switchToChapter(itemChapterSlug);
        // Update URL with correct chapter
        updateURL({ chapterSlug: itemChapterSlug }, true);
      }
      
      // Ensure item is rendered
      const rendered = await renderChunksUpToItem(gallery, itemId);
      if (!rendered) {
        console.warn(`ABU Gallery: Could not render item ${itemId}`);
        updateURL({ openTileId: null }, true);
        return false;
      }
      
      // Wait for masonry layout to complete
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Find the tile element
      const tile = gallery.container.querySelector(`.abu-pg-tile[data-id="${itemId}"]`);
      if (!tile) {
        console.warn(`ABU Gallery: Tile element not found for item ${itemId}`);
        updateURL({ openTileId: null }, true);
        return false;
      }
      
      // Scroll tile into view
      await scrollTileIntoView(tile);
      
      // Wait for images to load if needed
      const img = tile.querySelector('img');
      if (img) {
        await waitForImageReady(img, `deep-link-${itemId}`);
      }
      
      // Open spotlight with the real tile element (for correct FLIP rect)
      const useMobileLayout = shouldUseMobileLayout();
      
      if (!useMobileLayout) {
        openDesktopSpotlight(gallery, item);
      } else if (gallery.isSpotlightEnabled) {
        openSpotlight(gallery, tile, item);
      }
      
      return true;
    };
    
    /**
     * Handle browser back/forward (popstate event)
     * 
     * CLEAN BREAK: Simplified - just close spotlight on back button.
     * No query param tile handling - that's done by permalink pages.
     */
    const handlePopState = async (event) => {
      isPopStateUpdate = true;
      
      const urlState = parseURL();
      const prevState = { ...internalState };
      internalState = urlState;
      
      // If navigating back from tile permalink to kit page, close any open spotlights
      // (This handles the case where user visited tile permalink, then hit back)
      for (const gallery of galleries) {
        if (gallery.spotlight) {
          closeSpotlight(gallery);
        }
        if (gallery.desktopSpotlight) {
          closeDesktopSpotlight(gallery);
        }
      }
      
      // Handle chapter change (if chapter param in URL)
      if (urlState.chapterSlug && urlState.chapterSlug !== prevState.chapterSlug) {
        await switchToChapter(urlState.chapterSlug);
      }
      
      setTimeout(() => {
        isPopStateUpdate = false;
      }, 100);
    };
    
    /**
     * Initialize URL state manager
     */
    const init = (galleryInstances) => {
      galleries = galleryInstances;
      
      // Parse initial URL state
      internalState = parseURL();
      
      // Listen to popstate (browser back/forward)
      window.addEventListener('popstate', handlePopState);
      
      // Replace initial state to ensure history.state is set
      window.history.replaceState(internalState, '', window.location.href);
    };
    
    /**
     * Wait for galleries to be fully initialized
     */
    const waitForGalleriesReady = async () => {
      // Check if all galleries have items loaded
      const maxAttempts = 20; // 2 seconds max wait
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const allReady = galleries.every(gallery => 
          gallery.allItems && gallery.allItems.length > 0
        );
        
        if (allReady) {
          return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.warn('ABU Gallery: Timeout waiting for galleries to initialize');
      return false;
    };
    
    /**
     * Handle page load with URL parameters
     */
    const handleInitialLoad = async () => {
      const urlState = parseURL();
      
      // Early exit if no URL params to process
      if (!urlState.chapterSlug) {
        return;
      }
      
      // Wait for galleries to be fully ready
      const ready = await waitForGalleriesReady();
      if (!ready) {
        console.warn('ABU Gallery: Galleries not ready for chapter navigation');
        return;
      }
      
      // Set flag to prevent URL updates during initial load
      isInitialLoad = true;
      
      try {
        // Apply chapter (if present)
        if (urlState.chapterSlug) {
          const switched = await switchToChapter(urlState.chapterSlug);
          if (switched) {
            internalState.chapterSlug = urlState.chapterSlug;
          }
        }
      } finally {
        // Clear flag after initial load is complete
        setTimeout(() => {
          isInitialLoad = false;
        }, 100);
      }
    };
    
    /**
     * Public API
     */
    return {
      init,
      handleInitialLoad,
      updateURL,
      getState: () => ({ ...internalState }),
      isPopStateUpdate: () => isPopStateUpdate,
      isInitialLoad: () => isInitialLoad,
      getActiveChapterSlug,
      setChapter: (slug) => {
        updateURL({ chapterSlug: slug }, false);
      },
      setOpenTile: (tilePermalink, kitId) => {
        // Navigate to tile permalink with kit context
        const url = kitId ? `${tilePermalink}?kit=${kitId}` : tilePermalink;
        window.history.pushState({ kitBaseURL: internalState.kitBaseURL || window.location.href }, '', url);
      },
      clearOpenTile: () => {
        // Restore kit base URL (close spotlight, return to kit view)
        const targetURL = internalState.kitBaseURL || window.location.pathname + buildSearchString(internalState);
        window.history.replaceState(internalState, '', targetURL);
      },
      storeKitBaseURL: () => {
        // Store current kit URL for restoration when closing spotlight
        internalState.kitBaseURL = window.location.href;
      },
    };
  })();

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
      // #region agent log H4
      logMobile({hypothesisId:'H4',location:'lockScroll:already-locked',message:'Scroll already locked',data:{}});
      // #endregion agent log H4
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
    // #region agent log H4
    logMobile({hypothesisId:'H4',location:'lockScroll:complete',message:'Scroll locked',data:{scrollY:state.scrollY,isIOSWebKit:!!state.isIOSWebKit,bodyPosition:document.body.style.position,bodyOverflow:document.body.style.overflow,documentOverflow:document.documentElement.style.overflow}});
    // #endregion agent log H4
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
    // #region agent log H1-H2
    logMobile({hypothesisId:'H1-H2',location:'createSpotlight:entry',message:'Creating mobile spotlight overlay',data:{viewportW:window.innerWidth,viewportH:window.innerHeight,isMobile:isMobileDevice()}});
    // #endregion agent log H1-H2
    
    const overlay = document.createElement('div');
    overlay.className = 'abu-pg-spotlight';
    const backdrop = document.createElement('div');
    backdrop.className = 'abu-pg-spotlight-backdrop';
    overlay.appendChild(backdrop);
    
    const carouselContainer = document.createElement('div');
    carouselContainer.className = 'abu-pg-spotlight-carousel';
    overlay.appendChild(carouselContainer);
    
    document.body.appendChild(overlay);
    
    // #region agent log H1
    const computedStyle = window.getComputedStyle(overlay);
    logMobile({hypothesisId:'H1',location:'createSpotlight:after-append',message:'Spotlight DOM appended to body',data:{overlayInDOM:document.body.contains(overlay),overlayClassName:overlay.className,overlayZIndex:computedStyle.zIndex,overlayPosition:computedStyle.position,overlayDisplay:computedStyle.display,overlayVisibility:computedStyle.visibility,overlayOpacity:computedStyle.opacity,overlayTop:computedStyle.top,overlayLeft:computedStyle.left,overlayWidth:computedStyle.width,overlayHeight:computedStyle.height}});
    // #endregion agent log H1
    
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
    logDeepLinkTiming('spotlight_gestures_binding_start', { isDeepLink: !!state.isDeepLinkMode });
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
    logDeepLinkTiming('spotlight_gestures_attached', { isDeepLink: !!state.isDeepLinkMode });
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
  
  /**
   * Render mobile spotlight slide with explicit media DOM construction.
   * Similar to renderDesktopSpotlightMedia but for mobile slides.
   * 
   * This function builds the media element directly without relying on
   * createTileElement (which expects masonry tile context).
   */
  // DELETED: renderMobileSpotlightSlide() was a duplicate mobile UI renderer.
  // Mobile spotlight direct URLs now use the SAME rendering path as masonry taps:
  // preloadSpotlightTile() -> createTileElement() -> existing spotlight UI.
  // This ensures ONE single code path for mobile spotlight rendering.
  
  const preloadSpotlightTile = (state, item, slide, shouldAutoplay = false) => {
    // #region agent log H8
    logMobile({hypothesisId:'H8',location:'preloadSpotlightTile:entry',message:'Preloading tile',data:{itemId:item.id,itemType:item.type,hasTemplates:!!state.templates,slideIndex:slide.dataset.index,itemPreviewSrc:item.previewSrc||'none',itemWebUrl:item.webUrl||'none'}});
    // #endregion agent log H8
    
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
    
    // #region agent log H8
    requestAnimationFrame(() => {
      const contentStyles = window.getComputedStyle(content);
      const img = content.querySelector('img');
      const poster = content.querySelector('.abu-pg-spotlight-poster');
      const imgStyles = img ? window.getComputedStyle(img) : null;
      const imgRect = img ? img.getBoundingClientRect() : null;
      logMobile({hypothesisId:'H8',location:'preloadSpotlightTile:after-append',message:'Content appended',data:{contentClass:content.className,contentWidth:content.clientWidth,contentHeight:content.clientHeight,contentTop:contentStyles.top,contentLeft:contentStyles.left,contentPosition:contentStyles.position,contentOpacity:contentStyles.opacity,contentVisibility:contentStyles.visibility,contentDisplay:contentStyles.display,hasImg:!!img,hasPoster:!!poster,posterSrc:poster?poster.src||'':'',imgSrc:img?img.src||'':'',imgWidth:img?img.clientWidth:0,imgHeight:img?img.clientHeight:0,imgOpacity:imgStyles?imgStyles.opacity:'',imgDisplay:imgStyles?imgStyles.display:'',imgRectTop:imgRect?Math.round(imgRect.top):0,imgRectLeft:imgRect?Math.round(imgRect.left):0,imgRectWidth:imgRect?Math.round(imgRect.width):0,imgRectHeight:imgRect?Math.round(imgRect.height):0}});
    });
    // #endregion agent log H8
    
    return content;
  };
  
  const closeSpotlight = (state, skipAnimation = false) => {
    // #region agent log
    // H5: Log spotlight close attempt
    if (window.ABU_DEBUG === true) {
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fix-test',hypothesisId:'H5',location:'gallery.js:1606',message:'closeSpotlight called',data:{hasSpotlight:!!state.spotlight,hasOverlay:!!(state.spotlight&&state.spotlight.overlay),skipAnimation:skipAnimation},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    
    if (!state.spotlight) {
      // #region agent log
      // H5: Log if spotlight doesn't exist
      if (window.ABU_DEBUG === true) {
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'fix-test',hypothesisId:'H5',location:'gallery.js:1619',message:'closeSpotlight early return - no spotlight',data:{},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      return;
    }
    
    // FIXED: Mobile permalink close/back should navigate to kit URL if present
    // Check if we have kit context (from direct URL visit) and should navigate to gallery
    const isDirectURLMode = state.kitContext && state.kitContext.kitUrl;
    
    if (isDirectURLMode) {
      // Direct URL visit: navigate back to the kit gallery page
      window.location.href = state.kitContext.kitUrl;
      return;
    }
    
    // Normal masonry mode: restore kit base URL with URLStateManager
    // (This path is for when spotlight was opened from masonry tap)
    if (typeof URLStateManager !== 'undefined' && 
        !URLStateManager.isPopStateUpdate() && 
        !URLStateManager.isInitialLoad()) {
      URLStateManager.clearOpenTile();
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

  const openSpotlight = (state, tile, item, skipAnimation = false) => {
    // GOAL 1/DEBUG: Tag item with entry mode for debugging
    const entryMode = tile ? 'tap-from-masonry' : 'direct-url';
    item._entryMode = entryMode;
    
    // Refresh auth state when opening spotlight
    refreshAuthState().then(authState => {
      updateAuthGating(authState);
    }).catch(err => {
      console.warn('[ABU] Failed to refresh auth state:', err);
    });
    
    // DEBUG: Log openSpotlight entry with detailed context
    if (window.ABU_DEBUG === true) {
      console.log('[ABU_DEBUG] openSpotlight:entry', {
        entryMode,
        itemId: item.id,
        itemType: item.type,
        itemKeys: Object.keys(item).filter(k => !k.startsWith('_')),
        hasPreviewSrc: !!item.previewSrc,
        previewSrc: item.previewSrc || 'MISSING',
        hasGridUrl: !!item.gridUrl,
        gridUrl: item.gridUrl || 'MISSING',
        hasWebUrl: !!item.webUrl,
        webUrl: item.webUrl || 'MISSING',
        url: item.url || 'MISSING',
        hasTile: !!tile,
        skipAnimation,
        isMobile: shouldUseMobileLayout(),
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        warnings: [
          !item.webUrl && item.type === 'image' ? 'Missing webUrl for image!' : null,
          !item.previewSrc && item.type === 'image' ? 'Missing previewSrc for image!' : null,
          !item.url ? 'Missing url!' : null
        ].filter(Boolean)
      });
    }
    
    // #region agent log H3
    logMobile({hypothesisId:'H3',location:'openSpotlight:entry',message:'openSpotlight called',data:{isSpotlightEnabled:state.isSpotlightEnabled,hasSpotlight:!!state.spotlight,itemId:item.id,itemType:item.type,hasTile:!!tile,skipAnimation,isMobile:isMobileDevice(),viewportW:window.innerWidth,viewportH:window.innerHeight}});
    // #endregion agent log H3
    
    if (!state.isSpotlightEnabled) {
      // #region agent log H3
      logMobile({hypothesisId:'H3',location:'openSpotlight:disabled',message:'Spotlight disabled, returning early',data:{}});
      // #endregion agent log H3
      return;
    }
    if (!state.spotlight) {
      createSpotlight(state);
    }
    
    // #region agent log H3
    logMobile({hypothesisId:'H3',location:'openSpotlight:after-create',message:'After createSpotlight',data:{hasSpotlight:!!state.spotlight,hasOverlay:!!(state.spotlight&&state.spotlight.overlay),hasCarousel:!!(state.spotlight&&state.spotlight.carouselContainer)}});
    // #endregion agent log H3
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'image-gap',hypothesisId:'E',location:'gallery.js:454',message:'openSpotlight called',data:{type:item.type||'',id:item.id||'',url:item.url||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    // #region agent log
    logDebug({sessionId:'debug-session',runId:'image-gap-https',hypothesisId:'E',location:'gallery.js:454',message:'openSpotlight called (https)',data:{type:item.type||'',id:item.id||'',url:item.url||''},timestamp:Date.now()});
    // #endregion agent log
    const { overlay, carouselContainer } = state.spotlight;
    if (state.spotlight.clone) {
      // #region agent log H3
      logMobile({hypothesisId:'H3',location:'openSpotlight:clone-exists',message:'Clone already exists - EARLY RETURN',data:{}});
      // #endregion agent log H3
      return;
    }
    
    // #region agent log H3
    logMobile({hypothesisId:'H3',location:'openSpotlight:before-url-update',message:'No clone, continuing...',data:{hasURLStateManager:typeof URLStateManager !== 'undefined'}});
    // #endregion agent log H3
    
    // Update URL to tile permalink (unless this is from a popstate event or initial load)
    // CLEAN BREAK: Navigate to tile permalink instead of query param
    if (typeof URLStateManager !== 'undefined' && 
        !URLStateManager.isPopStateUpdate() && 
        !URLStateManager.isInitialLoad() &&
        item.permalink) {
      // #region agent log H3
      logMobile({hypothesisId:'H3',location:'openSpotlight:url-updating',message:'Updating URL',data:{permalink:item.permalink}});
      // #endregion agent log H3
      // Store kit base URL before navigating to tile
      URLStateManager.storeKitBaseURL();
      
      // Get kit ID from gallery wrapper
      const kitId = state.container.closest('.abu-pg-chapters-wrapper')?.dataset.postId;
      URLStateManager.setOpenTile(item.permalink, kitId);
    }
    
    state.allItems = sortItemsByMasonryOrder(state.allItems);
    
    // #region agent log H3
    logMobile({hypothesisId:'H3',location:'openSpotlight:after-sort',message:'Checking if item exists in allItems',data:{itemId:item.id,allItemsCount:state.allItems.length,allItemIds:state.allItems.map(i=>i.id).join(',')}});
    // #endregion agent log H3
    
    const itemIndex = state.allItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) {
      // #region agent log H3
      logMobile({hypothesisId:'H3',location:'openSpotlight:item-not-found',message:'Item not found in allItems - EARLY RETURN',data:{itemId:item.id,itemType:item.type}});
      // #endregion agent log H3
      return;
    }
    // #region agent log H3
    logMobile({hypothesisId:'H3',location:'openSpotlight:item-found',message:'Item found, continuing to create spotlight',data:{itemIndex:itemIndex,itemId:item.id}});
    // #endregion agent log H3
    state.spotlight.currentIndex = itemIndex;

    // MOBILE DIRECT URL FIX: If no tile element OR skipAnimation requested, skip FLIP animation
    // and go directly to slide creation (same path as masonry taps, just without animation)
    if (!tile || skipAnimation || state.isDeepLinkMode) {
      logMobile({hypothesisId:'DIRECT_URL_FIX',location:'openSpotlight:skip-animation-path',message:'Skipping FLIP animation, creating slide directly',data:{hasTile:!!tile,skipAnimation,isDeepLinkMode:!!state.isDeepLinkMode,itemIndex}});
      
      // Create and show slide content immediately (no FLIP clone animation)
      const slide = createSpotlightSlide(state, item, itemIndex);
      
      // #region agent log
      // Hypothesis H9: Check slide dimensions calculation
      if (window.ABU_DEBUG === true) {
        console.log('[ABU_DEBUG] openSpotlight:slide-dimensions', {
          itemId: item.id,
          originalAspectRatio: item.originalAspectRatio || 'MISSING',
          width: item.width || 'MISSING',
          height: item.height || 'MISSING',
          slideStyleWidth: slide.style.width,
          slideStyleHeight: slide.style.height,
          slideStyleTop: slide.style.top,
          slideStyleLeft: slide.style.left,
          slideClientWidth: slide.clientWidth,
          slideClientHeight: slide.clientHeight
        });
      }
      // #endregion
      
      slide.classList.add('is-active');
      slide.dataset.offset = 0;
      slide.style.transform = 'translateX(0)';
      
      const content = createTileElement(item, state.templates, state, 'spotlight');
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      
      // #region agent log
      // Hypothesis H10: Check if inline styles are applied to content/tile element
      if (window.ABU_DEBUG === true) {
        const contentStyle = window.getComputedStyle(content);
        const img = content.querySelector('img');
        const imgStyle = img ? window.getComputedStyle(img) : null;
        console.log('[ABU_DEBUG] openSpotlight:content-after-styles', {
          itemId: item.id,
          contentClassName: content.className,
          contentStyleWidth: content.style.width,
          contentStyleHeight: content.style.height,
          contentComputedWidth: contentStyle.width,
          contentComputedHeight: contentStyle.height,
          contentClientWidth: content.clientWidth,
          contentClientHeight: content.clientHeight,
          imgStyleWidth: imgStyle ? imgStyle.width : 'NO IMG',
          imgStyleHeight: imgStyle ? imgStyle.height : 'NO IMG',
          imgClientWidth: img ? img.clientWidth : 'NO IMG',
          imgClientHeight: img ? img.clientHeight : 'NO IMG'
        });
      }
      // #endregion
      
      // TEMP DEBUG (Step C) - Log active slide media state after createTileElement
      if (window.ABU_DEBUG === true) {
        requestAnimationFrame(() => {
          const img = content.querySelector('img');
          const video = content.querySelector('video');
          const poster = content.querySelector('.abu-pg-spotlight-poster');
          
          // Hypothesis H6: Check if image is in the DOM tree and accessible
          if (img) {
            const imgRect = img.getBoundingClientRect();
            const imgStyle = window.getComputedStyle(img);
            const poster = content.querySelector('.abu-pg-spotlight-poster');
            const posterStyle = poster ? window.getComputedStyle(poster) : null;
            const tileHasReadyClass = content.classList.contains('is-image-ready');
            const tileHasPaintedClass = content.classList.contains('is-image-painted');
            
            console.log('[ABU_DEBUG] openSpotlight:image-geometry', {
              itemId: item.id,
              mode: 'direct-open',
              isConnected: img.isConnected,
              parentNode: img.parentNode ? img.parentNode.nodeName : 'NO PARENT',
              rectTop: imgRect.top,
              rectLeft: imgRect.left,
              rectWidth: imgRect.width,
              rectHeight: imgRect.height,
              rectBottom: imgRect.bottom,
              rectRight: imgRect.right,
              isInViewport: imgRect.top < window.innerHeight && imgRect.bottom > 0 && imgRect.left < window.innerWidth && imgRect.right > 0,
              transform: imgStyle.transform,
              zIndex: imgStyle.zIndex,
              pointerEvents: imgStyle.pointerEvents,
              hasPoster: !!poster,
              posterOpacity: posterStyle ? posterStyle.opacity : 'NO POSTER',
              posterZIndex: posterStyle ? posterStyle.zIndex : 'NO POSTER',
              posterSrc: poster ? poster.src || 'NO SRC' : 'NO POSTER',
              tileHasReadyClass,
              tileHasPaintedClass
            });
          }
          
          // Warn about mixed content / localhost issues
          const pageProtocol = window.location.protocol;
          const pageHost = window.location.hostname;
          const warnings = [];
          
          if (img && img.src) {
            const imgUrl = new URL(img.src, window.location.href);
            if (pageProtocol === 'https:' && imgUrl.protocol === 'http:') {
              warnings.push('Mixed content: HTTPS page loading HTTP image');
            }
            if (imgUrl.hostname === 'localhost' || imgUrl.hostname === '127.0.0.1') {
              warnings.push('Localhost image URL (may fail on iPhone tunnel)');
            }
            if (imgUrl.hostname !== pageHost) {
              warnings.push(`Cross-origin image: page=${pageHost}, img=${imgUrl.hostname}`);
            }
          }
          
          if (video && video.src) {
            const vidUrl = new URL(video.src, window.location.href);
            if (pageProtocol === 'https:' && vidUrl.protocol === 'http:') {
              warnings.push('Mixed content: HTTPS page loading HTTP video');
            }
            if (vidUrl.hostname === 'localhost' || vidUrl.hostname === '127.0.0.1') {
              warnings.push('Localhost video URL (may fail on iPhone tunnel)');
            }
            if (vidUrl.hostname !== pageHost) {
              warnings.push(`Cross-origin video: page=${pageHost}, vid=${vidUrl.hostname}`);
            }
          }
          
          console.log('[ABU_DEBUG] openSpotlight:active-slide-media', {
            mode: tile ? 'tap-open' : 'direct-open',
            itemId: item.id,
            hasImg: !!img,
            imgSrc: img ? img.src : 'N/A',
            imgDataSrc: img ? img.dataset.src || 'none' : 'N/A',
            imgCurrentSrc: img ? img.currentSrc || 'none' : 'N/A',
            hasVideo: !!video,
            videoSrc: video ? video.src : 'N/A',
            videoCurrentSrc: video ? video.currentSrc || 'none' : 'N/A',
            videoPoster: video ? video.poster || 'none' : 'N/A',
            hasPoster: !!poster,
            posterSrc: poster ? poster.src || 'none' : 'N/A',
            warnings: warnings.length > 0 ? warnings : 'none'
          });
        });
      }
      
      slide.appendChild(content);
      state.spotlight.carouselContainer.appendChild(slide);
      state.spotlight.loadedIndices.add(itemIndex);
      
      // #region agent log
      // Hypothesis H5: Check spotlight container dimensions
      if (window.ABU_DEBUG === true) {
        const spotlightEl = state.spotlight.overlay; // Fixed: use overlay, not element
        const carouselEl = state.spotlight.carouselContainer;
        const spotlightStyle = window.getComputedStyle(spotlightEl);
        const carouselStyle = window.getComputedStyle(carouselEl);
        const slideStyle = window.getComputedStyle(slide);
        const contentStyle = window.getComputedStyle(content);
        
        console.log('[ABU_DEBUG] openSpotlight:container-dimensions', {
          itemId: item.id,
          mode: 'direct-open',
          spotlightWidth: spotlightEl.clientWidth,
          spotlightHeight: spotlightEl.clientHeight,
          spotlightDisplay: spotlightStyle.display,
          spotlightOpacity: spotlightStyle.opacity,
          carouselWidth: carouselEl.clientWidth,
          carouselHeight: carouselEl.clientHeight,
          carouselDisplay: carouselStyle.display,
          slideWidth: slide.clientWidth,
          slideHeight: slide.clientHeight,
          slideDisplay: slideStyle.display,
          contentWidth: content.clientWidth,
          contentHeight: content.clientHeight,
          contentDisplay: contentStyle.display,
          contentPosition: contentStyle.position,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        });
      }
      // #endregion
      
      // FIX Step D: Ensure lazy-load hydration happens for direct-open spotlight
      // For direct-open (skipAnimation=true), images may have data-src but no src set
      // Hydrate active slide immediately so media is visible
      const img = content.querySelector('img');
      if (img) {
        if (img.dataset.src && !img.src) {
          // Lazy-load placeholder exists but not hydrated - fix it
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
            img.removeAttribute('data-srcset');
          }
          if (img.dataset.sizes) {
            img.sizes = img.dataset.sizes;
            img.removeAttribute('data-sizes');
          }
          
          if (window.ABU_DEBUG === true) {
            console.log('[ABU_DEBUG] openSpotlight:hydrate-image', {
              itemId: item.id,
              mode: 'direct-open-fix',
              hydratedSrc: img.src
            });
          }
        }
      }
      
      // Hydrate video if present
      const video = content.querySelector('video');
      if (video && !video.src) {
        const src360 = video.dataset.src360;
        const src720 = video.dataset.src720;
        const srcOriginal = video.dataset.srcOriginal;
        
        const bestSrc = src720 || src360 || srcOriginal;
        if (bestSrc) {
          const source = video.querySelector('source') || document.createElement('source');
          source.src = bestSrc;
          if (!source.parentNode) {
            video.appendChild(source);
          }
          video.load();
          
          if (window.ABU_DEBUG === true) {
            console.log('[ABU_DEBUG] openSpotlight:hydrate-video', {
              itemId: item.id,
              mode: 'direct-open-fix',
              hydratedSrc: bestSrc,
              hasPoster: !!video.poster
            });
          }
        }
      }
      
      // Show overlay immediately
      requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
        logMobile({hypothesisId:'DIRECT_URL_FIX',location:'openSpotlight:overlay-visible-no-anim',message:'Overlay visible (no animation mode)',data:{itemId:item.id}});
        
        // #region agent log
        // Hypothesis H7: Verify is-visible class was added
        if (window.ABU_DEBUG === true) {
          const overlayStyle = window.getComputedStyle(overlay);
          console.log('[ABU_DEBUG] openSpotlight:overlay-after-visible', {
            itemId: item.id,
            hasVisibleClass: overlay.classList.contains('is-visible'),
            overlayOpacity: overlayStyle.opacity,
            overlayPointerEvents: overlayStyle.pointerEvents,
            backdropBg: overlay.querySelector('.abu-pg-spotlight-backdrop') ? window.getComputedStyle(overlay.querySelector('.abu-pg-spotlight-backdrop')).background : 'NO BACKDROP'
          });
        }
        // #endregion
      });
      
      // Bind interactions
      bindSpotlightInteractions(content, item, state, true);
      
      // Preload adjacent tiles
      preloadAdjacentTiles(state);
      
      lockScroll(state);
      
      return; // Skip the normal FLIP animation flow below
    }
    
    // NORMAL MASONRY TAP PATH: Full FLIP animation (requires tile element)
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

    // FIX 2: For deep-link mode, skip the slow clone animation
    // Show spotlight content immediately instead of waiting for animation + image load (2+ seconds)
    if (state.isDeepLinkMode) {
      logDeepLinkTiming('skip_clone_animation_deep_link_mode');
      
      // IMPORTANT: Remove clone immediately - it will cover the real content
      if (clone && clone.parentElement) {
        clone.remove();
        state.spotlight.clone = null;
      }
      logDeepLinkTiming('clone_removed_immediate');
      
      // Create and show slide content immediately
      const slide = createSpotlightSlide(state, item, itemIndex);
      slide.classList.add('is-active');
      slide.dataset.offset = 0;
      slide.style.transform = 'translateX(0)';
      logDeepLinkTiming('spotlight_slide_created_immediate', { index: itemIndex });
      
      const content = createTileElement(item, state.templates, state, 'spotlight');
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      logDeepLinkTiming('tile_element_created_immediate', { type: item.type });
      
      slide.appendChild(content);
      carouselContainer.appendChild(slide);
      state.spotlight.loadedIndices.add(itemIndex);
      logDeepLinkTiming('slide_appended_immediate', { type: item.type });
      
      // Show overlay immediately
      requestAnimationFrame(() => {
        overlay.classList.add('is-visible');
        logDeepLinkTiming('spotlight_overlay_visible_immediate', { isDeepLink: true });
      });
      
      // Bind interactions
      bindSpotlightInteractions(content, item, state, true);
      logDeepLinkTiming('spotlight_interactions_bound_immediate', { type: item.type });
      
      // Preload adjacent tiles
      preloadAdjacentTiles(state);
      logDeepLinkTiming('adjacent_tiles_preload_started_immediate');
      
      return; // Skip the normal clone animation flow
    }

    const startAnimation = () => {
      logDeepLinkTiming('spotlight_animation_start', { isDeepLink: !!state.isDeepLinkMode });
      
      // FIX 1: For deep-link mode, delay overlay reveal until content is ready
      // Normal clicks still show overlay immediately for smooth transition
      if (!state.isDeepLinkMode) {
        overlay.classList.add('is-visible');
        logDeepLinkTiming('spotlight_overlay_visible_normal_mode', { isDeepLink: false });
        // #region agent log H1
        requestAnimationFrame(() => {
          const overlayStyles = window.getComputedStyle(overlay);
          logMobile({hypothesisId:'H1',location:'openSpotlight:after-visible-class',message:'Overlay after is-visible class added',data:{overlayOpacity:overlayStyles.opacity,overlayPointerEvents:overlayStyles.pointerEvents,overlayTransition:overlayStyles.transition,hasVisibleClass:overlay.classList.contains('is-visible')}});
        });
        // #endregion agent log H1
      } else {
        logDeepLinkTiming('spotlight_overlay_reveal_delayed', { isDeepLink: true });
      }
      
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
      logDeepLinkTiming('clone_animation_complete', { type: item.type });
      
      const slide = createSpotlightSlide(state, item, itemIndex);
      slide.classList.add('is-active');
      slide.dataset.offset = 0;
      slide.style.transform = 'translateX(0)';
      logDeepLinkTiming('spotlight_slide_created', { index: itemIndex });
      
      const content = createTileElement(item, state.templates, state, 'spotlight');
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      logDeepLinkTiming('tile_element_created', { type: item.type });
      
      slide.appendChild(content);
      carouselContainer.appendChild(slide);
      state.spotlight.loadedIndices.add(itemIndex);
      logDeepLinkTiming('slide_appended_to_dom', { type: item.type });
      
      // #region agent log H2-H4
      requestAnimationFrame(() => {
        const contentStyles = window.getComputedStyle(content);
        const img = content.querySelector('img');
        const imgStyles = img ? window.getComputedStyle(img) : null;
        logMobile({hypothesisId:'H2',location:'openSpotlight:slide-created',message:'Spotlight slide added to DOM',data:{slideInDOM:document.body.contains(slide),carouselChildren:carouselContainer.children.length,slideWidth:slide.clientWidth,slideHeight:slide.clientHeight,slideHasContent:slide.children.length>0,slideFirstChildClass:slide.children[0]?slide.children[0].className:'none',overlayHasVisibleClass:overlay.classList.contains('is-visible'),contentOpacity:contentStyles.opacity,contentVisibility:contentStyles.visibility,contentDisplay:contentStyles.display,contentWidth:content.clientWidth,contentHeight:content.clientHeight,hasImg:!!img,imgSrc:img?img.src||img.dataset.src||'':'',imgOpacity:imgStyles?imgStyles.opacity:'',imgVisibility:imgStyles?imgStyles.visibility:''}});
      });
      // #endregion agent log H2-H4
      
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
              logDeepLinkTiming('clone_hidden_image_ready', { naturalWidth: img.naturalWidth || 0 });
            });
          });
        };
        const cloneTarget = fullImage || preview;
        hideCloneWhenReady(cloneTarget, fullImage ? 'full' : 'preview');
      } else {
        // Video tile
        clone.style.opacity = '0';
        logDeepLinkTiming('clone_hidden_video', { type: item.type });
        setTimeout(() => {
          if (clone && clone.parentElement) {
            clone.remove();
            state.spotlight.clone = null;
          }
        }, 200);
      }
      bindSpotlightInteractions(content, item, state, true);
      logDeepLinkTiming('spotlight_interactions_bound', { type: item.type });
      
      preloadAdjacentTiles(state);
      logDeepLinkTiming('adjacent_tiles_preload_started');
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
        
        // #region agent log - image template created
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            location: 'gallery.js:2669',
            message: 'Image template created',
            data: {
              hasButtonContainer: !!templates.image.querySelector('.abu-pg-tile-button-container'),
              hasDownloadBtn: !!templates.image.querySelector('.abu-pg-download'),
              tileHtml: templates.image.outerHTML.substring(0, 500)
            },
            timestamp: Date.now(),
            sessionId: 'template-debug',
            runId: 'v4',
            hypothesisId: 'TEMPLATE_CREATE'
          })
        }).catch(() => {});
        // #endregion agent log
      }
      if (tile.dataset.type === 'video' && !templates.video) {
        templates.video = tile.cloneNode(true);
        
        // #region agent log - video template created
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            location: 'gallery.js:2672',
            message: 'Video template created',
            data: {
              hasButtonContainer: !!templates.video.querySelector('.abu-pg-tile-button-container'),
              hasDownloadBtn: !!templates.video.querySelector('.abu-pg-download'),
              hasMuteBtn: !!templates.video.querySelector('.abu-pg-mute'),
              tileHtml: templates.video.outerHTML.substring(0, 500)
            },
            timestamp: Date.now(),
            sessionId: 'template-debug',
            runId: 'v4',
            hypothesisId: 'TEMPLATE_CREATE'
          })
        }).catch(() => {});
        // #endregion agent log
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
        permalink: tile.dataset.permalink || '', // CLEAN BREAK: Canonical tile permalink
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
    // DEBUG: Log entry mode and item data shape
    if (window.ABU_DEBUG === true && context === 'spotlight') {
      console.log('[ABU_DEBUG] createTileElement:entry', {
        context,
        entryMode: item._entryMode || 'unknown', // Will be set by caller
        itemId: item.id,
        itemType: item.type,
        itemKeys: Object.keys(item),
        previewSrc: item.previewSrc || 'MISSING',
        gridUrl: item.gridUrl || 'MISSING',
        webUrl: item.webUrl || 'MISSING',
        url: item.url || 'MISSING',
        poster: item.poster || 'MISSING (video only)',
        warnings: []
      });
    }
    
    const template = item.type === 'video' ? templates.video : templates.image;
    const tile = template ? template.cloneNode(true) : document.createElement('div');
    
    // #region agent log - check clone immediately
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        location: 'gallery.js:2815',
        message: 'Tile cloned from template',
        data: {
          itemType: item.type,
          itemId: item.id,
          context,
          hasTemplate: !!template,
          clonedTileHasButtonContainer: !!tile.querySelector('.abu-pg-tile-button-container'),
          clonedTileHasDownloadBtn: !!tile.querySelector('.abu-pg-download'),
          templateHasButtonContainer: template ? !!template.querySelector('.abu-pg-tile-button-container') : false,
          templateHasDownloadBtn: template ? !!template.querySelector('.abu-pg-download') : false
        },
        timestamp: Date.now(),
        sessionId: 'clone-debug',
        runId: 'v4',
        hypothesisId: 'CLONE_CHECK'
      })
    }).catch(() => {});
    // #endregion agent log
    
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
      
      // TEMP DEBUG (Step C) - Log image URL selection
      if (window.ABU_DEBUG === true && isSpotlight) {
        console.log('[ABU_DEBUG] createTileElement:image-url-selection', {
          itemId: item.id,
          selectedUrl: imageUrl,
          webUrl: item.webUrl || 'none',
          url: item.url || 'none',
          willSetDataSrc: imageUrl ? 'yes' : 'NO - IMAGE WILL BE BLANK'
        });
      }
      
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
        // GOAL 2 FIX: Single-image pipeline for spotlight
        // Set src immediately - no 2-step preview/final system
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
        
        // Remove any existing poster elements (no 2-step loading)
        const existingPoster = tile.querySelector('.abu-pg-spotlight-poster');
        if (existingPoster) {
          existingPoster.remove();
        }
        
        // DEBUG: Log spotlight image setup
        if (window.ABU_DEBUG === true) {
          console.log('[ABU_DEBUG] createTileElement:spotlight-image-setup', {
            itemId: item.id,
            entryMode: item._entryMode || 'unknown',
            imageUrl: imageUrl || 'MISSING',
            imgSrc: img.src || 'none',
            imgCurrentSrc: img.currentSrc || 'none',
            imgComplete: img.complete,
            imgNaturalWidth: img.naturalWidth || 0,
            warning: !imageUrl ? 'NO IMAGE URL - WILL BE BLANK!' : null
          });
        }
        
        // Add loaded class immediately for consistent styling
        // Optional: add fade-in via CSS if desired, but image is always visible
        tile.classList.add('is-image-ready');
        tile.classList.add('is-image-painted');
        
        // Optional progressive enhancement: fade from transparent to opaque
        // This is purely visual polish, NOT gating visibility
        if (img.complete && img.naturalWidth > 0) {
          // Already loaded
          tile.dataset.abuReadyAt = String(performance.now());
        } else {
          // Wait for load to add fade effect (non-blocking)
          img.addEventListener('load', () => {
            tile.dataset.abuReadyAt = String(performance.now());
            
            if (window.ABU_DEBUG === true) {
              console.log('[ABU_DEBUG] createTileElement:image-loaded', {
                itemId: item.id,
                imgNaturalWidth: img.naturalWidth,
                imgNaturalHeight: img.naturalHeight
              });
            }
          }, { once: true });
          
          img.addEventListener('error', () => {
            if (window.ABU_DEBUG === true) {
              console.error('[ABU_DEBUG] createTileElement:image-error', {
                itemId: item.id,
                src: img.src,
                error: 'Image failed to load'
              });
            }
          }, { once: true });
        }
      }
      
      if (!isSpotlight) {
        // Grid mode: clean up any spotlight classes
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
      // #region agent log - download button found
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:3006',
          message: 'Download button found',
          data: {
            context,
            isSpotlight,
            isTouchDevice: state.isTouch,
            willRemove: !isSpotlight && state.isTouch,
            willShow: isSpotlight || !state.isTouch,
            itemType: item.type,
            itemId: item.id
          },
          timestamp: Date.now(),
          sessionId: 'button-debug',
          runId: 'v3',
          hypothesisId: 'BUTTON_FOUND'
        })
      }).catch(() => {});
      // #endregion agent log
      
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
    } else {
      // #region agent log - download button NOT found
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:3039',
          message: 'Download button NOT found',
          data: {
            context,
            isSpotlight,
            itemType: item.type,
            itemId: item.id,
            tileClasses: tile.className,
            hasButtonContainer: !!tile.querySelector('.abu-pg-tile-button-container')
          },
          timestamp: Date.now(),
          sessionId: 'button-debug',
          runId: 'v3',
          hypothesisId: 'BUTTON_MISSING'
        })
      }).catch(() => {});
      // #endregion agent log
    }

    const muteBtn = tile.querySelector('.abu-pg-mute');
    if (muteBtn && state.isTouch && !isSpotlight) {
      muteBtn.remove();
    }

    // Ensure button container exists for mobile spotlight
    if (state.isTouch && isSpotlight) {
      let buttonContainer = tile.querySelector('.abu-pg-tile-button-container');
      
      // Create container if it doesn't exist
      if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'abu-pg-tile-button-container';
        tile.appendChild(buttonContainer);
      }
      
      // Handle save button
      const existingSave = tile.querySelector('.abu-pg-save');
      if (!existingSave) {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'abu-pg-save';
        buttonContainer.appendChild(saveBtn);
      } else if (existingSave.parentElement !== buttonContainer) {
        // Move to container if not already there
        buttonContainer.appendChild(existingSave);
      }
      
      // Move mute button to container if it exists and not already there
      if (muteBtn && muteBtn.parentElement !== buttonContainer) {
        buttonContainer.appendChild(muteBtn);
      }
      
      // Handle save button contents and auth gating
      const spotlightSave = buttonContainer.querySelector('.abu-pg-save');
      if (spotlightSave) {
        ensureSaveButtonContents(spotlightSave);
        
        // Hide share button if user is not logged in
        const isLoggedIn = window.abuPgConfig && window.abuPgConfig.isLoggedIn;
        if (!isLoggedIn) {
          spotlightSave.style.display = 'none';
        }
      }
    } else {
      // Non-spotlight: handle save button removal
      const existingSave = tile.querySelector('.abu-pg-save');
      if (state.isTouch) {
        if (existingSave) {
          existingSave.remove();
        }
      } else if (existingSave) {
        existingSave.remove();
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
  
  /**
   * Load comments for a tile via AJAX
   */
  const loadComments = async (tileId, commentsList) => {
    try {
      const response = await fetch(`${window.abuPgConfig.ajaxUrl}?action=abu_pg_load_tile_comments&tile_id=${tileId}`);
      const data = await response.json();
      
      if (data.success && data.data.comments) {
        commentsList.innerHTML = '';
        data.data.comments.forEach(comment => {
          addCommentToList(commentsList, comment);
        });
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };
  
  /**
   * Add a single comment to the comments list
   */
  const addCommentToList = (commentsList, comment) => {
    const commentEl = document.createElement('div');
    commentEl.className = 'abu-pg-comment';
    commentEl.dataset.commentId = comment.id;
    
    // Left cluster: avatar + text block
    const leftCluster = document.createElement('div');
    leftCluster.className = 'abu-pg-comment-left';
    
    // Avatar (circular with initials)
    const avatarEl = document.createElement('div');
    avatarEl.className = 'abu-pg-comment-avatar';
    const initials = comment.author ? comment.author.charAt(0).toUpperCase() : '?';
    avatarEl.textContent = initials;
    
    // Text block
    const textBlock = document.createElement('div');
    textBlock.className = 'abu-pg-comment-text-block';
    
    // Line 1: Name + Comment (same baseline)
    const nameLine = document.createElement('div');
    nameLine.className = 'abu-pg-comment-name-line';
    
    const authorEl = document.createElement('span');
    authorEl.className = 'abu-pg-comment-author';
    authorEl.textContent = comment.author;
    
    const contentEl = document.createElement('span');
    contentEl.className = 'abu-pg-comment-content';
    contentEl.textContent = comment.content;
    
    nameLine.appendChild(authorEl);
    nameLine.appendChild(contentEl);
    
    // Line 2: Timestamp + Ellipsis
    const metaLine = document.createElement('div');
    metaLine.className = 'abu-pg-comment-meta-line';
    
    const dateEl = document.createElement('span');
    dateEl.className = 'abu-pg-comment-date';
    dateEl.textContent = formatCommentDate(comment.date);
    
    metaLine.appendChild(dateEl);
    
    // Only show actions ellipsis if this is the current user's comment
    const currentUserId = window.abuPgConfig && window.abuPgConfig.currentUserId ? parseInt(window.abuPgConfig.currentUserId, 10) : 0;
    const commentUserId = comment.userId || 0;
    
    if (currentUserId > 0 && currentUserId === commentUserId) {
      const actionsEl = document.createElement('button');
      actionsEl.type = 'button';
      actionsEl.className = 'abu-pg-comment-actions';
      actionsEl.title = 'Comment options';
      actionsEl.setAttribute('aria-label', 'Comment options');
      
      // Use dots-horizontal icon from Radix
      const iconTemplate = document.querySelector('.abu-pg-icon-template[data-icon="dots-horizontal"]');
      if (iconTemplate) {
        actionsEl.innerHTML = iconTemplate.innerHTML;
      } else {
        actionsEl.textContent = '…'; // Fallback to text if icon not loaded
      }
      
      // Track delete mode state
      let isDeleteMode = false;
      
      // Click handler for toggling delete mode
      const handleActionsClick = (e) => {
        e.stopPropagation();
        
        if (!isDeleteMode) {
          // Enter delete mode
          isDeleteMode = true;
          actionsEl.classList.add('is-delete-mode');
          actionsEl.innerHTML = '<span class="abu-pg-comment-actions-delete">Delete</span>';
          actionsEl.setAttribute('aria-label', 'Delete comment');
          
          // Add outside click handler to cancel
          setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscapeKey);
          }, 0);
        } else {
          // Execute delete
          deleteComment(comment.id, commentEl, actionsEl);
        }
      };
      
      // Cancel delete mode on outside click
      const handleOutsideClick = (e) => {
        if (!actionsEl.contains(e.target) && isDeleteMode) {
          restoreDotsUI();
        }
      };
      
      // Cancel delete mode on Escape key
      const handleEscapeKey = (e) => {
        if (e.key === 'Escape' && isDeleteMode) {
          restoreDotsUI();
        }
      };
      
      // Restore dots UI
      const restoreDotsUI = () => {
        isDeleteMode = false;
        actionsEl.classList.remove('is-delete-mode');
        if (iconTemplate) {
          actionsEl.innerHTML = iconTemplate.innerHTML;
        } else {
          actionsEl.textContent = '…';
        }
        actionsEl.setAttribute('aria-label', 'Comment options');
        
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleEscapeKey);
      };
      
      // Delete comment function
      const deleteComment = async (commentId, commentElement, actionsButton) => {
        try {
          const formData = new FormData();
          formData.append('action', 'abu_pg_delete_comment');
          formData.append('nonce', window.abuPgConfig.nonce);
          formData.append('comment_id', commentId);
          
          const response = await fetch(window.abuPgConfig.ajaxUrl, {
            method: 'POST',
            body: formData
          });
          
          const data = await response.json();
          
          if (data.success) {
            // Remove comment from DOM with fade-out animation
            commentElement.style.opacity = '0';
            commentElement.style.transform = 'translateY(-10px)';
            commentElement.style.transition = 'opacity 200ms ease, transform 200ms ease';
            
            setTimeout(() => {
              commentElement.remove();
            }, 200);
          } else {
            // Restore dots UI on failure
            restoreDotsUI();
            console.error('Failed to delete comment:', data.data?.message || 'Unknown error');
            alert('Failed to delete comment. Please try again.');
          }
        } catch (error) {
          // Restore dots UI on error
          restoreDotsUI();
          console.error('Comment deletion error:', error);
          alert('An error occurred while deleting the comment.');
        }
      };
      
      actionsEl.addEventListener('click', handleActionsClick);
      metaLine.appendChild(actionsEl);
    }
    
    textBlock.appendChild(nameLine);
    textBlock.appendChild(metaLine);
    
    leftCluster.appendChild(avatarEl);
    leftCluster.appendChild(textBlock);
    
    commentEl.appendChild(leftCluster);
    
    // Prepend new comments to show them at the top
    if (commentsList.firstChild) {
      commentsList.insertBefore(commentEl, commentsList.firstChild);
    } else {
      commentsList.appendChild(commentEl);
    }
    
    // Add fade-in animation for new comments
    commentEl.style.opacity = '0';
    commentEl.style.transform = 'translateY(-10px)';
    commentEl.style.transition = 'opacity 300ms ease, transform 300ms ease';
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        commentEl.style.opacity = '1';
        commentEl.style.transform = 'translateY(0)';
      });
    });
  };
  
  /**
   * Format comment date to display format
   * Displays "Feb 5" for current year, "Feb 5 2025" for previous years
   */
  const formatCommentDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Format month and day
    const options = { month: 'short', day: 'numeric' };
    let formattedDate = date.toLocaleDateString('en-US', options);
    
    // Add year if not current year
    if (date.getFullYear() !== now.getFullYear()) {
      formattedDate += ' ' + date.getFullYear();
    }
    
    return formattedDate;
  };
  
  const renderDesktopSpotlightMedia = (state, item) => {
    const { leftColumn, container } = state.desktopSpotlight;
    leftColumn.innerHTML = '';
    
    if (!item || !item.type) {
      console.error('Invalid item passed to renderDesktopSpotlightMedia:', item);
      return;
    }
    
    // Back button - append to container (not leftColumn) for proper positioning
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'abu-pg-desktop-spotlight-back-btn yp-icon-button';
    if (state.iconTemplates.back) {
      backBtn.innerHTML = state.iconTemplates.back;
    }
    
    // Remove any existing back button first (for SPA navigation)
    const existingBackBtn = container.querySelector('.abu-pg-desktop-spotlight-back-btn');
    if (existingBackBtn) {
      existingBackBtn.remove();
    }
    
    // Append to container, not leftColumn
    container.appendChild(backBtn);
    
    // #region agent log - back button created
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:3487',message:'Back button created and appended',data:{hasIconContent:!!state.iconTemplates.back,buttonInnerHTML:backBtn.innerHTML.substring(0,50),containerPosition:getComputedStyle(container).position},timestamp:Date.now(),sessionId:'back-button-debug',runId:'v11',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion agent log
    
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
      
      // For deep links, video starts muted (browser policy), so set button state accordingly
      const isDeepLinkMode = state.isDeepLink || false;
      muteBtn.setAttribute('aria-pressed', isDeepLinkMode ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', isDeepLinkMode ? 'Unmute' : 'Mute');
      
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
    
    // Gate buttons based on login state
    const isLoggedIn = window.abuPgConfig && window.abuPgConfig.isLoggedIn;
    
    // Show/hide download button based on auth state
    if (saveBtn) {
      saveBtn.style.display = isLoggedIn ? '' : 'none';
    }
    
    // Show/hide share button based on auth state
    if (shareBtn) {
      shareBtn.style.display = isLoggedIn ? '' : 'none';
    }
    
    // Add login prompt to like button if not logged in
    if (likeBtn) {
      if (!isLoggedIn) {
        likeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (window.abuPgConfig && window.abuPgConfig.loginUrl) {
            window.location.href = window.abuPgConfig.loginUrl;
          }
        });
      }
    }
    
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
      
      // For deep links, start muted to allow autoplay (browser policy)
      // For normal gallery clicks, start unmuted (user interaction allows it)
      const isDeepLinkMode = state.isDeepLink || false;
      video.volume = isDeepLinkMode ? 0 : 1;
      video.muted = isDeepLinkMode;
      
      const posterUrl = item.poster || '';
      if (posterUrl) {
        const posterImg = document.createElement('img');
        posterImg.className = 'abu-pg-desktop-spotlight-poster';
        posterImg.src = posterUrl;
        posterImg.style.position = 'absolute';
        posterImg.style.top = '50%';
        posterImg.style.left = '50%';
        posterImg.style.transform = 'translate(-50%, -50%)';
        posterImg.style.maxWidth = '80%';
        posterImg.style.maxHeight = '80%';
        posterImg.style.width = 'auto';
        posterImg.style.height = 'auto';
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
    
    // Add comment section inside mediaContainer (below the media, inside grey border)
    const commentSection = document.createElement('div');
    commentSection.className = 'abu-pg-spotlight-comments';
    
    // Comments list (initially empty, loaded on demand)
    const commentsList = document.createElement('div');
    commentsList.className = 'abu-pg-spotlight-comments-list';
    commentSection.appendChild(commentsList);
    
    // Comment input bar (pill-shaped)
    const commentBar = document.createElement('div');
    commentBar.className = 'abu-pg-spotlight-comment-bar';
    
    // Reuse isLoggedIn from above (already declared at line 2545)
    
    if (!isLoggedIn) {
      commentBar.classList.add('logged-out');
    }
    
    const commentInput = document.createElement('input');
    commentInput.type = 'text';
    commentInput.placeholder = isLoggedIn ? 'Add a comment' : 'Log in to comment';
    commentInput.readOnly = !isLoggedIn;
    
    if (!isLoggedIn) {
      commentInput.addEventListener('click', (event) => {
        event.preventDefault();
        if (window.abuPgConfig && window.abuPgConfig.loginUrl) {
          window.location.href = window.abuPgConfig.loginUrl;
        }
      });
    }
    
    commentBar.appendChild(commentInput);
    
    // Send button (circular, embedded in input)
    if (isLoggedIn) {
      const sendBtn = document.createElement('button');
      sendBtn.type = 'button';
      sendBtn.className = 'abu-pg-comment-send-btn';
      sendBtn.setAttribute('aria-label', 'Send comment');
      if (state.iconTemplates.paperPlane) {
        sendBtn.innerHTML = state.iconTemplates.paperPlane;
      }
      commentBar.appendChild(sendBtn);
      
      // Shared comment submission function
      const submitComment = async () => {
        const commentText = commentInput.value.trim();
        if (!commentText) return;
        
        // Show loading state
        commentInput.disabled = true;
        sendBtn.disabled = true;
        const originalPlaceholder = commentInput.placeholder;
        commentInput.placeholder = 'Sending...';
        
        try {
          const response = await fetch(window.abuPgConfig.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              action: 'abu_pg_submit_comment',
              nonce: window.abuPgConfig.nonce,
              tile_id: item.id,
              comment: commentText
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            // Clear input
            commentInput.value = '';
            // Add comment to list
            addCommentToList(commentsList, data.data.comment);
          } else {
            alert(data.data.message || 'Failed to submit comment');
          }
        } catch (error) {
          console.error('Comment submission error:', error);
          alert('Failed to submit comment');
        } finally {
          commentInput.disabled = false;
          sendBtn.disabled = false;
          commentInput.placeholder = originalPlaceholder;
        }
      };
      
      // Click handler for send button
      sendBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await submitComment();
      });
      
      // Enter key handler for input
      commentInput.addEventListener('keypress', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          await submitComment();
        }
      });
    }
    
    commentSection.appendChild(commentBar);
    
    mediaContainer.appendChild(commentSection);
    
    leftColumn.appendChild(mediaContainer);
    
    // Load existing comments when spotlight opens
    loadComments(item.id, commentsList);
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
        
        // #region agent log
        // Hypothesis A: Track if click handler fires
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:2753',message:'Right column tile clicked',data:{clickedTileId:item.id,hasPermalink:!!item.permalink,hasKitContext:!!state.kitContext,kitId:state.kitContext?.kitId},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // PHASE 3: Use SPA navigation instead of full page reload
        logNav('Right Column Tile Click', {
          clickedTileId: item.id,
          hasPermalink: !!item.permalink,
          permalink: item.permalink
        });
        
        // Extract kit ID from state
        const kitId = state.kitContext?.kitId;
        
        if (item.permalink && kitId) {
          // SPA navigation: no page reload
          navigateToTile(item.id, item.permalink, kitId);
        } else if (item.permalink) {
          // #region agent log
          // Hypothesis A: Track fallback to full navigation
          fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:2775',message:'Fallback to full navigation (no kitId)',data:{tileId:item.id,permalink:item.permalink},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          window.location.href = item.permalink;
        } else {
          // Fallback: switch media in current spotlight if no permalink
          switchDesktopSpotlightMedia(state, item);
        }
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
    
    // Update URL with new item parameter (unless this is from a popstate event or initial load)
    if (typeof URLStateManager !== 'undefined' && 
        !URLStateManager.isPopStateUpdate() && 
        !URLStateManager.isInitialLoad()) {
      URLStateManager.setOpenItem(newItem.id);
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
    
    // Update URL to tile permalink (unless this is from a popstate event or initial load)
    // CLEAN BREAK: Navigate to tile permalink instead of query param
    if (typeof URLStateManager !== 'undefined' && 
        !URLStateManager.isPopStateUpdate() && 
        !URLStateManager.isInitialLoad() &&
        item.permalink) {
      // Store kit base URL before navigating to tile
      URLStateManager.storeKitBaseURL();
      
      // Get kit ID from gallery wrapper
      const kitId = state.container.closest('.abu-pg-chapters-wrapper')?.dataset.postId;
      URLStateManager.setOpenTile(item.permalink, kitId);
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
    
    // #region agent log - check gallery on close
    const mainGallery = document.querySelector('.abu-pg-chapters-wrapper');
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4098',message:'Closing desktop spotlight',data:{mainGalleryExists:!!mainGallery,mainGalleryVisible:mainGallery ? getComputedStyle(mainGallery).display !== 'none' : false,tileCount:mainGallery ? mainGallery.querySelectorAll('.abu-pg-tile').length : 0},timestamp:Date.now(),sessionId:'close-debug',runId:'v11',hypothesisId:'GALLERY_CHECK'})}).catch(()=>{});
    // #endregion agent log
    
    // Restore kit base URL (unless this is from a popstate event or initial load)
    // CLEAN BREAK: Return to kit URL instead of removing query param
    if (typeof URLStateManager !== 'undefined' && 
        !URLStateManager.isPopStateUpdate() && 
        !URLStateManager.isInitialLoad()) {
      URLStateManager.clearOpenTile();
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
      const useMobileLayout = shouldUseMobileLayout();
      
      if (!useMobileLayout) {
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

    const useMobileLayout = shouldUseMobileLayout();
    
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (hasHover && useMobileLayout) {
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
    } else if (hasHover && !useMobileLayout) {
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
      
      const useMobileLayout = shouldUseMobileLayout();
      
      if (!useMobileLayout) {
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
    
    // Cache templates in GalleryStateManager for reuse across spotlights
    // #region agent log - cache templates
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4398',message:'Caching templates in initGallery',data:{hasTemplates:!!state.templates,hasImage:!!state.templates?.image,hasVideo:!!state.templates?.video,willCache:!!(state.templates && (state.templates.image || state.templates.video)),cacheAlreadyExists:!!(GalleryStateManager.tileTemplates && (GalleryStateManager.tileTemplates.image || GalleryStateManager.tileTemplates.video))},timestamp:Date.now(),sessionId:'template-cache-debug',runId:'v10',hypothesisId:'H2_CACHE'})}).catch(()=>{});
    // #endregion agent log
    // Only cache if we have valid templates AND the cache is empty (first gallery wins)
    if (state.templates && (state.templates.image || state.templates.video)) {
      if (!GalleryStateManager.tileTemplates || (!GalleryStateManager.tileTemplates.image && !GalleryStateManager.tileTemplates.video)) {
        GalleryStateManager.tileTemplates = state.templates;
        // #region agent log - cached confirmation
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4399',message:'Templates cached successfully',data:{cachedImage:!!GalleryStateManager.tileTemplates.image,cachedVideo:!!GalleryStateManager.tileTemplates.video},timestamp:Date.now(),sessionId:'template-cache-debug',runId:'v10',hypothesisId:'H2_CACHE'})}).catch(()=>{});
        // #endregion agent log
      }
    }

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
    
    const paperPlaneTemplate = document.querySelector('.abu-pg-icon-template[data-icon="paper-plane"]');
    if (paperPlaneTemplate) {
      state.iconTemplates.paperPlane = paperPlaneTemplate.innerHTML;
    }
    
    const dotsHorizontalTemplate = document.querySelector('.abu-pg-icon-template[data-icon="dots-horizontal"]');
    if (dotsHorizontalTemplate) {
      state.iconTemplates.dotsHorizontal = dotsHorizontalTemplate.innerHTML;
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

  /**
   * Initialize direct item mode (query parameter deep-linking)
   * Opens spotlight immediately, then loads gallery in background
   */
  const initDirectMode = () => {
    console.log('[DEBUG] initDirectMode CALLED');
    
    const directContainer = document.querySelector('.abu-pg-direct-mode');
    console.log('[DEBUG] directContainer:', directContainer);
    
    if (!directContainer) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'direct-mode-detection',hypothesisId:'M',location:'gallery.js:3344',message:'initDirectMode - no container found',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      return false;
    }
    
    console.log('[DEBUG] Direct container FOUND, itemId:', directContainer.dataset.itemId);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'direct-mode-detection',hypothesisId:'N',location:'gallery.js:3353',message:'initDirectMode - container found',data:{itemId:directContainer.dataset.itemId,chapterSlug:directContainer.dataset.chapterSlug},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    
    const itemId = directContainer.dataset.itemId;
    const chapterSlug = directContainer.dataset.chapterSlug;
    const chapterName = directContainer.dataset.chapterName;
    
    console.log(`[Direct Mode] Initializing for item ${itemId} in chapter ${chapterSlug}`);
    
    // Show spotlight immediately (already rendered by PHP)
    const spotlightDirect = directContainer.querySelector('.abu-pg-spotlight-direct');
    console.log('[DEBUG] spotlightDirect element:', spotlightDirect);
    
    if (spotlightDirect) {
      console.log('[DEBUG] About to add is-visible class');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'direct-mode-detection',hypothesisId:'O',location:'gallery.js:3370',message:'Found spotlight-direct element',data:{hasIsVisibleClass:spotlightDirect.classList.contains('is-visible')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      
      // Initialize main tile in spotlight left column
      const mainTile = spotlightDirect.querySelector('.abu-pg-spotlight-left .abu-pg-tile');
      if (mainTile) {
        initSpotlightTile(mainTile);
      }
      
      requestAnimationFrame(() => {
        spotlightDirect.classList.add('is-visible');
        console.log('[DEBUG] is-visible class ADDED. classList:', spotlightDirect.className);
        console.log('[DEBUG] computed opacity:', window.getComputedStyle(spotlightDirect).opacity);
        console.log('[DEBUG] computed zIndex:', window.getComputedStyle(spotlightDirect).zIndex);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'direct-mode-detection',hypothesisId:'P',location:'gallery.js:3385',message:'Added is-visible class',data:{classListAfter:spotlightDirect.className,computedDisplay:window.getComputedStyle(spotlightDirect).display,computedOpacity:window.getComputedStyle(spotlightDirect).opacity,computedZIndex:window.getComputedStyle(spotlightDirect).zIndex},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
      });
      
      // Bind back button
      const backButton = spotlightDirect.querySelector('.abu-pg-spotlight-back');
      if (backButton) {
        backButton.addEventListener('click', () => {
          closeDirectSpotlight(directContainer, chapterSlug);
        });
      }
      
      // Initialize desktop spotlight grid interactions if present
      const rightColumn = spotlightDirect.querySelector('.abu-pg-spotlight-right');
      if (rightColumn) {
        const tiles = rightColumn.querySelectorAll('.abu-pg-tile');
        tiles.forEach(tile => {
          // Load grid images for right column
          initGridTile(tile);
          
          // Simple click handler - could be enhanced later
          tile.addEventListener('click', (e) => {
            if (e.target && e.target.closest('button')) {
              return;
            }
            const clickedItemId = tile.dataset.id;
            if (clickedItemId && clickedItemId !== itemId) {
              // Navigate to clicked item
              window.location.href = `?item=${clickedItemId}`;
            }
          });
        });
      }
    }
    
    // Load gallery in background after short delay
    setTimeout(() => {
      initBackgroundGallery(directContainer, chapterSlug);
    }, 500);
    
    return true;
  };
  
  /**
   * Initialize a tile in spotlight mode (load high-res web image)
   */
  const initSpotlightTile = (tile) => {
    const img = tile.querySelector('.abu-pg-image');
    if (img) {
      // Use web URL (high-res) for spotlight
      const webUrl = tile.dataset.webUrl;
      if (webUrl) {
        img.src = webUrl;
        img.removeAttribute('data-src');
        // Remove srcset to prevent loading grid variants
        img.removeAttribute('srcset');
        img.removeAttribute('data-srcset');
      }
    }
    
    const video = tile.querySelector('.abu-pg-video');
    if (video) {
      // Initialize video for spotlight
      const src720 = tile.dataset.src720 || video.dataset.src720;
      if (src720) {
        video.src = src720;
        video.load();
      }
    }
  };
  
  /**
   * Initialize a tile in grid mode (load grid image)
   */
  const initGridTile = (tile) => {
    const img = tile.querySelector('.abu-pg-image');
    if (img) {
      const gridUrl = tile.dataset.gridUrl || img.dataset.src;
      if (gridUrl) {
        img.src = gridUrl;
        img.removeAttribute('data-src');
        
        // Apply srcset if available
        const gridSrcset = tile.dataset.gridSrcset || img.dataset.srcset;
        if (gridSrcset) {
          img.srcset = gridSrcset;
          img.removeAttribute('data-srcset');
        }
      }
    }
  };
  
  /**
   * Initialize gallery in background (hidden) for direct mode
   */
  const initBackgroundGallery = (directContainer, targetChapterSlug) => {
    const galleryContainer = directContainer.querySelector('.abu-pg-background-gallery');
    if (!galleryContainer) {
      console.warn('[Direct Mode] Background gallery container not found');
      return;
    }
    
    console.log('[Direct Mode] Initializing background gallery...');
    
    // Gallery is already hidden by CSS (.abu-pg-background-gallery)
    // No need to modify styles - visibility:hidden keeps layout flow intact
    
    // Small delay to ensure DOM is fully ready for measurements
    requestAnimationFrame(() => {
      // Initialize all galleries
      const galleries = Array.from(galleryContainer.querySelectorAll('.abu-pg-gallery'));
      const galleryInstances = [];
      
      galleries.forEach((gallery) => {
        const instance = initGallery(gallery);
        galleryInstances.push(instance);
      });
      
      // Initialize URL state manager with gallery instances (needed for back button functionality)
      if (typeof URLStateManager !== 'undefined' && galleryInstances.length > 0) {
        URLStateManager.init(galleryInstances);
        window.URLStateManager = URLStateManager;
      }
      
      // Mark as ready
      window.galleryBackgroundReady = true;
      window.targetChapterSlug = targetChapterSlug;
      window.backgroundGalleryInstances = galleryInstances;
      
      console.log('[Direct Mode] Background gallery ready', {
        instanceCount: galleryInstances.length,
        targetChapter: targetChapterSlug
      });
    });
  };
  
  /**
   * Close direct spotlight and reveal gallery
   */
  const closeDirectSpotlight = (directContainer, chapterSlug) => {
    const spotlight = directContainer.querySelector('.abu-pg-spotlight-direct');
    const gallery = directContainer.querySelector('.abu-pg-background-gallery');
    
    if (!window.galleryBackgroundReady) {
      console.log('[Direct Mode] Gallery not ready yet, loading...');
      // Show loading state while gallery initializes
      spotlight.style.opacity = '0.5';
      
      // Wait for gallery to be ready
      const checkReady = setInterval(() => {
        if (window.galleryBackgroundReady) {
          clearInterval(checkReady);
          revealGallery(directContainer, spotlight, gallery, chapterSlug);
        }
      }, 100);
      
      return;
    }
    
    revealGallery(directContainer, spotlight, gallery, chapterSlug);
  };
  
  /**
   * Reveal gallery and scroll to chapter
   */
  const revealGallery = (directContainer, spotlight, gallery, chapterSlug) => {
    console.log('[Direct Mode] Revealing gallery at chapter:', chapterSlug);
    
    // Fade out spotlight
    spotlight.style.transition = 'opacity 300ms ease';
    spotlight.style.opacity = '0';
    
    setTimeout(() => {
      // Hide spotlight completely
      spotlight.style.display = 'none';
      
      // Show gallery - add is-visible class to trigger CSS transition
      gallery.classList.add('is-visible');
      
      // Initialize chapter navigation now that gallery is visible
      requestAnimationFrame(() => {
        initChapterNavigation(gallery);
        
        // Scroll to target chapter
        const targetSection = gallery.querySelector(`.abu-pg-chapter-section[data-chapter-slug="${chapterSlug}"]`);
        if (targetSection) {
          const nav = gallery.querySelector('.abu-pg-chapters-nav');
          const navHeight = nav ? nav.offsetHeight : 0;
          const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
          
          console.log('[Direct Mode] Scrolling to chapter section', {
            chapterSlug,
            navHeight,
            targetPosition
          });
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
        
        // Update URL (remove item param, keep chapter)
        if (typeof URLStateManager !== 'undefined') {
          URLStateManager.updateURL({ openTileId: null, chapterSlug: chapterSlug }, true);
        }
      });
    }, 300);
  };
  
  /**
   * Initialize chapter navigation for revealed gallery
   */
  const initChapterNavigation = (galleryContainer) => {
    const wrapper = galleryContainer.querySelector('.abu-pg-chapters-wrapper');
    if (!wrapper) return;
    
    console.log('[Direct Mode] Initializing chapter navigation for revealed gallery');
    
    // Initialize smooth scroll
    const nav = wrapper.querySelector('.abu-pg-chapters-nav');
    if (nav) {
      const navHeight = nav.offsetHeight;
      const links = nav.querySelectorAll('.abu-pg-chapter-link');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      links.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          
          const targetId = link.getAttribute('href');
          const targetSection = wrapper.querySelector(targetId);
          
          if (!targetSection) return;
          
          const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
          });
        });
      });
    }
    
    // Initialize active chapter highlighting
    const sections = wrapper.querySelectorAll('.abu-pg-chapter-section');
    const links = wrapper.querySelectorAll('.abu-pg-chapter-link');
    
    if (nav && sections.length > 0 && links.length > 0) {
      const navHeight = nav.offsetHeight;
      
      const linkMap = {};
      links.forEach(link => {
        const chapterSlug = link.getAttribute('data-chapter-slug');
        if (chapterSlug) {
          linkMap[chapterSlug] = link;
        }
      });
      
      const observerOptions = {
        root: null,
        rootMargin: `-${navHeight}px 0px -50% 0px`,
        threshold: 0
      };
      
      let currentActiveSlug = null;
      
      const observer = new IntersectionObserver((entries) => {
        let newActiveSlug = null;
        
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionSlug = entry.target.getAttribute('data-chapter-slug');
            if (!newActiveSlug || entry.target.getBoundingClientRect().top < 
                document.querySelector(`[data-chapter-slug="${newActiveSlug}"]`).getBoundingClientRect().top) {
              newActiveSlug = sectionSlug;
            }
          }
        });
        
        if (newActiveSlug && newActiveSlug !== currentActiveSlug) {
          currentActiveSlug = newActiveSlug;
          
          links.forEach(link => link.classList.remove('is-active'));
          
          if (linkMap[newActiveSlug]) {
            linkMap[newActiveSlug].classList.add('is-active');
          }
          
          if (typeof window.URLStateManager !== 'undefined' && 
              !window.URLStateManager.isInitialLoad()) {
            window.URLStateManager.setChapter(newActiveSlug);
          }
        }
      }, observerOptions);
      
      sections.forEach(section => observer.observe(section));
      
      if (sections.length > 0) {
        const firstChapterSlug = sections[0].getAttribute('data-chapter-slug');
        if (linkMap[firstChapterSlug]) {
          linkMap[firstChapterSlug].classList.add('is-active');
          currentActiveSlug = firstChapterSlug;
        }
      }
    }
  };

  /**
   * ========================================
   * Deep Link Spotlight Opener
   * ========================================
   * 
   * Opens Spotlight immediately from tile data (no DOM dependency)
   * Used for deep linking when ?abu_pg_tile=X parameter is present
   * 
   * STRATEGY: Create a minimal state object and reuse the existing spotlight functions
   */
  const openSpotlightFromDeepLink = (tileData) => {
    console.log('[Deep Link] Opening Spotlight for tile:', tileData.id);
    
    // Determine if we should use desktop or mobile spotlight
    const useMobileLayout = shouldUseMobileLayout();
    
    if (!useMobileLayout) {
      openDesktopSpotlightFromDeepLinkData(tileData);
    } else {
      openMobileSpotlightFromData(tileData);
    }
  };
  
  /**
   * Open desktop spotlight from deep link tile data
   * 
   * STRATEGY: Create a minimal state object that mimics the gallery state,
   * then call the EXISTING createDesktopSpotlight, renderDesktopSpotlightMedia,
   * and renderDesktopSpotlightRightColumn functions.
   * 
   * This ensures 100% identical behavior to the regular spotlight.
   */
  const openDesktopSpotlightFromDeepLinkData = (tileData) => {
    console.log('[Deep Link] Creating minimal state for desktop spotlight');
    
    // Collect icon templates from DOM
    const getIconTemplate = (iconName) => {
      const template = document.querySelector(`.abu-pg-icon-template[data-icon="${iconName}"]`);
      return template ? template.innerHTML : '';
    };
    
    // Convert tileData to item format expected by existing spotlight code
    const item = {
      id: tileData.id,
      type: tileData.type,
      url: tileData.url,
      title: tileData.title || '',
      filename: tileData.filename || '',
      created: tileData.created || '',
      width: tileData.width || 0,
      height: tileData.height || 0,
      masonryAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
    };
    
    // Add image-specific fields
    if (tileData.type === 'image') {
      item.gridUrl = tileData.gridUrl || tileData.url;
      item.webUrl = tileData.webUrl || tileData.url;
      item.originalUrl = tileData.originalUrl || tileData.url;
      item.previewSrc = tileData.previewSrc || tileData.gridUrl || tileData.url;
    }
    
    // Add video-specific fields
    if (tileData.type === 'video') {
      item.src360 = tileData.src360 || '';
      item.src720 = tileData.src720 || '';
      item.srcOriginal = tileData.srcOriginal || tileData.url;
      item.poster = tileData.poster || '';
    }
    
    // Convert adjacent tiles to item format
    const adjacentItems = (tileData.adjacentTiles || []).map(adjTile => {
      const adjItem = {
        id: adjTile.id,
        type: adjTile.type,
        url: adjTile.url,
        title: adjTile.title || '',
        filename: adjTile.filename || '',
        width: adjTile.width || 0,
        height: adjTile.height || 0,
        masonryAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
      };
      
      if (adjTile.type === 'image') {
        adjItem.gridUrl = adjTile.gridUrl || adjTile.url;
        adjItem.webUrl = adjTile.webUrl || adjTile.url;
        adjItem.originalUrl = adjTile.originalUrl || adjTile.url;
      }
      
      if (adjTile.type === 'video') {
        adjItem.src360 = adjTile.src360 || '';
        adjItem.src720 = adjTile.src720 || '';
        adjItem.srcOriginal = adjTile.srcOriginal || adjTile.url;
        adjItem.poster = adjTile.poster || '';
      }
      
      return adjItem;
    });
    
    // Create a minimal fake gallery element to get templates
    const fakeGallery = document.createElement('div');
    fakeGallery.className = 'abu-pg-gallery';
    fakeGallery.dataset.chapterId = tileData.chapterId || 'deep-link';
    fakeGallery.dataset.columnWidth = '280';
    fakeGallery.dataset.gutter = '16';
    
    // Create minimal state object that mirrors the structure from initGallery
    const state = {
      container: fakeGallery,
      layoutConfig: {
        columnWidth: 280,
        gutter: 16,
      },
      isTouch: window.matchMedia && window.matchMedia('(hover: none)').matches,
      isSpotlightEnabled: true,
      isIOSWebKit: isIOSWebKit(),
      debug: false,
      chapterId: tileData.chapterId || 'deep-link',
      scrollLocked: false,
      scrollY: 0,
      spotlight: null,
      desktopSpotlight: null,
      iconTemplates: {
        back: getIconTemplate('caret-left'),
        heart: getIconTemplate('heart'),
        heartFilled: getIconTemplate('heart-filled'),
        chatBubble: getIconTemplate('chat-bubble'),
        share2: getIconTemplate('share-2'),
        speakerLoud: getIconTemplate('speaker-loud'),
        speakerOff: getIconTemplate('speaker-off'),
      },
      userActivated: false,
      templates: GalleryStateManager.getTemplates(), // Use cached/smart template getter
      allItems: [item, ...adjacentItems], // All items for adjacent tile lookup
      activeItems: [item, ...adjacentItems],
      visibleCount: adjacentItems.length + 1,
      initialCount: adjacentItems.length + 1,
      chunkSize: 20,
      isDeepLink: true, // Flag to identify deep link mode
    };
    
    // Now call the EXISTING spotlight functions
    console.log('[Deep Link] Calling createDesktopSpotlight');
    createDesktopSpotlight(state);
    
    console.log('[Deep Link] Calling renderDesktopSpotlightMedia');
    renderDesktopSpotlightMedia(state, item);
    
    console.log('[Deep Link] Calling renderDesktopSpotlightRightColumn with', adjacentItems.length, 'items');
    renderDesktopSpotlightRightColumn(state, adjacentItems);
    
    // Lock scroll using existing function
    lockScroll(state);
    
    // Make spotlight visible (same as openDesktopSpotlight)
    requestAnimationFrame(() => {
      state.desktopSpotlight.overlay.classList.add('is-visible');
    });
    
    // Store state globally for closeDeepLinkSpotlight to access
    window.abuDeepLinkState = state;
    
    console.log('[Deep Link] Desktop Spotlight opened successfully using existing code');
  };
  
  /**
   * Open mobile spotlight from deep link tile data
   * 
   * STRATEGY: Create a minimal state object that mimics the gallery state,
   * then call the EXISTING createSpotlight and openSpotlight functions.
   * 
   * This ensures 100% identical behavior to clicking a tile in the gallery.
   */
  const openMobileSpotlightFromData = (tileData) => {
    logDeepLinkTiming('mobile_spotlight_start', { tileId: tileData.id, type: tileData.type });
    console.log('[Deep Link] Opening mobile Spotlight for tile:', tileData.id);
    
    // Convert tileData to item format expected by existing spotlight code
    const item = {
      id: tileData.id,
      type: tileData.type,
      url: tileData.url,
      title: tileData.title || '',
      filename: tileData.filename || '',
      createdAt: tileData.created || '',
      width: tileData.width || 0,
      height: tileData.height || 0,
      originalAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
      masonryAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
      element: null, // No DOM element for deep link
    };
    
    // Add image-specific fields
    if (tileData.type === 'image') {
      item.gridUrl = tileData.gridUrl || tileData.url;
      item.webUrl = tileData.webUrl || tileData.url;
      item.originalUrl = tileData.originalUrl || tileData.url;
      item.previewSrc = tileData.gridUrl || tileData.url;
    }
    
    // Add video-specific fields
    if (tileData.type === 'video') {
      item.src360 = tileData.src360 || '';
      item.src720 = tileData.src720 || '';
      item.srcOriginal = tileData.srcOriginal || tileData.url;
      item.poster = tileData.poster || '';
    }
    
    logDeepLinkTiming('item_data_converted', { type: item.type, hasPreview: !!item.previewSrc, hasPoster: !!item.poster });
    
    // Convert adjacent tiles to item format (for navigation)
    const allItems = [item];
    if (tileData.adjacentTiles && tileData.adjacentTiles.length > 0) {
      tileData.adjacentTiles.forEach(adjTile => {
        const adjItem = {
          id: adjTile.id,
          type: adjTile.type,
          url: adjTile.url,
          title: adjTile.title || '',
          filename: adjTile.filename || '',
          width: adjTile.width || 0,
          height: adjTile.height || 0,
          originalAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
          masonryAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
          element: null,
        };
        
        if (adjTile.type === 'image') {
          adjItem.gridUrl = adjTile.gridUrl || adjTile.url;
          adjItem.webUrl = adjTile.webUrl || adjTile.url;
          adjItem.originalUrl = adjTile.originalUrl || adjTile.url;
          adjItem.previewSrc = adjTile.gridUrl || adjTile.url;
        }
        
        if (adjTile.type === 'video') {
          adjItem.src360 = adjTile.src360 || '';
          adjItem.src720 = adjTile.src720 || '';
          adjItem.srcOriginal = adjTile.srcOriginal || adjTile.url;
          adjItem.poster = adjTile.poster || '';
        }
        
        allItems.push(adjItem);
      });
    }
    
    logDeepLinkTiming('adjacent_items_converted', { count: allItems.length });
    
    // Create a minimal fake gallery element to get templates
    const fakeGallery = document.createElement('div');
    fakeGallery.className = 'abu-pg-gallery';
    fakeGallery.dataset.chapterId = tileData.chapterId || 'deep-link';
    
    // Collect icon templates from DOM
    const iconTemplates = {
      back: '',
      heart: '',
      heartFilled: '',
      chatBubble: '',
      share2: '',
      speakerLoud: '',
      speakerOff: '',
    };
    
    const backTemplate = document.querySelector('.abu-pg-icon-template[data-icon="caret-left"]');
    if (backTemplate) iconTemplates.back = backTemplate.innerHTML;
    
    const heartTemplate = document.querySelector('.abu-pg-icon-template[data-icon="heart"]');
    if (heartTemplate) iconTemplates.heart = heartTemplate.innerHTML;
    
    const heartFilledTemplate = document.querySelector('.abu-pg-icon-template[data-icon="heart-filled"]');
    if (heartFilledTemplate) iconTemplates.heartFilled = heartFilledTemplate.innerHTML;
    
    const chatBubbleTemplate = document.querySelector('.abu-pg-icon-template[data-icon="chat-bubble"]');
    if (chatBubbleTemplate) iconTemplates.chatBubble = chatBubbleTemplate.innerHTML;
    
    const share2Template = document.querySelector('.abu-pg-icon-template[data-icon="share-2"]');
    if (share2Template) iconTemplates.share2 = share2Template.innerHTML;
    
    const paperPlaneTemplate = document.querySelector('.abu-pg-icon-template[data-icon="paper-plane"]');
    if (paperPlaneTemplate) iconTemplates.paperPlane = paperPlaneTemplate.innerHTML;
    
    const dotsHorizontalTemplate = document.querySelector('.abu-pg-icon-template[data-icon="dots-horizontal"]');
    if (dotsHorizontalTemplate) iconTemplates.dotsHorizontal = dotsHorizontalTemplate.innerHTML;
    
    const speakerLoudTemplate = document.querySelector('.abu-pg-icon-template[data-icon="speaker-loud"]');
    if (speakerLoudTemplate) iconTemplates.speakerLoud = speakerLoudTemplate.innerHTML;
    
    const speakerOffTemplate = document.querySelector('.abu-pg-icon-template[data-icon="speaker-off"]');
    if (speakerOffTemplate) iconTemplates.speakerOff = speakerOffTemplate.innerHTML;
    
    logDeepLinkTiming('icon_templates_collected', { hasBack: !!iconTemplates.back });
    
    // Create fake tile element for the animation (required by openSpotlight)
    const fakeTile = document.createElement('div');
    fakeTile.className = 'abu-pg-tile';
    fakeTile.dataset.id = item.id;
    fakeTile.dataset.type = item.type;
    fakeTile.dataset.url = item.url;
    fakeTile.style.position = 'fixed';
    fakeTile.style.top = '50%';
    fakeTile.style.left = '50%';
    fakeTile.style.width = '200px';
    fakeTile.style.height = '300px';
    fakeTile.style.transform = 'translate(-50%, -50%)';
    fakeTile.style.opacity = '0';
    fakeTile.style.pointerEvents = 'none';
    fakeTile.style.zIndex = '-1';
    
    // Add image or poster to fake tile for clone animation
    if (item.type === 'image') {
      const img = document.createElement('img');
      img.src = item.previewSrc || item.url;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      fakeTile.appendChild(img);
    } else if (item.type === 'video' && item.poster) {
      const img = document.createElement('img');
      img.src = item.poster;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      fakeTile.appendChild(img);
    }
    
    document.body.appendChild(fakeTile);
    item.element = fakeTile;
    
    logDeepLinkTiming('fake_tile_created', { type: item.type });
    
    // Create templates for rendering tile content
    const templates = createTemplates(fakeGallery);
    logDeepLinkTiming('templates_created', { hasImage: !!templates.image, hasVideo: !!templates.video });
    
    // Create minimal state object that mirrors the structure from initGallery
    const state = {
      container: fakeGallery,
      layoutConfig: {
        columnWidth: 280,
        gutter: 16,
      },
      isTouch: true, // Mobile devices are always touch
      isSpotlightEnabled: true, // Enable mobile spotlight
      isIOSWebKit: isIOSWebKit(),
      debug: false,
      chapterId: tileData.chapterId || 'deep-link',
      scrollLocked: false,
      scrollY: 0,
      spotlight: null, // Will be created by createSpotlight()
      desktopSpotlight: null,
      iconTemplates: iconTemplates,
      userActivated: false,
      templates: templates, // Use actual templates, not null
      allItems: allItems,
      activeItems: allItems,
      isDeepLinkMode: true, // Flag to identify deep link mode
    };
    
    // Store state globally for cleanup
    window.abuDeepLinkMobileState = state;
    
    logDeepLinkTiming('calling_createSpotlight');
    console.log('[Deep Link] Calling createSpotlight (mobile)');
    createSpotlight(state);
    
    logDeepLinkTiming('spotlight_created', { hasOverlay: !!state.spotlight });
    
    console.log('[Deep Link] Calling openSpotlight with item:', item.id);
    logDeepLinkTiming('calling_openSpotlight');
    openSpotlight(state, fakeTile, item);
    
    logDeepLinkTiming('openSpotlight_returned');
    
    // Clean up fake tile after animation completes
    setTimeout(() => {
      if (fakeTile && fakeTile.parentElement) {
        fakeTile.remove();
      }
      logDeepLinkTiming('fake_tile_cleaned');
    }, 600);
    
    console.log('[Deep Link] Mobile Spotlight opened successfully using existing code');
    logDeepLinkTiming('mobile_spotlight_complete');
  };

  ready(() => {
    console.log('[Bootstrap] Gallery initialization started');
    
    // NEW: Deep link detection (abu_pg_tile parameter)
    const deepLinkContainer = document.querySelector('.abu-pg-deep-link-container');
    
    if (deepLinkContainer) {
      window.abuPgDeepLinkStartTime = Date.now();
      logDeepLinkTiming('deep_link_detected');
      
      const tileId = deepLinkContainer.dataset.deepLinkTile;
      const tileDataScript = deepLinkContainer.querySelector('.abu-pg-deep-link-data');
      
      if (tileDataScript && tileId) {
        console.log(`[Bootstrap] Deep link detected for tile ${tileId}`);
        logDeepLinkTiming('tile_data_found', { tileId });
        
        let tileData;
        try {
          tileData = JSON.parse(tileDataScript.textContent);
          logDeepLinkTiming('tile_data_parsed', { type: tileData.type });
        } catch (error) {
          console.error('[Bootstrap] Failed to parse tile data JSON:', error);
          logDeepLinkTiming('tile_data_parse_error', { error: error.message });
          tileData = null;
        }
        
        if (tileData) {
          // Open Spotlight immediately (before gallery init)
          logDeepLinkTiming('calling_openSpotlightFromDeepLink');
          openSpotlightFromDeepLink(tileData);
          
          // Initialize galleries in background (hidden)
          setTimeout(() => {
            logDeepLinkTiming('background_gallery_init_start');
            const galleries = Array.from(document.querySelectorAll('.abu-pg-gallery'));
            const galleryInstances = [];
            
            galleries.forEach((gallery) => {
              const instance = initGallery(gallery);
              galleryInstances.push(instance);
            });
            
            // Initialize URL state manager
            if (typeof URLStateManager !== 'undefined' && galleryInstances.length > 0) {
              URLStateManager.init(galleryInstances);
              window.URLStateManager = URLStateManager;
            }
            
            console.log('[Bootstrap] Background gallery initialized');
            logDeepLinkTiming('background_gallery_init_complete');
          }, 50);
          
          return;
        }
      }
    }
    
    // Normal gallery mode (no deep link)
    console.log('[Bootstrap] Normal gallery mode');
    const galleries = Array.from(document.querySelectorAll('.abu-pg-gallery'));
    const galleryInstances = [];
    
    galleries.forEach((gallery) => {
      const instance = initGallery(gallery);
      galleryInstances.push(instance);
    });
    
    // Initialize URL state manager with all gallery instances
    if (typeof URLStateManager !== 'undefined' && galleryInstances.length > 0) {
      URLStateManager.init(galleryInstances);
      window.URLStateManager = URLStateManager;
      
      // Handle initial page load with URL parameters (chapter navigation only)
      setTimeout(() => {
        URLStateManager.handleInitialLoad();
      }, 50);
    }
  });
  
  /**
   * ========================================
   * PHASE 2-6: GALLERY STATE MANAGER + SPA NAVIGATION
   * ========================================
   * 
   * Singleton that caches kit gallery context to enable SPA-like
   * tile-to-tile navigation without full page reloads.
   */
  const GalleryStateManager = {
    // In-memory cache of kit contexts
    cache: new Map(),
    
    // Current active spotlight state (for popstate handling)
    currentSpotlight: null,
    
    // Tile templates (image/video) - created once, reused everywhere
    tileTemplates: null,
    
    /**
     * Get or create tile templates
     */
    getTemplates() {
      // #region agent log - getTemplates entry
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:5421',message:'getTemplates called',data:{hasCachedTemplates:!!this.tileTemplates,cachedImageExists:this.tileTemplates?.image ? true : false,cachedVideoExists:this.tileTemplates?.video ? true : false},timestamp:Date.now(),sessionId:'template-cache-debug',runId:'v9',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion agent log
      
      if (this.tileTemplates) {
        return this.tileTemplates;
      }
      
      // Try multiple sources for templates, in order of preference:
      
      // 1. Try main gallery (best source - has all buttons for logged-in users)
      const mainGallery = document.querySelector('.abu-pg-chapters-wrapper');
      // #region agent log - main gallery check
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:5429',message:'Main gallery check',data:{exists:!!mainGallery,tileCount:mainGallery ? mainGallery.querySelectorAll('.abu-pg-tile').length : 0,isVisible:mainGallery ? getComputedStyle(mainGallery).display !== 'none' : false,hasButtonsInFirstTile:mainGallery && mainGallery.querySelector('.abu-pg-tile') ? !!mainGallery.querySelector('.abu-pg-tile').querySelector('.abu-pg-tile-button-container') : false},timestamp:Date.now(),sessionId:'template-cache-debug',runId:'v9',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion agent log
      if (mainGallery && mainGallery.querySelectorAll('.abu-pg-tile').length > 0) {
        this.tileTemplates = createTemplates(mainGallery);
        return this.tileTemplates;
      }
      
      // 2. Try spotlight right column (if we're in a deep-link scenario)
      const spotlightRightGrid = document.querySelector('.abu-pg-desktop-spotlight-right-grid');
      if (spotlightRightGrid && spotlightRightGrid.querySelectorAll('.abu-pg-tile').length > 0) {
        this.tileTemplates = createTemplates(spotlightRightGrid);
        return this.tileTemplates;
      }
      
      // 3. Try any tiles in the document as fallback
      const anyTilesContainer = document.querySelector('.abu-pg-tile')?.parentElement;
      if (anyTilesContainer && anyTilesContainer.querySelectorAll('.abu-pg-tile').length > 0) {
        this.tileTemplates = createTemplates(anyTilesContainer);
        return this.tileTemplates;
      }
      
      // 4. Fallback: return empty templates
      // #region agent log - template fallback
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:5450',message:'No valid templates found - returning empty',data:{},timestamp:Date.now(),sessionId:'template-cache-debug',runId:'v9',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion agent log
      return { image: null, video: null };
    },
    
    /**
     * Check if a kit is already cached
     */
    hasKit(kitId) {
      const cached = this.cache.has(String(kitId));
      logNav('GalleryStateManager.hasKit', { kitId, cached });
      return cached;
    },
    
    /**
     * Get cached kit context
     */
    getKit(kitId) {
      const kitContext = this.cache.get(String(kitId)) || null;
      logNav('GalleryStateManager.getKit', { 
        kitId, 
        found: !!kitContext,
        tileCount: kitContext?.tiles?.length || 0
      });
      return kitContext;
    },
    
    /**
     * Store kit context in cache
     * @param {number|string} kitId - Content Kit ID
     * @param {Object} kitContext - Kit context object
     * @param {string} kitContext.kitId - Kit ID
     * @param {string} kitContext.kitUrl - Kit gallery URL
     * @param {Array} kitContext.tiles - Ordered array of tile objects
     */
    setKit(kitId, kitContext) {
      this.cache.set(String(kitId), {
        ...kitContext,
        cachedAt: Date.now()
      });
      
      logNav('GalleryStateManager.setKit', {
        kitId,
        kitUrl: kitContext.kitUrl,
        tileCount: kitContext.tiles?.length || 0
      });
      
      // Mirror to sessionStorage (metadata only, no HTML)
      try {
        sessionStorage.setItem(
          `abu_pg_kit_${kitId}`,
          JSON.stringify({
            kitId: kitContext.kitId,
            kitUrl: kitContext.kitUrl,
            tiles: kitContext.tiles,
            cachedAt: Date.now()
          })
        );
      } catch (e) {
        // sessionStorage quota exceeded or disabled
        console.warn('[GalleryStateManager] sessionStorage unavailable:', e);
      }
    },
    
    /**
     * PHASE 4: Ensure kit context exists, bootstrap from server if needed
     * @param {number|string} kitId - Content Kit ID
     * @returns {Promise<Object>} Kit context
     */
    async ensureKit(kitId) {
      logNav('GalleryStateManager.ensureKit', { kitId });
      
      // Check in-memory cache first
      if (this.hasKit(kitId)) {
        return this.getKit(kitId);
      }
      
      // Check sessionStorage
      try {
        const stored = sessionStorage.getItem(`abu_pg_kit_${kitId}`);
        if (stored) {
          const kitContext = JSON.parse(stored);
          this.cache.set(String(kitId), kitContext);
          logNav('GalleryStateManager.ensureKit restored from sessionStorage', {
            kitId,
            tileCount: kitContext.tiles?.length || 0
          });
          return kitContext;
        }
      } catch (e) {
        // Invalid JSON or sessionStorage disabled
      }
      
      // Bootstrap from server via REST API
      logNav('GalleryStateManager.ensureKit fetching from server', { kitId });
      
      // #region agent log
      // Hypothesis C: Track REST API fetch attempt
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4311',message:'Fetching kit from REST API',data:{kitId,url:`/wp-json/abu-pg/v1/kit/${kitId}/tiles`},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      try {
        // Use WP REST API to fetch kit tiles (Phase 4 server endpoint needed)
        const response = await fetch(`/wp-json/abu-pg/v1/kit/${kitId}/tiles`, {
          credentials: 'same-origin'
        });
        
        // #region agent log
        // Hypothesis C: Track REST API response
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4323',message:'REST API response received',data:{kitId,status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        
        const data = await response.json();
        
        // #region agent log
        // Hypothesis C: Track REST API data
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4335',message:'REST API data parsed',data:{kitId,hasTiles:!!data?.tiles,tileCount:data?.tiles?.length||0,hasKitUrl:!!data?.kitUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        if (data && data.tiles && Array.isArray(data.tiles)) {
          const kitContext = {
            kitId: data.kitId || kitId,
            kitUrl: data.kitUrl,
            kitTitle: data.kitTitle || '',
            tiles: data.tiles
          };
          
          this.setKit(kitId, kitContext);
          logNav('GalleryStateManager.ensureKit fetched from server', {
            kitId,
            tileCount: kitContext.tiles.length
          });
          
          return kitContext;
        } else {
          throw new Error('Invalid server response');
        }
      } catch (error) {
        console.error('[GalleryStateManager] Failed to bootstrap kit:', error);
        logNav('GalleryStateManager.ensureKit failed', { kitId, error: error.message });
        return null;
      }
    },
    
    /**
     * Clear cache (useful for testing or manual refresh)
     */
    clear() {
      this.cache.clear();
      logNav('GalleryStateManager.clear', { cleared: true });
    }
  };
  
  // Expose globally for debugging
  window.abuPgGalleryState = GalleryStateManager;
  
  /**
   * ========================================
   * PHASE 3: SPA-STYLE TILE NAVIGATION
   * ========================================
   * 
   * Navigate to a tile without full page reload.
   * Uses cached kit context and History API.
   */
  async function navigateToTile(tileId, tilePermalink, kitId) {
    // #region agent log
    // Hypothesis A: Track navigateToTile entry
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4348',message:'navigateToTile called',data:{tileId,tilePermalink,kitId},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    logNav('navigateToTile', { tileId, tilePermalink, kitId });
    
    // Ensure kit context is available
    let kitContext = null;
    if (kitId) {
      kitContext = await GalleryStateManager.ensureKit(kitId);
      
      // #region agent log
      // Hypothesis B: Track if kit context was found
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4358',message:'ensureKit result',data:{kitId,hasContext:!!kitContext,tileCount:kitContext?.tiles?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (!kitContext) {
        logNav('navigateToTile fallback to full navigation', { 
          reason: 'kit context unavailable' 
        });
        // Fallback to full page navigation if bootstrap fails
        window.location.href = tilePermalink;
        return;
      }
    }
    
    // Find tile data in cached context
    const tileData = kitContext?.tiles?.find(t => t.id === tileId);
    
    // #region agent log
    // Hypothesis B: Track if tile found in cache
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4378',message:'Tile lookup in cache',data:{tileId,foundInCache:!!tileData,totalTilesInCache:kitContext?.tiles?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!tileData) {
      logNav('navigateToTile fallback to full navigation', { 
        reason: 'tile not found in cache' 
      });
      window.location.href = tilePermalink;
      return;
    }
    
    // Update URL with history API (no reload)
    const newUrl = tilePermalink;
    history.pushState(
      {
        type: 'tile',
        tileId: tileId,
        kitId: kitId,
        kitUrl: kitContext.kitUrl
      },
      '',
      newUrl
    );
    
    // #region agent log
    // Hypothesis A: Track history state update
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4392',message:'History pushState called',data:{tileId,newUrl,historyState:history.state},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    logNav('navigateToTile history.pushState', { 
      tileId, 
      newUrl,
      state: history.state 
    });
    
    // Re-render spotlight with new tile
    renderSpotlightForTile(tileData, kitContext);
  }
  
  /**
   * PHASE 3: Render spotlight for a specific tile (SPA mode)
   */
  function renderSpotlightForTile(tileData, kitContext) {
    // #region agent log
    // Hypothesis D: Track renderSpotlightForTile entry
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4405',message:'renderSpotlightForTile called',data:{tileId:tileData.id,kitId:kitContext?.kitId,totalTiles:kitContext?.tiles?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    logNav('renderSpotlightForTile', {
      tileId: tileData.id,
      kitId: kitContext?.kitId
    });
    
    // Determine device type using SINGLE source of truth
    const useMobileLayout = shouldUseMobileLayout();
    
    // Convert tileData to item format
    const item = {
      id: tileData.id,
      type: tileData.type,
      url: tileData.url,
      permalink: tileData.permalink || '',
      title: tileData.title || '',
      filename: tileData.filename || '',
      createdAt: tileData.created || '',
      width: tileData.width || 0,
      height: tileData.height || 0,
      originalAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
      masonryAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
    };
    
    // Add media-specific fields
    if (tileData.type === 'image') {
      item.gridUrl = tileData.gridUrl || tileData.url;
      item.webUrl = tileData.webUrl || tileData.url;
      item.originalUrl = tileData.originalUrl || tileData.url;
      item.previewSrc = tileData.previewSrc || tileData.gridUrl || tileData.url;
      item.gridSrcset = tileData.gridSrcset || '';
      item.gridSizes = tileData.gridSizes || '';
    } else if (tileData.type === 'video') {
      item.poster = tileData.poster || '';
      item.src720 = tileData.src720 || '';
      item.src360 = tileData.src360 || '';
      item.srcOriginal = tileData.srcOriginal || tileData.url;
    }
    
    // Get or create state object
    let state = GalleryStateManager.currentSpotlight;
    
    // #region agent log - state check
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        location: 'gallery.js:5698',
        message: 'renderSpotlightForTile state check',
        data: {
          hasState: !!state,
          hasDesktopSpotlight: state?.desktopSpotlight ? true : false,
          hasTemplates: state?.templates ? true : false,
          templateImageExists: state?.templates?.image ? true : false,
          templateVideoExists: state?.templates?.video ? true : false
        },
        timestamp: Date.now(),
        sessionId: 'state-debug',
        runId: 'v5',
        hypothesisId: 'STATE_REUSE'
      })
    }).catch(() => {});
    // #endregion agent log
    
    if (!state || !state.desktopSpotlight) {
      // Get tile templates from GalleryStateManager (cached or created once)
      const tileTemplates = GalleryStateManager.getTemplates();
      
      // #region agent log - template creation
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:5702',
          message: 'Got templates from GalleryStateManager',
          data: {
            hasImageTemplate: !!tileTemplates.image,
            hasVideoTemplate: !!tileTemplates.video
          },
          timestamp: Date.now(),
          sessionId: 'state-debug',
          runId: 'v6',
          hypothesisId: 'TEMPLATE_CREATION'
        })
      }).catch(() => {});
      // #endregion agent log
      
      // Create new spotlight state
      state = {
        container: document.body,
        isSpotlightEnabled: true,
        allItems: kitContext.tiles.map(t => ({
          id: t.id,
          type: t.type,
          url: t.url,
          permalink: t.permalink || '',
          title: t.title || '',
          filename: t.filename || '',
          createdAt: t.created || '',
          width: t.width || 0,
          height: t.height || 0,
          originalAspectRatio: (t.height && t.width) ? t.height / t.width : 1.5,
          masonryAspectRatio: (t.height && t.width) ? t.height / t.width : 1.5,
          gridUrl: t.gridUrl || t.url,
          webUrl: t.webUrl || t.url,
          originalUrl: t.originalUrl || t.url,
          previewSrc: t.previewSrc || t.gridUrl || t.url,
          poster: t.poster || '',
          src720: t.src720 || '',
          src360: t.src360 || '',
          srcOriginal: t.srcOriginal || t.url,
        })),
        activeItems: [],
        templates: tileTemplates,
        iconTemplates: {
          back: '',
          heart: '',
          heartFilled: '',
          chatBubble: '',
          share2: '',
          speakerLoud: '',
          speakerOff: '',
        },
        kitContext: kitContext
      };
      
      // Collect icon templates
      const getIconTemplate = (iconName) => {
        const template = document.querySelector(`.abu-pg-icon-template[data-icon="${iconName}"]`);
        return template ? template.innerHTML : '';
      };
      
      state.iconTemplates.back = getIconTemplate('caret-left');
      state.iconTemplates.heart = getIconTemplate('heart');
      state.iconTemplates.heartFilled = getIconTemplate('heart-filled');
      state.iconTemplates.chatBubble = getIconTemplate('chat-bubble');
      state.iconTemplates.share2 = getIconTemplate('share-2');
      state.iconTemplates.paperPlane = getIconTemplate('paper-plane');
      state.iconTemplates.dotsHorizontal = getIconTemplate('dots-horizontal');
      state.iconTemplates.speakerLoud = getIconTemplate('speaker-loud');
      state.iconTemplates.speakerOff = getIconTemplate('speaker-off');
      
      state.activeItems = state.allItems;
      
      // Create spotlight UI
      if (!useMobileLayout) {
        createDesktopSpotlight(state);
        GalleryStateManager.currentSpotlight = state;
      } else {
        createSpotlight(state);
        GalleryStateManager.currentSpotlight = state;
      }
    }
    
    // Ensure state has valid templates (for both new state and reused state)
    if (!state.templates || !state.templates.image || !state.templates.video) {
      state.templates = GalleryStateManager.getTemplates();
      
      // #region agent log - template refresh
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:5848',
          message: 'Refreshed templates on state',
          data: {
            hasImageTemplate: !!state.templates.image,
            hasVideoTemplate: !!state.templates.video
          },
          timestamp: Date.now(),
          sessionId: 'state-debug',
          runId: 'v8',
          hypothesisId: 'TEMPLATE_REFRESH'
        })
      }).catch(() => {});
      // #endregion agent log
    }
    
    // Ensure state has valid icon templates (for both new state and reused state)
    if (!state.iconTemplates || !state.iconTemplates.back || !state.iconTemplates.paperPlane) {
      const getIconTemplate = (iconName) => {
        const template = document.querySelector(`.abu-pg-icon-template[data-icon="${iconName}"]`);
        return template ? template.innerHTML : '';
      };
      
      state.iconTemplates = state.iconTemplates || {};
      state.iconTemplates.back = getIconTemplate('caret-left');
      state.iconTemplates.heart = getIconTemplate('heart');
      state.iconTemplates.heartFilled = getIconTemplate('heart-filled');
      state.iconTemplates.chatBubble = getIconTemplate('chat-bubble');
      state.iconTemplates.share2 = getIconTemplate('share-2');
      state.iconTemplates.paperPlane = getIconTemplate('paper-plane');
      state.iconTemplates.dotsHorizontal = getIconTemplate('dots-horizontal');
      state.iconTemplates.speakerLoud = getIconTemplate('speaker-loud');
      state.iconTemplates.speakerOff = getIconTemplate('speaker-off');
      
      // #region agent log - icon template refresh
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:5905',message:'Icon templates refreshed on state reuse',data:{back:!!state.iconTemplates.back,paperPlane:!!state.iconTemplates.paperPlane,paperPlaneLength:state.iconTemplates.paperPlane?.length || 0},timestamp:Date.now(),sessionId:'icon-debug',runId:'v9',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion agent log
      
      // #region agent log - icon refresh
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:5880',
          message: 'Refreshed icon templates on state',
          data: {
            backIconExists: !!state.iconTemplates.back,
            paperPlaneIconExists: !!state.iconTemplates.paperPlane
          },
          timestamp: Date.now(),
          sessionId: 'state-debug',
          runId: 'v8',
          hypothesisId: 'ICON_REFRESH'
        })
      }).catch(() => {});
      // #endregion agent log
    }
    
    // Render spotlight content
    if (!useMobileLayout) {
      // #region agent log - check icon templates before render
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          location: 'gallery.js:5850',
          message: 'About to render spotlight media',
          data: {
            hasState: !!state,
            hasIconTemplates: !!state.iconTemplates,
            backIconExists: state.iconTemplates?.back ? true : false,
            paperPlaneIconExists: state.iconTemplates?.paperPlane ? true : false,
            hasTemplates: !!state.templates,
            imageTemplateExists: state.templates?.image ? true : false,
            videoTemplateExists: state.templates?.video ? true : false
          },
          timestamp: Date.now(),
          sessionId: 'state-debug',
          runId: 'v7',
          hypothesisId: 'ICON_CHECK'
        })
      }).catch(() => {});
      // #endregion agent log
      
      renderDesktopSpotlightMedia(state, item);
      
      // PHASE 6: Render windowed right column (±20 tiles around current)
      const currentIndex = state.allItems.findIndex(i => i.id === item.id);
      const windowSize = 20;
      const start = Math.max(0, currentIndex - Math.floor(windowSize / 2));
      const end = Math.min(state.allItems.length, start + windowSize);
      const windowedItems = state.allItems.slice(start, end).filter(i => i.id !== item.id);
      
      // #region agent log
      // Hypothesis E: Track windowing calculation
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4525',message:'Right column windowing',data:{totalAllItems:state.allItems.length,currentIndex,windowStart:start,windowEnd:end,windowedItemsCount:windowedItems.length,currentTileId:item.id},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      logNav('Rendering Right Column (windowed)', {
        totalAllItems: state.allItems.length,
        currentIndex,
        windowStart: start,
        windowEnd: end,
        adjacentCount: windowedItems.length
      });
      
      renderDesktopSpotlightRightColumn(state, windowedItems);
      
      // Setup back button with kit context
      const backBtn = state.desktopSpotlight.leftColumn.querySelector('.abu-pg-desktop-spotlight-back-btn');
      if (backBtn && kitContext) {
        // Remove old listeners
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        
        newBackBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          logNav('Back Button Clicked (SPA)', {
            navigatingTo: kitContext.kitUrl
          });
          
          // Back button always goes to kit gallery (not browser back)
          window.location.href = kitContext.kitUrl;
        });
      }
      
      lockScroll(state);
      
      if (!state.desktopSpotlight.overlay.classList.contains('is-visible')) {
        requestAnimationFrame(() => {
          state.desktopSpotlight.overlay.classList.add('is-visible');
        });
      }
    } else {
      // Mobile spotlight - FIXED: Use same openSpotlight() path as masonry taps
      // This ensures ONE rendering system for mobile (no duplicate UI)
      
      // #region agent log H6
      logMobile({hypothesisId:'H6',location:'renderSpotlightForTile:mobile-branch',message:'Mobile spotlight branch - calling openSpotlight',data:{itemId:item.id,allItemsCount:state.allItems.length,hasSpotlight:!!state.spotlight}});
      // #endregion agent log H6
      
      // Call openSpotlight with skipAnimation=true (no tile element, direct URL mode)
      // This will create slides using the SAME path as masonry taps
      openSpotlight(state, null, item, true);
    }
  }
  
  /**
   * ========================================
   * PHASE 5: POPSTATE HANDLER (BACK/FORWARD BUTTONS)
   * ========================================
   */
  window.addEventListener('popstate', (event) => {
    // #region agent log
    // Hypothesis F: Track popstate event
    fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4585',message:'Popstate event fired',data:{hasState:!!event.state,stateType:event.state?.type,tileId:event.state?.tileId,kitId:event.state?.kitId,url:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-test',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    logNav('popstate event', { 
      state: event.state,
      url: window.location.href
    });
    
    if (!event.state) {
      // No state = navigated to a non-SPA page or initial page load
      // Close spotlight if open and reload
      if (GalleryStateManager.currentSpotlight) {
        const state = GalleryStateManager.currentSpotlight;
        if (state.desktopSpotlight) {
          closeDesktopSpotlight(state);
        } else if (state.spotlight) {
          closeSpotlight(state);
        }
        GalleryStateManager.currentSpotlight = null;
      }
      
      // Check if we should reload or stay
      const urlParams = new URLSearchParams(window.location.search);
      const tileParam = urlParams.get('abu_pg_tile');
      
      if (!tileParam && window.location.pathname.includes('/tile/')) {
        // Tile permalink without state - reload to get PHP rendering
        logNav('popstate reload', { reason: 'tile permalink without state' });
        window.location.reload();
      } else if (!tileParam && !window.location.pathname.includes('/tile/')) {
        // Gallery page - reload to show gallery
        logNav('popstate reload', { reason: 'gallery page' });
        window.location.reload();
      }
      
      return;
    }
    
    if (event.state.type === 'tile') {
      // Navigated to a tile in SPA mode
      const { tileId, kitId, kitUrl } = event.state;
      
      logNav('popstate navigating to tile', { tileId, kitId });
      
      // Get kit context
      const kitContext = GalleryStateManager.getKit(kitId);
      
      if (!kitContext) {
        logNav('popstate reload', { reason: 'kit context not cached' });
        window.location.reload();
        return;
      }
      
      // Find tile
      const tileData = kitContext.tiles.find(t => t.id === tileId);
      
      if (!tileData) {
        logNav('popstate reload', { reason: 'tile not found' });
        window.location.reload();
        return;
      }
      
      // Re-render spotlight
      renderSpotlightForTile(tileData, kitContext);
    } else if (event.state.type === 'gallery') {
      // Navigated back to gallery
      logNav('popstate back to gallery', { url: event.state.kitUrl });
      
      if (GalleryStateManager.currentSpotlight) {
        const state = GalleryStateManager.currentSpotlight;
        if (state.desktopSpotlight) {
          closeDesktopSpotlight(state);
        } else if (state.spotlight) {
          closeSpotlight(state);
        }
        GalleryStateManager.currentSpotlight = null;
      }
      
      // Reload gallery page
      window.location.reload();
    }
  });
  
  /**
   * ========================================
   * TILE PERMALINK SPOTLIGHT OPENER
   * ========================================
   * 
   * CLEAN BREAK: Opens spotlight from tile permalink pages.
   * Exported for use by single-tile.php template.
   */
  window.openSpotlightForTilePermalink = function(tileData, kitContext) {
    console.log('[Tile Permalink] Opening spotlight for tile:', tileData.id);
    
    // #region agent log H5
    logMobile({hypothesisId:'H5',location:'openSpotlightForTilePermalink:entry',message:'Permalink opener called',data:{tileId:tileData.id,tileType:tileData.type,hasKitContext:!!kitContext,hasAdjacentTiles:!!(tileData.adjacentTiles&&tileData.adjacentTiles.length),adjacentCount:tileData.adjacentTiles?tileData.adjacentTiles.length:0,isMobile:isMobileDevice(),viewportW:window.innerWidth,viewportH:window.innerHeight,userAgent:navigator.userAgent.substring(0,60)}});
    // #endregion agent log H5
    
    // PHASE 1: Log spotlight initialization from permalink
    logNav('Spotlight Init from Permalink', {
      tileId: tileData.id,
      hasKitContext: !!kitContext,
      kitId: kitContext?.kitId,
      kitUrl: kitContext?.kitUrl,
      hasAdjacentTiles: !!tileData.adjacentTiles,
      adjacentTilesCount: tileData.adjacentTiles?.length || 0
    });
    
    // PHASE 2: Cache kit context if provided
    if (kitContext && kitContext.kitId && tileData.adjacentTiles) {
      GalleryStateManager.setKit(kitContext.kitId, {
        kitId: kitContext.kitId,
        kitUrl: kitContext.kitUrl,
        kitTitle: kitContext.kitTitle,
        tiles: tileData.adjacentTiles
      });
    }
    
    // PHASE 5: Set initial history state for popstate handling
    if (kitContext && kitContext.kitId) {
      history.replaceState(
        {
          type: 'tile',
          tileId: tileData.id,
          kitId: kitContext.kitId,
          kitUrl: kitContext.kitUrl
        },
        '',
        window.location.href
      );
      
      logNav('Initial history state set', {
        tileId: tileData.id,
        kitId: kitContext.kitId
      });
    }
    
    // Render using shared function (Phase 3)
    if (kitContext && tileData.adjacentTiles) {
      renderSpotlightForTile(tileData, {
        kitId: kitContext.kitId,
        kitUrl: kitContext.kitUrl,
        kitTitle: kitContext.kitTitle,
        tiles: tileData.adjacentTiles
      });
      return;
    }
    
    // FALLBACK: Legacy rendering (if no kit context)
    // Determine device type using SINGLE source of truth
    const useMobileLayout = shouldUseMobileLayout();
    
    // Convert tileData to item format
    const item = {
      id: tileData.id,
      type: tileData.type,
      url: tileData.url,
      permalink: tileData.permalink || '',
      title: tileData.title || '',
      filename: tileData.filename || '',
      createdAt: tileData.created || '',
      width: tileData.width || 0,
      height: tileData.height || 0,
      originalAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
      masonryAspectRatio: (tileData.height && tileData.width) ? tileData.height / tileData.width : 1.5,
    };
    
    // Add media-specific fields
    if (tileData.type === 'image') {
      item.gridUrl = tileData.gridUrl || tileData.url;
      item.webUrl = tileData.webUrl || tileData.url;
      item.originalUrl = tileData.originalUrl || tileData.url;
      item.gridSrcset = tileData.gridSrcset || '';
      item.gridSizes = tileData.gridSizes || '';
    } else if (tileData.type === 'video') {
      item.poster = tileData.poster || '';
      item.src720 = tileData.src720 || '';
      item.src360 = tileData.src360 || '';
      item.srcOriginal = tileData.srcOriginal || tileData.url;
    }
    
    // Create minimal state object
    const state = {
      container: document.body,
      isSpotlightEnabled: true,
      allItems: [item],
      activeItems: [item],
      templates: {
        caretLeft: '',
        heart: '',
        heartFilled: '',
        chatBubble: '',
        share2: '',
        speakerLoud: '',
        speakerOff: '',
      },
      iconTemplates: {
        back: '',
        heart: '',
        heartFilled: '',
        chatBubble: '',
        share2: '',
        speakerLoud: '',
        speakerOff: '',
      },
    };
    
    // Collect icon templates from DOM (if available)
    const getIconTemplate = (iconName) => {
      const template = document.querySelector(`.abu-pg-icon-template[data-icon="${iconName}"]`);
      return template ? template.innerHTML : '';
    };
    
    state.templates.caretLeft = getIconTemplate('caret-left');
    state.templates.heart = getIconTemplate('heart');
    state.templates.heartFilled = getIconTemplate('heart-filled');
    state.templates.chatBubble = getIconTemplate('chat-bubble');
    state.templates.share2 = getIconTemplate('share-2');
    state.templates.speakerLoud = getIconTemplate('speaker-loud');
    state.templates.speakerOff = getIconTemplate('speaker-off');
    
    // Also populate iconTemplates (used by desktop spotlight)
    state.iconTemplates.back = getIconTemplate('caret-left');
    state.iconTemplates.heart = getIconTemplate('heart');
    state.iconTemplates.heartFilled = getIconTemplate('heart-filled');
    state.iconTemplates.chatBubble = getIconTemplate('chat-bubble');
    state.iconTemplates.share2 = getIconTemplate('share-2');
    state.iconTemplates.paperPlane = getIconTemplate('paper-plane');
    state.iconTemplates.dotsHorizontal = getIconTemplate('dots-horizontal');
    state.iconTemplates.speakerLoud = getIconTemplate('speaker-loud');
    state.iconTemplates.speakerOff = getIconTemplate('speaker-off');
    
    // Add adjacent tiles if provided (for carousel navigation)
    if (tileData.adjacentTiles && Array.isArray(tileData.adjacentTiles)) {
      // #region agent log
      // Hypothesis G: Log adjacent tiles received
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4340',message:'Adjacent tiles received',data:{count:tileData.adjacentTiles.length,firstTileId:tileData.adjacentTiles[0]?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      // PHASE 1: Log adjacent tiles processing
      logNav('Processing Adjacent Tiles', {
        adjacentCount: tileData.adjacentTiles.length,
        firstTileId: tileData.adjacentTiles[0]?.id,
        lastTileId: tileData.adjacentTiles[tileData.adjacentTiles.length - 1]?.id
      });
      
      const adjacentItems = tileData.adjacentTiles.map(adjTile => ({
        id: adjTile.id,
        type: adjTile.type,
        url: adjTile.url,
        permalink: adjTile.permalink || '',
        title: adjTile.title || '',
        filename: adjTile.filename || '',
        createdAt: adjTile.created || '',
        width: adjTile.width || 0,
        height: adjTile.height || 0,
        originalAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
        masonryAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
        gridUrl: adjTile.gridUrl || adjTile.url,
        webUrl: adjTile.webUrl || adjTile.url,
        originalUrl: adjTile.originalUrl || adjTile.url,
        previewSrc: adjTile.previewSrc || adjTile.gridUrl || adjTile.url,
        poster: adjTile.poster || '',
        src720: adjTile.src720 || '',
        src360: adjTile.src360 || '',
        srcOriginal: adjTile.srcOriginal || adjTile.url,
      }));
      
      state.allItems = adjacentItems;
      state.activeItems = adjacentItems;
      
      // #region agent log
      // Hypothesis G: Log state populated
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4370',message:'State populated with tiles',data:{allItemsCount:state.allItems.length,activeItemsCount:state.activeItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    }
    
    // Open spotlight
    if (!useMobileLayout) {
      createDesktopSpotlight(state);
      
      // #region agent log
      // Hypothesis H: Log before rendering media
      fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4380',message:'About to render desktop spotlight',data:{hasKitContext:!!kitContext,kitUrl:kitContext?.kitUrl,allItemsCount:state.allItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      renderDesktopSpotlightMedia(state, item);
      if (state.allItems.length > 1) {
        const adjacentItems = state.allItems.filter(i => i.id !== item.id).slice(0, 20);
        
        // PHASE 1: Log right column rendering
        logNav('Rendering Right Column', {
          totalAllItems: state.allItems.length,
          adjacentCount: adjacentItems.length,
          currentTileId: item.id
        });
        
        // #region agent log
        // Hypothesis I: Log right column rendering
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4391',message:'Rendering right column',data:{adjacentCount:adjacentItems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        
        renderDesktopSpotlightRightColumn(state, adjacentItems);
      } else {
        // PHASE 1: Log empty right column case
        logNav('Right Column Empty', {
          totalAllItems: state.allItems.length,
          reason: 'allItems.length <= 1'
        });
      }
      
      // Handle back button click - navigate to kit URL if provided
      const backBtn = state.desktopSpotlight.leftColumn.querySelector('.abu-pg-desktop-spotlight-back-btn');
      if (backBtn && kitContext && kitContext.kitUrl) {
        // PHASE 1: Log back button setup
        logNav('Back Button Setup', {
          hasKitUrl: !!kitContext.kitUrl,
          kitUrl: kitContext.kitUrl,
          kitId: kitContext.kitId
        });
        
        // #region agent log
        // Hypothesis J: Log back button setup
        fetch('http://127.0.0.1:7242/ingest/a9c04ef7-8b07-4b3a-a54e-d2c84a3df51f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'gallery.js:4407',message:'Setting up back button',data:{kitUrl:kitContext.kitUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'J'})}).catch(()=>{});
        // #endregion
        
        backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // PHASE 1: Log back button click
          logNav('Back Button Clicked', {
            navigatingTo: kitContext.kitUrl
          });
          
          window.location.href = kitContext.kitUrl;
        });
      } else {
        // PHASE 1: Log back button not configured
        logNav('Back Button Not Configured', {
          hasBackBtn: !!backBtn,
          hasKitContext: !!kitContext,
          hasKitUrl: kitContext?.kitUrl
        });
      }
      
      lockScroll(state);
      requestAnimationFrame(() => {
        state.desktopSpotlight.overlay.classList.add('is-visible');
      });
    } else {
      // Mobile spotlight - FIXED: Bootstrap kit context before opening spotlight
      // This ensures the same state structure as desktop direct entry
      
      // #region agent log H6
      logMobile({hypothesisId:'H6',location:'openSpotlightForTilePermalink:mobile-branch',message:'Mobile branch - bootstrapping state',data:{hasAdjacent:!!(tileData.adjacentTiles&&tileData.adjacentTiles.length),adjacentCount:tileData.adjacentTiles?tileData.adjacentTiles.length:0,hasKitContext:!!kitContext}});
      // #endregion agent log H6
      
      // PHASE 1: Populate allItems from adjacentTiles (SAME as desktop line 5484-5506)
      if (tileData.adjacentTiles && Array.isArray(tileData.adjacentTiles)) {
        logMobile({hypothesisId:'MOBILE_BOOTSTRAP',location:'openSpotlightForTilePermalink:populate-allItems',message:'Populating allItems from adjacentTiles',data:{count:tileData.adjacentTiles.length}});
        
        const adjacentItems = tileData.adjacentTiles.map(adjTile => ({
          id: adjTile.id,
          type: adjTile.type,
          url: adjTile.url,
          permalink: adjTile.permalink || '',
          title: adjTile.title || '',
          filename: adjTile.filename || '',
          createdAt: adjTile.created || '',
          width: adjTile.width || 0,
          height: adjTile.height || 0,
          originalAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
          masonryAspectRatio: (adjTile.height && adjTile.width) ? adjTile.height / adjTile.width : 1.5,
          gridUrl: adjTile.gridUrl || adjTile.url,
          webUrl: adjTile.webUrl || adjTile.url,
          originalUrl: adjTile.originalUrl || adjTile.url,
          previewSrc: adjTile.previewSrc || adjTile.gridUrl || adjTile.url,
          poster: adjTile.poster || '',
          src720: adjTile.src720 || '',
          src360: adjTile.src360 || '',
          srcOriginal: adjTile.srcOriginal || adjTile.url,
        }));
        
        state.allItems = adjacentItems;
        state.activeItems = adjacentItems;
        
        logMobile({hypothesisId:'MOBILE_BOOTSTRAP',location:'openSpotlightForTilePermalink:allItems-populated',message:'allItems populated',data:{allItemsCount:state.allItems.length,currentTileId:item.id}});
      } else {
        // Fallback: single item only
        state.allItems = [item];
        state.activeItems = [item];
        
        logMobile({hypothesisId:'MOBILE_BOOTSTRAP',location:'openSpotlightForTilePermalink:fallback-single',message:'No adjacentTiles, using single item',data:{itemId:item.id}});
      }
      
      // PHASE 2: Add kitContext to state for close behavior (back button navigation)
      if (kitContext) {
        state.kitContext = kitContext;
        logMobile({hypothesisId:'MOBILE_BOOTSTRAP',location:'openSpotlightForTilePermalink:kitContext-set',message:'kitContext added to state',data:{kitId:kitContext.kitId,kitUrl:kitContext.kitUrl}});
      }
      
      // Call openSpotlight with skipAnimation=true (no tile element, direct URL mode)
      logMobile({hypothesisId:'MOBILE_BOOTSTRAP',location:'openSpotlightForTilePermalink:calling-openSpotlight',message:'Calling openSpotlight',data:{allItemsCount:state.allItems.length,hasKitContext:!!state.kitContext,skipAnimation:true}});
      openSpotlight(state, null, item, true);
    }
    
    console.log('[Tile Permalink] Spotlight opened successfully');
  };
  
})();
