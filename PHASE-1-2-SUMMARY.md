# TILE NAVIGATION FIX - PHASE 1 & 2 SUMMARY

**Date:** February 3, 2026  
**Status:** Phase 1 & 2 Complete  
**Files Changed:** 1 (gallery.js)  
**Test Plan:** See `PHASE-1-2-TEST-PLAN.md`

---

## PROBLEM RESTATEMENT

Your tile-to-tile navigation breaks after 2-3 clicks because:

1. **No persistent gallery state** - Each tile navigation is a full page reload that loses context
2. **Right column empties** - After tile 1 → tile 2 → tile 3, right column tiles disappear
3. **Back button breaks** - Browser back leads to "black page with white bar" 
4. **Direct URLs fail** - Opening `/tile/photo-5/?kit=123` in fresh window shows empty right column

**Root Cause:** Every right-column click does `window.location.href = permalink` (full page reload) with no state preservation. After 2-3 reloads, the PHP-side `adjacentTiles` data becomes incomplete or JS state initialization fails.

---

## ARCHITECTURE INSIGHT

### Current (Broken) Flow:
```
Gallery Page → Tile 1 Permalink → (reload) → Tile 2 Permalink → (reload) → Tile 3 Permalink
                ↓                              ↓                              ↓
         PHP loads tiles               PHP loads tiles?              PHP fails to load?
         JS creates state              JS creates state?             JS state broken → empty
```

### Desired (Pinterest-like) Flow:
```
Gallery Page → Tile 1 Spotlight (SPA) → Tile 2 Spotlight (SPA) → Tile 3 Spotlight (SPA)
      ↓                                                                      ↓
  Cache kit context                                              Reuse cached context
  (all tiles metadata)                                          (no server round-trip)
```

**Key Difference:** Pinterest doesn't reload the page when you click right-column tiles. It's an SPA (single-page app) that updates the URL and swaps content using cached gallery data.

---

## WHAT WAS IMPLEMENTED (Phase 1 & 2)

### Phase 1: Debug Logging (Observability)

**Added:** `logNav()` function that logs navigation events to browser console when `?abu_pg_debug=1` is in URL.

**Log Points:**
- Spotlight initialization from tile permalink
- Kit context caching
- Adjacent tiles processing
- Right column rendering (including when it's empty)
- Right column tile clicks
- Back button setup and clicks

**Why:** This lets you SEE exactly:
- How many tiles are being passed from PHP → JS
- When the right column goes empty (and why)
- What happens at each navigation step
- Whether cache is working

**How to Use:**
1. Add `?abu_pg_debug=1` to any gallery or tile URL
2. Open browser console (F12)
3. Click tiles and watch logs appear
4. Each log shows: timestamp, context, and relevant data

### Phase 2: GalleryStateManager (Caching)

**Added:** Singleton object `window.abuPgGalleryState` that caches kit contexts.

**Cache Storage:**
- **In-memory:** JavaScript `Map` for fast access during session
- **SessionStorage:** Automatic mirroring for persistence across page reloads
- **Metadata only:** Stores tile IDs + minimal metadata, NO heavy HTML

**API Methods:**
```javascript
// Check if kit is cached
window.abuPgGalleryState.hasKit(kitId) → true/false

// Get cached kit
window.abuPgGalleryState.getKit(kitId) → { kitId, kitUrl, tiles: [...] }

// Store kit (automatic on tile permalink load)
window.abuPgGalleryState.setKit(kitId, kitContext)

// Bootstrap if missing (Phase 4 implementation)
window.abuPgGalleryState.ensureKit(kitId) → Promise<kitContext>

// Clear cache (useful for testing)
window.abuPgGalleryState.clear()
```

**When Cache is Populated:**
- Automatically when a tile permalink page loads with `?kit=` parameter
- Stores: kit ID, kit URL, and ALL tile metadata from `adjacentTiles` array

**Cache Lifetime:**
- In-memory cache: Lasts until page/tab close
- SessionStorage mirror: Survives page reloads, cleared when browser closes

---

## HOW IT HELPS (Today)

### Before These Changes:
- ❌ No visibility into why navigation breaks
- ❌ No way to check if PHP is sending data correctly
- ❌ No way to preserve kit context across reloads
- ❌ Had to guess where the problem was

### After Phase 1 & 2:
- ✅ Console logs show EXACTLY where it breaks
- ✅ Can verify if PHP `adjacentTiles` is empty or not
- ✅ Kit context is cached and survives page reloads
- ✅ Can inspect cache state via `window.abuPgGalleryState`
- ✅ Ready for Phase 3 (SPA navigation)

**Important:** Navigation still breaks the same way (full page reloads), BUT now you can SEE why it breaks and the infrastructure for fixing it is in place.

---

## FILES CHANGED

### `/app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`

**Line ~158-167:** Added `logNav()` debug helper
```javascript
const logNav = (context, data) => {
  if (!window.abuPgDebug || !window.abuPgDebug.enabled) {
    return;
  }
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, context, ...data };
  console.log(`[NAV DEBUG] ${context}:`, logEntry);
};
```

**Line ~4244-4334:** Added `GalleryStateManager` singleton
```javascript
const GalleryStateManager = {
  cache: new Map(),
  hasKit(kitId) { ... },
  getKit(kitId) { ... },
  setKit(kitId, kitContext) { ... },
  async ensureKit(kitId, options) { ... },
  clear() { ... }
};
window.abuPgGalleryState = GalleryStateManager;
```

**Line ~4252:** Modified `openSpotlightForTilePermalink()` to:
- Log initialization details
- Cache kit context via `GalleryStateManager.setKit()`

**Line ~2745:** Added log to right column tile click handler
**Line ~4350:** Added log to adjacent tiles processing  
**Line ~4395:** Added log to right column rendering  
**Line ~4410:** Added log to back button setup/click  

**Total Changes:** ~150 lines added (mostly GalleryStateManager + logs)

---

## HOW TO TEST

See complete test plan in `PHASE-1-2-TEST-PLAN.md`.

**Quick Test (2 minutes):**

1. Go to your Content Kit gallery page
2. Add `?abu_pg_debug=1` to URL
3. Open browser console (F12)
4. Click a tile
5. **Look for:** `[NAV DEBUG]` logs in console
6. Type: `window.abuPgGalleryState.hasKit(YOUR_KIT_ID)`
7. **Expected:** Returns `true` (cache is working)

**Bug Reproduction (5 minutes):**

1. Gallery → click tile 1
2. Note `totalAllItems` count in console log
3. Click tile 2 from right column (page reloads)
4. Note `totalAllItems` count again
5. Click tile 3 from right column (page reloads)
6. **Expected Bug:** Right column is empty
7. **Check Log:** `[NAV DEBUG] Right Column Empty: { totalAllItems: 1, reason: '...' }`

This tells us EXACTLY why it's empty.

---

## WHAT'S NEXT (Phase 3-6)

### Phase 3: SPA-Style Navigation
**Goal:** Right column clicks DON'T reload page

**Implementation:**
- Intercept right-column tile clicks
- Use `history.pushState()` to update URL
- Render new spotlight using cached kit context
- No more `window.location.href = permalink`

**Result:** User can click tile1 → tile2 → tile3 → tile4 → ... (unlimited) without page reloads

### Phase 4: Bootstrap Strategy
**Goal:** Direct tile URLs work correctly

**Implementation:**
- When tile permalink loads, check: `GalleryStateManager.hasKit(kitId)`
- If NOT cached: Fetch kit context from WordPress (lightweight AJAX)
- Populate cache, then render spotlight
- Right column always has tiles

**Result:** Opening `/tile/photo-5/?kit=123` in fresh window shows full right column

### Phase 5: Popstate Handler
**Goal:** Back/forward buttons work correctly

**Implementation:**
- Add `window.addEventListener('popstate', handler)`
- On back: Re-render previous spotlight from cache (no reload)
- On forward: Re-render next spotlight from cache (no reload)
- No more "black page with white bar"

**Result:** Back button works like Pinterest (smooth, no reload)

### Phase 6: Performance Windowing
**Goal:** Memory-efficient for large galleries

**Implementation:**
- Keep full tile metadata in cache (lightweight)
- Render only ±10-20 tiles around current tile in right column
- As user navigates, update window dynamically
- No memory leaks, optimized DOM

**Result:** Works smoothly even with 1000+ tile galleries

---

## ROLLBACK INSTRUCTIONS

If anything breaks, rollback is simple:

```bash
cd /Users/danielodegaard/Local Sites/abu-dev
git checkout app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js
```

**Safe to Deploy:**
- No database changes
- No PHP changes
- Only client-side JavaScript
- Additive changes (doesn't break existing code)
- Can remove `GalleryStateManager` and `logNav()` without side effects

---

## TECHNICAL NOTES

### Why sessionStorage (not localStorage)?
- **SessionStorage** clears when browser/tab closes (good for cache invalidation)
- **LocalStorage** persists forever (bad if Content Kit is updated)
- User edits kit → closes tab → reopens → wants fresh data
- SessionStorage gives us "session-scoped cache" automatically

### Why Map (not plain object)?
- `Map` preserves insertion order
- Better performance for frequent get/set
- Cleaner API (has/get/set/delete)
- Can use non-string keys (though we stringify kitId for consistency)

### Why metadata only (no HTML)?
- sessionStorage has 5-10MB limit per domain
- Storing HTML for 100 tiles = exceeds quota
- Storing tile IDs + URLs = ~1KB per kit
- Can render HTML on-demand from metadata

### Why this approach vs. alternatives?
**Alternative 1: Hidden gallery in DOM**
- Pros: Simple state management
- Cons: Heavy DOM, hard to lazy load

**Alternative 2: Virtual gallery (JS only)**
- Pros: Lightweight DOM, easy lazy load
- Cons: Complex state management

**Our Approach: Hybrid (metadata in JS, render on-demand)**
- Pros: Lightweight, manageable complexity, reuses existing render functions
- Cons: Slightly more complex than hidden DOM

---

## SUCCESS CRITERIA (Phase 1 & 2 Only)

### ✅ What Should Work Now
1. Debug logs appear when `?abu_pg_debug=1` is present
2. Kit context is cached on tile permalink load
3. Cache persists across page reloads
4. Can inspect cache via `window.abuPgGalleryState`
5. Logs reveal exactly where/why navigation breaks

### ❌ What Still Needs Fixing (Phase 3-6)
1. Right column clicks still cause full page reload
2. Right column still empties after 2-3 clicks
3. Back button still causes full page reload
4. Direct tile URLs may still show empty right column

---

## PLAN OF ATTACK CHECKLIST

- [x] Phase 1: Debug logging infrastructure
- [x] Phase 2: GalleryStateManager singleton
- [ ] Phase 3: SPA-style right column navigation
- [ ] Phase 4: Bootstrap for direct tile URLs
- [ ] Phase 5: Popstate handler for back/forward
- [ ] Phase 6: Performance windowing

**Status:** Phases 1 & 2 complete. Ready for testing. Awaiting your go-ahead before implementing Phase 3-6.

---

## WHAT I NEED FROM YOU

1. **Test the debug logging:**
   - Visit gallery with `?abu_pg_debug=1`
   - Click through tile1 → tile2 → tile3
   - Copy/paste console logs into response

2. **Verify cache is working:**
   - After clicking a tile, run: `window.abuPgGalleryState.hasKit(kitId)`
   - Report: Does it return `true`?

3. **Reproduce the bug:**
   - Follow "Bug Reproduction" steps above
   - Report: At which tile does right column go empty?
   - Report: What does the log say? (totalAllItems count, reason)

4. **Direct tile URL test:**
   - Open `/tile/some-tile/?kit=123&abu_pg_debug=1` in fresh incognito window
   - Report: Is right column populated?
   - Report: What's the `adjacentTilesCount` in the log?

Once you report back, I'll implement Phase 3-6 in a single batch.

---

**IMPORTANT:** Do NOT edit WEEK-3-BUILD.md or any documentation. This is code-only session as requested.

**COMPLETED:** Phase 1 & 2  
**NEXT:** Awaiting your test results before proceeding to Phase 3-6
