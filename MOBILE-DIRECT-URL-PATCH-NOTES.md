# Mobile Direct URL Image Fix - Patch Notes

## Files Changed

### `/app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`

**1. Enhanced Debug Logging** (Lines ~1808-1840)
- Added entry mode tracking (`tap-from-masonry` vs `direct-url`)
- Enhanced `openSpotlight()` logging with warnings for missing URLs
- Added `_entryMode` property to item objects for debugging

**2. Removed 2-Step Image Pipeline** (Lines ~2666-2730)
- **DELETED:** Preview/poster image creation for spotlight images
- **DELETED:** `waitForImageReady()` promise chain gating visibility
- **DELETED:** `markReady()` function that triggers CSS transitions
- **ADDED:** Single-image immediate rendering
- **ADDED:** Optional non-blocking load event listeners

**3. Improved Debug Output** (Lines ~2597-2612, ~1958-2042)
- Enhanced `createTileElement()` entry logging
- Added spotlight-image-setup logging with URL warnings
- Enhanced active-slide-media logging with DOM state

## Changes Summary

### Before (Broken)
```javascript
// Two image elements: preview + final
const poster = createElement('img', 'abu-pg-spotlight-poster');
poster.src = previewSrc; // Low-res

img.src = webUrl; // High-res

// Wait for final image, THEN show it
waitForImageReady(img).then(() => {
  tile.classList.add('is-image-ready'); // Triggers CSS to hide preview
});
```

### After (Fixed)
```javascript
// ONE image element
img.src = webUrl; // High-res immediately
img.loading = 'eager';
img.setAttribute('fetchpriority', 'high');

// Remove preview/poster (don't use it)
existingPoster?.remove();

// Mark visible immediately (no gating)
tile.classList.add('is-image-ready');
tile.classList.add('is-image-painted');
```

## Why This Fixes Mobile Direct URLs

1. **No more gating:** Image visibility is no longer dependent on preview lifecycle
2. **Immediate rendering:** Image src is set synchronously when slide is created
3. **Unified pipeline:** Both tap-from-masonry and direct-url use identical code path
4. **Simpler logic:** Removed complex promise chains and CSS transition dependencies

## Desktop Impact

✅ **None** - Desktop uses separate rendering path (`renderDesktopSpotlightMedia`) which was not modified.

## Verification

Enable debug mode and check console for:
```javascript
[ABU_DEBUG] openSpotlight:entry { entryMode: 'direct-url', ... }
[ABU_DEBUG] createTileElement:spotlight-image-setup { imageUrl: '...', ... }
[ABU_DEBUG] openSpotlight:active-slide-media { imgSrc: '...', imgComplete: true, ... }
```

If `imgSrc` is populated and `imgComplete: true`, the fix is working.
