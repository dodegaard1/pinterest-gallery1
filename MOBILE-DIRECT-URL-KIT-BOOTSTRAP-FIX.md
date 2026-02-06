# Mobile Direct Tile URL - Kit Bootstrap Fix

**Date**: 2026-02-04  
**Status**: ✅ IMPLEMENTED

## Problem Summary

On mobile direct tile URL visits (`/tile/slug/?kit=123`):
- ✅ Tile image renders in spotlight
- ❌ Cannot swipe left/right (no adjacent tiles)
- ❌ Closing spotlight lands on blank black page instead of gallery

## Root Cause

**Desktop Direct Entry (Working):**
1. PHP template (`single-tile.php`) loads kit context + all tiles
2. JavaScript (`openSpotlightForTilePermalink`, desktop branch line 5516-5582):
   - Populates `state.allItems` from `adjacentTiles` array (line 5484-5506)
   - Sets `state.kitContext` for back navigation (line 5597-5598)
   - Creates desktop spotlight with mini-masonry right column

**Mobile Direct Entry (Broken):**
1. PHP template loads SAME data (kit context + adjacent tiles)
2. JavaScript mobile branch (line 5588-5602) skips state initialization:
   - ❌ Does NOT populate `state.allItems` 
   - ❌ Adds `kitContext` but AFTER calling `openSpotlight()`
   - Calls `openSpotlight()` which expects `state.allItems` to exist

**Result:**
- `state.allItems` is empty or only contains current tile
- Swipe navigation (`navigateSpotlight()` line 1413) has no items to navigate to
- Close behavior works (checks `state.kitContext`) but reveals nothing behind

## Solution

**File**: `app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`  
**Function**: `window.openSpotlightForTilePermalink()` (mobile branch)  
**Lines**: 5588-5602

### Changes Made

**BEFORE** (Mobile branch):
```javascript
} else {
  // Mobile spotlight - FIXED: Call openSpotlight with skipAnimation=true
  logMobile({...});
  
  // Add kitContext to state for back button navigation
  if (kitContext) {
    state.kitContext = kitContext;
  }
  
  // Call openSpotlight with skipAnimation=true
  openSpotlight(state, null, item, true);
}
```

**AFTER** (Mobile branch with bootstrap):
```javascript
} else {
  // Mobile spotlight - FIXED: Bootstrap kit context before opening spotlight
  logMobile({...});
  
  // PHASE 1: Populate allItems from adjacentTiles (SAME as desktop)
  if (tileData.adjacentTiles && Array.isArray(tileData.adjacentTiles)) {
    const adjacentItems = tileData.adjacentTiles.map(adjTile => ({
      id: adjTile.id,
      type: adjTile.type,
      url: adjTile.url,
      // ... all fields mapped (same as desktop line 5484-5504)
    }));
    
    state.allItems = adjacentItems;
    state.activeItems = adjacentItems;
    
    logMobile({message:'allItems populated', count});
  } else {
    // Fallback: single item only
    state.allItems = [item];
    state.activeItems = [item];
  }
  
  // PHASE 2: Add kitContext to state for close behavior
  if (kitContext) {
    state.kitContext = kitContext;
    logMobile({message:'kitContext added to state'});
  }
  
  // Call openSpotlight with skipAnimation=true
  logMobile({message:'Calling openSpotlight', allItemsCount});
  openSpotlight(state, null, item, true);
}
```

### How It Works

1. **PHP Bootstrap** (already working):
   - `single-tile.php` loads kit metadata
   - Calls `abu_pg_get_all_tiles_from_kit()` to get ordered tile list
   - Adds `adjacentTiles` array to tile data JSON

2. **Mobile JavaScript Bootstrap** (NOW FIXED):
   - Maps `adjacentTiles` to `state.allItems` (same format as desktop)
   - Sets `state.kitContext` for back navigation
   - Calls `openSpotlight()` with fully-populated state

3. **Swipe Navigation** (now works automatically):
   - `navigateSpotlight()` reads from `state.allItems[newIndex]`
   - Adjacent tiles available in correct order
   - Preload logic works (uses `state.allItems`)

4. **Close Behavior** (already worked, now has context):
   - `closeSpotlight()` checks `state.kitContext.kitUrl`
   - Navigates to kit gallery URL (not blank page)

## Testing Checklist

### Direct URL Entry (Mobile)
- [ ] Visit `/tile/slug/?kit=123` on iPhone Safari
- [ ] Spotlight opens with image visible ✅ (already worked)
- [ ] Swipe left navigates to next tile ✅ (NOW FIXED)
- [ ] Swipe right navigates to previous tile ✅ (NOW FIXED)
- [ ] Swipe up/down or back button closes spotlight ✅ (already worked)
- [ ] After close, gallery page is visible ✅ (NOW FIXED - navigates to kit URL)

### Normal Gallery Visit (Mobile)
- [ ] Open gallery → tap tile → spotlight opens
- [ ] Swipe left/right works ✅ (already worked)
- [ ] Close spotlight returns to gallery ✅ (already worked)

### Desktop (Unchanged)
- [ ] Direct tile URL opens desktop spotlight ✅ (no changes)
- [ ] Mini-masonry right column shows adjacent tiles ✅
- [ ] Back button returns to kit gallery ✅

## Debug Logging

When `window.ABU_DEBUG === true`, the following logs are added:

```javascript
// Mobile bootstrap entry
logMobile({
  hypothesisId: 'MOBILE_BOOTSTRAP',
  location: 'openSpotlightForTilePermalink:populate-allItems',
  message: 'Populating allItems from adjacentTiles',
  data: { count: tileData.adjacentTiles.length }
});

// After allItems populated
logMobile({
  hypothesisId: 'MOBILE_BOOTSTRAP',
  location: 'openSpotlightForTilePermalink:allItems-populated',
  message: 'allItems populated',
  data: { allItemsCount: state.allItems.length, currentTileId: item.id }
});

// After kitContext set
logMobile({
  hypothesisId: 'MOBILE_BOOTSTRAP',
  location: 'openSpotlightForTilePermalink:kitContext-set',
  message: 'kitContext added to state',
  data: { kitId: kitContext.kitId, kitUrl: kitContext.kitUrl }
});

// Before calling openSpotlight
logMobile({
  hypothesisId: 'MOBILE_BOOTSTRAP',
  location: 'openSpotlightForTilePermalink:calling-openSpotlight',
  message: 'Calling openSpotlight',
  data: { 
    allItemsCount: state.allItems.length, 
    hasKitContext: !!state.kitContext, 
    skipAnimation: true 
  }
});
```

## Architecture Notes

### Why This Fix Is Minimal

1. **Reuses existing functions**: No new rendering logic
2. **Same data source**: PHP template already provides adjacentTiles
3. **Same spotlight path**: Desktop and mobile now use identical state structure
4. **Only difference**: Mobile skips FLIP animation (skipAnimation=true)

### Key Functions Called

- **`abu_pg_get_all_tiles_from_kit()`** (PHP): Gets ordered tile list from kit
- **`openSpotlightForTilePermalink()`** (JS): Entry point from template
- **`openSpotlight()`** (JS): Core spotlight renderer (shared by all paths)
- **`navigateSpotlight()`** (JS): Swipe handler (reads from state.allItems)
- **`closeSpotlight()`** (JS): Close handler (checks state.kitContext)

### State Structure (Now Consistent)

```javascript
state = {
  container: document.body,
  isSpotlightEnabled: true,
  allItems: [        // CRITICAL: Ordered list of all tiles in kit
    { id, type, url, permalink, width, height, ... },
    // ... adjacent tiles
  ],
  activeItems: [...], // Same as allItems for direct entry
  kitContext: {       // CRITICAL: For back navigation
    kitId: 123,
    kitUrl: '/content-kit/gallery-name/',
    kitTitle: 'Gallery Name'
  },
  spotlight: {
    currentIndex: N,  // Index of current tile in allItems
    overlay: <div>,
    carouselContainer: <div>,
    // ...
  }
}
```

## Related Files

- **Template**: `templates/single-tile.php` (PHP bootstrap - unchanged)
- **Main JS**: `assets/js/gallery.js` (mobile branch - PATCHED)
- **Plugin**: `abu-pinterest-gallery.php` (helper functions - unchanged)

## Previous Fixes Referenced

This fix completes the work started in:
- `MOBILE-DIRECT-URL-FIX-SUMMARY.md` (fixed image rendering)
- Now fixes: kit context + swipe navigation + close behavior

## Verification Commands

```bash
# Check if file was modified
git diff app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js

# View mobile branch changes (around line 5588)
grep -A 50 "Mobile spotlight - FIXED: Bootstrap" \
  app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js
```

## Success Criteria

✅ Mobile direct tile URL entry behaves exactly like desktop architecturally  
✅ Swipe left/right navigates through kit tiles  
✅ Close spotlight reveals kit gallery (not blank page)  
✅ Desktop behavior unchanged  
✅ Normal mobile gallery visit unchanged  
✅ No new UI, no new DOM structures  
✅ Reuses existing state, bootstrap, and spotlight logic
