# Mobile Spotlight Image Direct URL Fix

**Date:** February 3, 2026  
**Issue:** Direct visits to `/tile/slug/?kit=123` on iPhone show spotlight shell but IMAGE media is blank

## Root Cause Analysis

### Current Image Flow

**Masonry Tiles:**
- Use `item.gridUrl` + `item.gridSrcset` (optimized for grid display)
- Lazy-load with IntersectionObserver

**Spotlight (Tap-from-Masonry):**
1. Main `<img>` element gets `item.webUrl` (high-res, line 2655)
2. Poster `<img class="abu-pg-spotlight-poster">` gets `item.previewSrc || item.url` (line 2725)
3. Poster sits on top with `z-index: 2`, `opacity: 1`
4. Promise chain: `waitForImageReady() → waitForImagePaint() → waitForFrames(2) → markReady()`
5. `markReady()` adds `is-image-painted` class → poster fades to `opacity: 0`

### The Bug

**Problem 1: PHP Missing previewSrc**
- `abu_pg_get_tile_metadata()` returns `gridUrl`, `webUrl`, `originalUrl`
- Does NOT return `previewSrc` field
- JavaScript expects `previewSrc` for the poster preview image
- Falls back to `item.url` (scaled version)

**Problem 2: Image Sources**
From debug logs:
- Main image: `item.webUrl` = `Lindsay-and-Joe-914-2048x1365.jpg` ✅
- Poster: `item.url` = `Lindsay-and-Joe-914-scaled.jpg` ✅
- Poster opacity after markReady: `"0"` ✅

**Problem 3: WHY IS SCREEN STILL BLANK?**
- Poster fades to opacity 0 ✅
- Main image has valid src ✅
- Main image loads successfully (`imgComplete: true`, `naturalWidth: 2048`) ✅
- But `mainImgClientWidth` from last log is still needed

## Debug Evidence

### Log Sequence (iPhone Safari, Direct URL)

1. **openSpotlight:entry** - mode: "direct-open" ✅
2. **createTileElement:image-url-selection** - selectedUrl valid ✅
3. **createTileElement:image-loaded** - complete: true, naturalWidth: 2048 ✅
4. **openSpotlight:image-geometry** - hasPoster: true, posterOpacity: "1", tileHasReadyClass: false ❌
5. **markReady-called** - imgComplete: true ✅
6. **markReady-complete** - posterOpacityAfter: "0", tileHasPaintedClass: true ✅

**Missing:** Main image dimensions after markReady completes

## Tasks

### 1. Complete Current Investigation
- Get final log values for `mainImgClientWidth/Height` after markReady
- Determine if main image has dimensions when poster fades

### 2. Fix PHP Data Shape
Add `previewSrc` field to `abu_pg_get_tile_metadata()`:
```php
// In abu-pinterest-gallery.php, ~line 2022-2024
$tile_data['gridUrl']     = $image_variants['grid_url'];     // For masonry
$tile_data['webUrl']      = $image_variants['web_url'];      // For spotlight main
$tile_data['previewSrc']  = $image_variants['grid_url'];     // For spotlight preview (USE SAME AS MASONRY)
$tile_data['originalUrl'] = $image_variants['original_url'];
```

### 3. Refactor Spotlight Image Rendering
Remove dependency on poster lifecycle:

**Current (Broken for Direct URL):**
- Main image set to `item.webUrl`
- Poster created and covers main image
- Wait for main image to load/paint
- Then fade poster out
- **BUG:** If poster isn't created properly, main image never revealed

**Fixed Approach:**
- Main image always set immediately (both tap and direct)
- Use `img.decode()` to detect when ready
- Poster is optional enhancement, not required
- If poster exists, fade it when main is ready
- If no poster, main image shows immediately

### 4. Code Changes Needed

**gallery.js `createTileElement()` spotlight section:**
```javascript
// BEFORE: Main image waits for poster lifecycle
img.src = imageUrl;
waitForImageReady(img, 'full')
  .then(() => waitForImagePaint(img, 'full'))
  .then(() => waitForFrames(2))
  .then(() => {
    markReady(); // Adds is-image-painted to fade poster
  });

// AFTER: Main image independent of poster
img.src = imageUrl;
img.style.opacity = '0'; // Start hidden
img.decode()
  .catch(() => new Promise(resolve => img.addEventListener('load', resolve)))
  .then(() => {
    img.style.opacity = '1';
    img.style.transition = 'opacity 300ms ease';
    tile.classList.add('is-image-ready');
    tile.classList.add('is-image-painted'); // Fades poster if it exists
  });
```

## Next Steps

1. Get final log data showing main image dimensions after poster fades
2. Implement PHP fix to add `previewSrc = gridUrl` 
3. Simplify spotlight image reveal logic (remove poster dependency)
4. Test both tap-open and direct-URL paths
5. Verify no regressions in swipe navigation
