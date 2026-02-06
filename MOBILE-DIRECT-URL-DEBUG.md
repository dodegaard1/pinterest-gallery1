# Mobile Direct URL Debug Plan

**Date:** February 3, 2026  
**Issue:** Direct visits to `/tile/slug/?kit=123` on mobile show spotlight UI shell but media is blank

## Changes Made (Step C: Debug Logs)

Added temporary debug logging guarded by `window.ABU_DEBUG === true` in `gallery.js`:

### 1. Entry Point Logging (`openSpotlight`)
**Location:** Line ~1795  
**Logs:**
- Entry mode (tap-open vs direct-open)
- Item object keys
- Critical URL fields: `previewSrc`, `gridUrl`, `webUrl`
- Device/viewport info

### 2. Item Construction Logging (`createTileElement`)
**Location:** Line ~2406  
**Logs:**
- What data `createTileElement` receives
- All URL fields being passed to the renderer
- Video poster URLs

### 3. Image URL Selection Logging
**Location:** Line ~2447  
**Logs:**
- Which URL is selected for spotlight rendering (`webUrl` fallback chain)
- Whether `data-src` will be set (lazy-load placeholder)

### 4. Active Slide Media State Logging
**Location:** Line ~1884  
**Logs (runs after slide creation):**
- Image `src`, `data-src`, `currentSrc` attributes
- Video `src`, `currentSrc`, `poster` attributes
- **Mixed content warnings:**
  - HTTPS page loading HTTP media
  - localhost/127.0.0.1 URLs (fail on iPhone tunnel)
  - Cross-origin URLs (different hostname)

## Testing Instructions

### Enable Debug Mode
Add this to browser console or inject via template:
```javascript
window.ABU_DEBUG = true;
```

### Test Scenarios

**Scenario A: Tap from Masonry (Working Baseline)**
1. Visit Content Kit gallery on iPhone
2. Open console (if possible via Safari Desktop → Develop menu)
3. Tap any tile from masonry
4. Check logs for `[ABU_DEBUG] openSpotlight:entry` with `mode: "tap-open"`
5. Verify `previewSrc`, `gridUrl`, `webUrl` are populated

**Scenario B: Direct URL (Broken)**
1. Copy tile permalink: `/tile/slug/?kit=123`
2. Paste in new Safari Private tab on iPhone
3. Check logs for `[ABU_DEBUG] openSpotlight:entry` with `mode: "direct-open"`
4. Compare URL fields with Scenario A - are they different?
5. Check `[ABU_DEBUG] createTileElement:image-url-selection` - is `selectedUrl` valid?
6. Check `[ABU_DEBUG] openSpotlight:active-slide-media` - is `imgSrc` set?
7. **Critical:** Check for warnings array - any mixed content or localhost issues?

### Expected Findings

**If bug is data shape:**
- Scenario B logs will show `previewSrc: "MISSING"` or `webUrl: "MISSING"`
- Root cause: PHP `abu_pg_get_tile_metadata()` not returning complete data
- Fix location: `abu-pinterest-gallery.php` line ~1870-2032

**If bug is hydration:**
- Scenario B logs will show URLs are present but `imgSrc: ""` (empty)
- Root cause: `createTileElement` not setting `src` for direct-open context
- Fix location: `gallery.js` line ~2476 (spotlight image rendering)

**If bug is tunnel/mixed content:**
- Scenario B logs will show warnings like:
  - `"Mixed content: HTTPS page loading HTTP image"`
  - `"Localhost image URL (may fail on iPhone tunnel)"`
- Root cause: Media URLs use `http://` or `localhost` but page is `https://` tunnel URL
- Fix location: WordPress site URL settings or tunnel configuration

## Step D: The Fix (After Identifying Root Cause)

### Added Lazy-Load Hydration (Lines ~1887-1930)

**Why:** Even though `createTileElement` sets `img.src` for spotlight context (line 2476), if the URL is missing from the item object, the image will be blank. The hydration code ensures that if `data-src` exists but `src` doesn't, we force hydration.

**What it does:**
1. After `createTileElement` creates the slide content
2. Check if `<img>` has `data-src` but no `src` (lazy-load not triggered)
3. Manually set `src = data-src` and remove `data-src` attribute
4. Same for `srcset` and `sizes`
5. For videos: check `data-src-720`, `data-src-360`, `data-src-original` and call `video.load()`

**This is Pinterest-style:** Ensures direct-open path executes the same "finalize" steps as tap-open, without creating duplicate UI.

## Next Steps

1. Test on iPhone 14 Safari with debug enabled
2. Analyze console logs to confirm root cause
3. If it's data shape issue, fix PHP side
4. If it's hydration issue, the fix is already in place
5. If it's mixed content, fix tunnel/site URL configuration

## Cleanup

After bug is fixed and verified:
- Remove all `if (window.ABU_DEBUG === true)` blocks
- Remove hydration code if it turns out to be unnecessary
- Keep only the actual fix based on root cause analysis
