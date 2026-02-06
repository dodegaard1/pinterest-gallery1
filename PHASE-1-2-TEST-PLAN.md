# PHASE 1 & 2 TEST PLAN
## Tile Navigation Architecture - Debug & Cache Implementation

**Date:** February 3, 2026  
**Status:** Phase 1 & 2 Complete - Ready for Testing  
**Next:** Phase 3-6 (SPA Navigation, Bootstrap, Popstate, Windowing)

---

## WHAT WAS IMPLEMENTED

### Phase 1: Observability + Debug Logging
- ✅ Added `logNav()` function that logs to browser console when `?abu_pg_debug=1` is in URL
- ✅ Log points added at:
  - Spotlight initialization from tile permalink
  - Adjacent tiles processing
  - Right column rendering
  - Right column tile clicks
  - Back button setup and clicks
- ✅ All logs include timestamps and relevant context data

### Phase 2: GalleryStateManager Singleton
- ✅ Created `window.abuPgGalleryState` singleton object
- ✅ In-memory cache using JavaScript `Map`
- ✅ SessionStorage mirroring (automatic, metadata only)
- ✅ API methods:
  - `hasKit(kitId)` - Check if kit is cached
  - `getKit(kitId)` - Retrieve cached kit context
  - `setKit(kitId, kitContext)` - Store kit context
  - `ensureKit(kitId, options)` - Get or bootstrap kit (Phase 4 placeholder)
  - `clear()` - Clear all caches
- ✅ Cache populated when tile permalink page loads with kit context

---

## FILES CHANGED

### 1. `/app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`

**Changes:**
- Line ~158: Added `logNav()` debug logging helper
- Line ~4244-4334: Added `GalleryStateManager` singleton implementation
- Line ~4252: Modified `openSpotlightForTilePermalink()` to:
  - Log initialization data
  - Cache kit context via `GalleryStateManager.setKit()`
- Line ~2745: Added logging to right column tile click handler
- Line ~4350: Added logging to adjacent tiles processing
- Line ~4395: Added logging to right column rendering
- Line ~4410: Added logging to back button setup/click

**Why:** These changes add observability and persistent kit context caching without breaking existing functionality.

---

## MANUAL TEST PLAN

### Prerequisites
1. Have a Content Kit with at least 10 tiles published
2. Know the kit URL (e.g., `/content-kit/test-kit/`)
3. Have browser dev console open (to see logs)

### Test Scenario A: Enable Debug Mode
**Goal:** Verify debug logging is working

1. Visit your Content Kit gallery page
2. Add `?abu_pg_debug=1` to the URL (e.g., `/content-kit/test-kit/?abu_pg_debug=1`)
3. Open browser console (F12 or Cmd+Option+I)
4. Click any tile to open spotlight
5. **Expected:** You should see console logs like:
   ```
   [NAV DEBUG] Spotlight Init from Permalink: { timestamp, tileId, hasKitContext, ... }
   [NAV DEBUG] Processing Adjacent Tiles: { adjacentCount, ... }
   [NAV DEBUG] Rendering Right Column: { totalAllItems, adjacentCount, ... }
   ```

### Test Scenario B: Cache Population (First Visit)
**Goal:** Verify kit context is cached on first tile permalink load

1. With `?abu_pg_debug=1` still active
2. Click a tile in the gallery (opens spotlight)
3. Look for this log in console:
   ```
   [NAV DEBUG] GalleryStateManager.setKit: { kitId, kitUrl, tileCount }
   ```
4. In console, type: `window.abuPgGalleryState.hasKit(YOUR_KIT_ID)`
   - Replace `YOUR_KIT_ID` with actual kit ID (check logs)
5. **Expected:** Returns `true`
6. In console, type: `window.abuPgGalleryState.getKit(YOUR_KIT_ID)`
7. **Expected:** Returns object with:
   ```javascript
   {
     kitId: 123,
     kitUrl: "http://yoursite.local/content-kit/test-kit/",
     tiles: [...], // Array of tile objects
     cachedAt: 1234567890
   }
   ```

### Test Scenario C: Cache Persistence (Right Column Navigation)
**Goal:** Verify cache survives page reloads (via sessionStorage)

1. With spotlight open from Scenario B
2. Note the current tile ID from logs
3. Click a tile in the right column
4. **Current Behavior (not fixed yet):** Full page reload to tile permalink
5. **Expected Logs After Reload:**
   ```
   [NAV DEBUG] Spotlight Init from Permalink: { ... }
   [NAV DEBUG] GalleryStateManager.setKit: { ... }
   ```
6. In console, verify cache still exists:
   ```javascript
   window.abuPgGalleryState.hasKit(YOUR_KIT_ID) // Should return true
   ```

### Test Scenario D: Right Column Click Logging
**Goal:** Identify when right column clicks trigger full page reload

1. Open gallery → click tile 1 (spotlight opens)
2. In console, you should see: `[NAV DEBUG] Spotlight Init from Permalink`
3. Click tile 2 in right column
4. **Watch for this log:**
   ```
   [NAV DEBUG] Right Column Tile Click: { clickedTileId, hasPermalink, permalink }
   ```
5. **Expected Current Behavior:** Full page reload happens (white flash, new URL)
6. **Note for Phase 3:** This is where we'll intercept and use SPA navigation instead

### Test Scenario E: Deep Navigation (Reproduce the Bug)
**Goal:** Reproduce the "empty right column after tile 3" bug

1. Start at gallery page (with `?abu_pg_debug=1`)
2. Click tile 1 → Spotlight opens
3. Look at console: How many items in `totalAllItems`?
4. Click tile 2 from right column → Page reloads
5. Look at console: How many items in `totalAllItems`?
6. Click tile 3 from right column → Page reloads
7. Look at console: How many items in `totalAllItems`?
8. **Expected Bug:** By tile 3 or 4, right column is empty
9. **Check logs for:**
   ```
   [NAV DEBUG] Right Column Empty: { totalAllItems: 1, reason: 'allItems.length <= 1' }
   ```
   OR
   ```
   [NAV DEBUG] Rendering Right Column: { totalAllItems: 0, adjacentCount: 0 }
   ```

**What This Tells Us:**
- If `totalAllItems` decreases with each navigation, the `adjacentTiles` data from PHP is incomplete
- If `adjacentTiles` count is 0, PHP function `abu_pg_get_all_tiles_from_kit()` is failing

### Test Scenario F: Direct Tile URL (Fresh Window)
**Goal:** Test bootstrap when opening tile permalink directly

1. Copy a tile permalink URL (e.g., `/tile/photo-5/?kit=123&abu_pg_debug=1`)
2. Open in a **new incognito/private window** (fresh sessionStorage)
3. Open dev console
4. Paste URL and press Enter
5. **Expected Logs:**
   ```
   [NAV DEBUG] Spotlight Init from Permalink: { tileId, hasKitContext: true, adjacentTilesCount: X }
   [NAV DEBUG] Processing Adjacent Tiles: { adjacentCount: X }
   [NAV DEBUG] GalleryStateManager.setKit: { kitId, tileCount: X }
   [NAV DEBUG] Rendering Right Column: { totalAllItems: X, adjacentCount: Y }
   ```
6. **If right column is empty:**
   - Check if `adjacentTilesCount: 0` in first log
   - This means PHP `abu_pg_get_all_tiles_from_kit()` returned empty array

### Test Scenario G: Back Button Logging
**Goal:** Identify what happens when back button is clicked

1. Open gallery → tile 1 → tile 2
2. You're now on tile 2 permalink page
3. Click the back button in spotlight (top-left arrow)
4. **Watch for log:**
   ```
   [NAV DEBUG] Back Button Clicked: { navigatingTo: "kit URL" }
   ```
5. **Expected Current Behavior:** Full page reload to gallery
6. **Note:** Phase 5 will make this use `history.back()` instead

---

## DEBUG COMMANDS (Browser Console)

### Check Cache Status
```javascript
// Check if kit is cached
window.abuPgGalleryState.hasKit(123)

// Get kit context
window.abuPgGalleryState.getKit(123)

// View all cached kits
window.abuPgGalleryState.cache

// Clear cache
window.abuPgGalleryState.clear()
```

### Check SessionStorage
```javascript
// View stored kit data
sessionStorage.getItem('abu_pg_kit_123')

// Parse it
JSON.parse(sessionStorage.getItem('abu_pg_kit_123'))

// Clear it
sessionStorage.removeItem('abu_pg_kit_123')
```

---

## EXPECTED OUTCOMES (Phase 1 & 2 Only)

### ✅ What Should Work
1. Debug logs appear in console when `?abu_pg_debug=1` is present
2. Kit context is cached on first tile permalink load
3. Cache persists across page reloads (via sessionStorage)
4. You can inspect cache state via `window.abuPgGalleryState`
5. Logs reveal exactly where navigation breaks

### ❌ What Still Breaks (Will Fix in Phase 3-6)
1. Right column clicks still cause full page reload
2. Right column still becomes empty after 2-3 navigations
3. Back button still causes full page reload
4. Direct tile URLs may still show empty right column
5. No SPA-like navigation yet

---

## WHAT TO REPORT BACK

After running tests, please provide:

1. **Console Log Output** from Scenario E (deep navigation test)
   - Copy/paste the full log sequence from tile 1 → tile 2 → tile 3
   
2. **When Right Column Goes Empty**
   - What tile number does it break on?
   - What does `totalAllItems` count show at that point?
   - Is `adjacentTilesCount` 0 in the initial log?

3. **Direct URL Test Result** (Scenario F)
   - Does right column populate on fresh window?
   - What's the `adjacentTilesCount` in the log?

4. **Any JavaScript Errors**
   - Red errors in console?
   - Failed fetch requests?
   - Missing functions?

---

## ROLLBACK SAFETY

### If Something Breaks
The changes are minimal and additive. To revert:

1. **Quick Rollback:**
   ```bash
   cd /Users/danielodegaard/Local Sites/abu-dev
   git checkout app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js
   ```

2. **Function-Level Rollback:**
   - The `GalleryStateManager` object is self-contained (lines ~4244-4334)
   - The `logNav()` function is self-contained (lines ~158-167)
   - These can be deleted without affecting other code
   - Removing them will just disable caching/logging

3. **Safe to Test:**
   - No database changes
   - No PHP changes
   - Only JavaScript (client-side)
   - Won't break production if deployed

---

## NEXT STEPS (After Testing)

Once you confirm Phase 1 & 2 are working:

1. ✅ Debug logs are visible
2. ✅ Cache is populated
3. ✅ We can see where navigation breaks

Then I'll implement:

**Phase 3:** SPA-style right column navigation (no page reload)  
**Phase 4:** Bootstrap strategy for direct tile URLs  
**Phase 5:** Popstate handler for back/forward buttons  
**Phase 6:** Dynamic tile windowing for performance  

---

## QUESTIONS TO ANSWER FROM LOGS

1. **Is PHP returning empty adjacentTiles?**
   - Look for: `adjacentTilesCount: 0` in logs
   - If yes → PHP function `abu_pg_get_all_tiles_from_kit()` is broken
   - If no → JS state management is broken

2. **Does cache survive page reloads?**
   - After right column click (page reload), run: `window.abuPgGalleryState.hasKit(kitId)`
   - If true → sessionStorage is working
   - If false → sessionStorage is disabled or quota exceeded

3. **Where exactly does right column become empty?**
   - Track `totalAllItems` count across navigations: tile1 → tile2 → tile3
   - If it decreases → Each page load has less data
   - If it's 1 from the start → PHP never sent adjacentTiles

---

**Ready for Testing!**

Enable `?abu_pg_debug=1` and start clicking tiles. Report back what you see in the console.
