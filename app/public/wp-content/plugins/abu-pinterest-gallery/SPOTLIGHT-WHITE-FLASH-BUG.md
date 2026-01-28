# Spotlight View White Flash Bug

## Problem Summary
When a user taps on a gallery tile to open it in spotlight view, there's an unwanted white flash that appears during the opening animation. This disrupts the visual experience and makes the transition feel jarring instead of smooth.

---

## Current Behavior (What's Happening Now)

1. **User taps a tile** in the masonry gallery
2. **White flash occurs** - At the very beginning of the animation, the entire masonry background suddenly disappears and is replaced with a solid white background
3. **Background reappears** - About 1/4 of the way through the animation (as the tile is growing/moving toward spotlight view), the masonry background becomes visible again
4. **Crossfade plays** - After the background reappears, a smooth transition/crossfade from the visible masonry grid to a fully white background plays correctly

**In simple terms:** The animation looks like it "stutters" at the start - the background disappears completely (white flash), then comes back, and then fades to white properly.

---

## Desired Behavior (What Should Happen)

1. **User taps a tile** in the masonry gallery
2. **Tile begins growing** smoothly toward spotlight view position
3. **Gradual crossfade** - As the tile moves and grows, the masonry background should gradually and smoothly fade from visible to white throughout the entire animation
4. **No white flash** - The background should never suddenly disappear or appear; it should only smoothly fade

**In simple terms:** The animation should be completely smooth from start to finish, with the background gently fading to white as the tile grows, without any sudden changes.

---

## Technical Observations

### The Crossfade Already Exists
It appears that the desired crossfade animation is already implemented and working correctly. However, it only begins **after** the white flash has already occurred. This suggests the issue is related to the timing or sequencing of visual elements at the very start of the animation.

### Differences Between Media Types
Tiles do represent various media types which are handled differently and correspond to video-behavior-by-abu.php
- **Photo tiles** (images)
- **Video tiles** (videos with poster images)

**Important:** Any fix must work correctly for **both** media types. Testing should verify that the white flash is eliminated for both photos and videos.

---

## What Needs to Be Fixed

The goal is to eliminate the white flash so that:
1. The masonry background stays visible from the moment the user taps
2. The background begins its crossfade to white immediately (not after 1/4 of the animation)
3. The entire transition feels smooth and intentional

---

## Important Constraints

⚠️ **Before making major changes:**
- This plugin's spotlight functionality is currently working except for this white flash issue
- Any proposed changes that would significantly restructure how the spotlight animation works should be explained in detail first
- The user should understand what's being modified and why before implementation

⚠️ **Testing requirements:**
- Test with photo tiles
- Test with video tiles
- Verify the white flash is gone in both cases
- Ensure the smooth crossfade works throughout the entire animation

---

## Files to Investigate

The spotlight animation is likely controlled by JavaScript and CSS in:
- `/assets/js/gallery.js` - JavaScript that handles the spotlight view logic and animation
- `/assets/css/gallery.css` - CSS that defines the spotlight styles and transitions

---

## Additional Context

- The gallery is a Pinterest-style masonry layout
- Users can click on tiles to view them in a larger "spotlight" view
- The spotlight view includes a white background (which is intentional)
- The fade to white is part of the design - we just need to eliminate the premature white flash

---

## Success Criteria

✅ The fix is successful when:
1. User taps a tile and the animation begins smoothly
2. The masonry background remains visible at the start of the animation
3. The background gradually fades to white throughout the tile's growth animation
4. No sudden white flash or background disappearance occurs
5. Both photo tiles and video tiles behave correctly
6. The spotlight view still functions as expected after the animation completes

---

## Attempted Fixes (Unsuccessful)

### Attempt 1: Delay Backdrop Fade Until Content Ready
**Hypothesis**: The white flash occurs because the backdrop fades to white before the spotlight content is ready.

**Implementation**:
- Added new CSS class `.is-backdrop-visible` to control backdrop fade separately from overlay visibility
- Modified JavaScript to only add `.is-backdrop-visible` after images are loaded and ready
- Modified `hideClone()` function to trigger backdrop fade when content is ready
- Added backdrop class management to video tiles and `closeSpotlight()`

**CSS Changes**:
```css
/* Split backdrop control from overlay visibility */
.abu-pg-spotlight.is-backdrop-visible .abu-pg-spotlight-backdrop {
  background: rgba(255, 255, 255, 1);
}
```

**JavaScript Changes**:
- Line ~757: Added `overlay.classList.add('is-backdrop-visible')` before hiding clone
- Line ~788: Added same logic for video tiles
- Line ~440: Added `overlay.classList.remove('is-backdrop-visible')` in closeSpotlight

**Result**: ❌ Did not fix the white flash. Instead, the backdrop fade was delayed until AFTER the tile growth animation completed, which was not the desired behavior. The crossfade should happen DURING the tile growth, not after.

---

### Attempt 2: Remove Overlay Opacity Transition
**Hypothesis**: The overlay's opacity transition is causing the white flash by revealing elements during its fade-in.

**Implementation**:
- Removed `transition: opacity 220ms ease` from `.abu-pg-spotlight`
- Kept the overlay opacity properties (0 → 1) but without transition

**CSS Changes**:
```css
.abu-pg-spotlight {
  /* Removed: transition: opacity 220ms ease; */
  opacity: 0;
  pointer-events: none;
}
```

**Result**: ❌ Did not fix the white flash. Additionally, this broke the backdrop fade - the backdrop never became visible because it remained controlled by the overlay's opacity. The tile just hovered in front of the fully visible masonry with no white background at all.

---

### Attempt 3: Remove Overlay Opacity Entirely
**Hypothesis**: Any opacity control on the overlay (even without transition) affects the backdrop visibility.

**Implementation**:
- Removed `opacity` property entirely from `.abu-pg-spotlight`
- Overlay is now always visible, only `pointer-events` toggles between none/auto

**CSS Changes**:
```css
.abu-pg-spotlight {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  /* Removed: opacity: 0; */
}

.abu-pg-spotlight.is-visible {
  pointer-events: auto;
  /* Removed: opacity: 1; */
}
```

**Result**: ❌ Did not fix the white flash. The backdrop fade now works correctly (smooth transition during tile growth), but the white flash at the very beginning of the animation still occurs.

---

## Current Status

The white flash issue persists. The backdrop fade timing is now correct (synchronized with tile growth animation), but something at the very start of the animation is causing the masonry background to suddenly disappear and be replaced with white, before coming back and then fading properly.

### Attempt 4: Double RequestAnimationFrame for Clone Paint
**Hypothesis**: The clone needs to be fully painted/rendered by the browser before the backdrop transition begins. A single RAF might not be enough.

**Implementation**:
- Wrapped the animation start code in a double `requestAnimationFrame`
- First RAF allows clone to be appended to DOM
- Second RAF ensures clone is painted before `.is-visible` is added

**JavaScript Changes** (line ~680):
```javascript
lockScroll(state);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    // ... transform clone
  });
});
```

**Result**: ❌ Did not fix the white flash. No visible change in behavior - the white flash still occurs at the very beginning of the animation.

---

### Attempt 5: Create Backdrop After Clone
**Hypothesis**: The white flash occurs because the backdrop is created before the clone, leading to a frame where only the backdrop exists.

**Implementation**:
- Modified `createSpotlight()` to NOT create the backdrop initially (only creates empty overlay)
- Backdrop is now created AFTER the clone is appended to the overlay
- Backdrop is inserted before the clone using `insertBefore()` to maintain proper z-index stacking
- This ensures the clone exists in the DOM before the backdrop

**JavaScript Changes**:
- Line ~413: Removed backdrop creation from `createSpotlight()`
- Line ~665-676: Added backdrop creation after clone is appended:
```javascript
overlay.appendChild(clone);
// ... set state properties
const backdrop = document.createElement('div');
backdrop.className = 'abu-pg-spotlight-backdrop';
overlay.insertBefore(backdrop, clone);
state.spotlight.backdrop = backdrop;
lockScroll(state);
```

**Result**: ❌ Did not fix the white flash. No visible change in behavior - the white flash still occurs at the very beginning of the animation.

---

### Attempt 6: Multiple Fixes for Background/Transparency Issues
**Hypothesis**: The white flash might be caused by unintentional white backgrounds showing through - either from the clone, overlay, or body element.

**Implementation**:
- Removed `background: transparent` from `.abu-pg-spotlight-clone` to let it inherit the tile's gray background (#f0f0f1)
- Added explicit `background: transparent` to `.abu-pg-spotlight` overlay
- Modified `lockScroll()` to preserve the body's current background color when applying `position: fixed`
- Modified `unlockScroll()` to reset the background color

**CSS Changes**:
```css
.abu-pg-spotlight {
  /* Added: */
  background: transparent;
}

.abu-pg-spotlight-clone {
  /* Removed: background: transparent; */
}
```

**JavaScript Changes** (line ~391-410):
```javascript
const lockScroll = (state) => {
  // ...
  const currentBg = window.getComputedStyle(document.body).backgroundColor;
  document.body.style.position = 'fixed';
  // ...
  if (currentBg && currentBg !== 'rgba(0, 0, 0, 0)') {
    document.body.style.backgroundColor = currentBg;
  }
};
```

**Result**: ❌ Did not fix the white flash. No visible change in behavior - the white flash still occurs at the very beginning of the animation.

---

### Attempt 7: Delay Overlay DOM Insertion Until Animation Start
**Hypothesis**: The white flash might be caused by the overlay being in the DOM too early, causing intermediate paint/render frames with visual glitches.

**Implementation**:
- Modified `createSpotlight()` to NOT append the overlay to the body immediately
- Overlay, clone, and backdrop are all built in memory first
- The complete overlay structure is only appended to `document.body` right before the animation starts (after lockScroll, before RAF)
- This ensures everything is built as a complete structure before any DOM insertion

**JavaScript Changes**:
- Line ~413: Removed `document.body.appendChild(overlay)` from `createSpotlight()`
- Line ~682: Added `document.body.appendChild(overlay)` after lockScroll but before RAF:
```javascript
lockScroll(state);
document.body.appendChild(overlay);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    // ... start animation
  });
});
```

**Result**: ❌ Did not fix the white flash. No visible change in behavior - the white flash still occurs at the very beginning of the animation.

---

### Attempt 8: Transition Backdrop Opacity Instead of Background Color
**Hypothesis**: The white flash is caused by the browser repainting a background-color transition on the backdrop, producing a single fully-white frame before the compositor catches up. Fading opacity should stay on the compositor and avoid the flash.

**Implementation**:
- Backdrop now has a constant white background
- Crossfade is driven by `opacity` instead of `background`
- Added `will-change: opacity` to encourage compositing

**CSS Changes**:
```css
.abu-pg-spotlight-backdrop {
  background: #fff;
  opacity: 0;
  transition: opacity 320ms ease;
  will-change: opacity;
}

.abu-pg-spotlight.is-visible .abu-pg-spotlight-backdrop {
  opacity: 1;
}
```

**Result**: ❌ Did not fix the white flash. No visible change in behavior - the white flash still occurs at the very beginning of the animation.

---

### Attempt 9: Debug Instrumentation (Masonry + Script Load)
**Goal**: Switch to debug mode and collect runtime evidence for the white flash. Initial run unexpectedly broke the masonry layout (only 1 tile visible), so instrumentation expanded to diagnose why `gallery.js` was not executing.

**Implementation**:
- Added JS instrumentation around spotlight open and masonry layout to log to the debug endpoint
- Added PHP debug logs for shortcode render, asset enqueue, and parsed IDs
- Added inline debug ping to report gallery markup, tile count, and whether `gallery.js` ran
- Added footer log to confirm `wp_footer` runs
- Added logs to capture the enqueued `gallery.js` src and client-side script tag src

**Key Findings from Logs**:
- Shortcode renders with 38 IDs and assets are enqueued successfully
- `wp_footer` fires
- Gallery markup exists with 38 tiles and non-zero width
- `gallery.js` script tag appears **after** load, but `gallery.js` does **not** execute (`window.abuPgGalleryLoaded` stays `no`)
- Masonry JS never runs, leaving only one visible tile

**Result**: ❌ White flash not addressed. Debug run blocked due to missing `gallery.js` execution. User will roll back the plugin to its original state (start of project) before continuing white flash investigation.

---

### Attempt 10: Force Compositor Layers for Spotlight Elements
**Hypothesis**: iOS Safari is dropping the spotlight elements into the software paint pipeline for one frame. Forcing the overlay, backdrop, clone, and content into their own composited layers may avoid the flash and also reduce the thumbnail/full-res swap gap.

**Implementation**:
- Added `transform: translateZ(0)` and `backface-visibility: hidden` to spotlight layers
- Added `will-change` hints for opacity/transform/border-radius

**CSS Changes**:
```css
.abu-pg-spotlight {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: opacity;
}

.abu-pg-spotlight-backdrop {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: opacity, background;
}

.abu-pg-spotlight-clone {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: transform, opacity, border-radius;
}

.abu-pg-spotlight-content {
  transform: translateZ(0);
  backface-visibility: hidden;
  will-change: opacity, border-radius;
}
```

**Result**: ⏳ Pending real-device test.

---

### Attempt 11: Crossfade Clone to Spotlight Content
**Hypothesis**: The visible gap between preview and full-res is caused by the spotlight content being painted a frame later. Fading the content in while the clone remains visible should make the swap seamless and may also mask the white flash.

**Implementation**:
- Spotlight content starts at `opacity: 0`
- When the spotlight image is ready, content fades to `opacity: 1`
- Clone is hidden one frame after content is visible

**JS Changes**:
```javascript
content.style.opacity = '0';
content.style.transition = 'opacity 180ms ease';
// ...
markSpotlightReady();
requestAnimationFrame(() => {
  hideClone();
});
```

**Result**: ❌ No visible improvement. White flash persists and thumbnail/full-res gap remains.

---

### Attempt 12: Real iPhone Cross-Browser + Live Site Validation
**Goal**: Determine whether the white flash is tied to the local tunnel, private browsing, or a specific WordPress instance by testing on real iPhone hardware across browsers and environments.

**Implementation / Tests**:
- Opened the page in mobile Safari (normal browsing tab) via the Local WP tunnel
- Opened the page in mobile Chrome (normal and private windows) via the Local WP tunnel
- Exported the plugin and hosted it on a live WordPress site (no SSL), then visited the page on mobile Safari and mobile Chrome

**Result**: ❌ White flash still occurs on the real iPhone across multiple browsers and across multiple WordPress instances over HTTP. The issue appears specific to real iPhone hardware rather than the local tunnel, private browsing mode, or a particular WP install.

---

### Attempt 13: WebKit-Friendly Composition + Scroll Lock Adjustments
**Goal**: Reduce compositor glitches on iOS WebKit by keeping the masonry grid on the GPU and avoiding large scroll-lock reflows during the first animation frame.

**Implementation**:
- Promote the masonry container to a composited layer to keep it in the GPU pipeline
- Add an iOS-only scroll-lock path using `overflow: hidden` and touchmove prevention instead of body `position: fixed`
- Delay scroll locking by one extra animation frame on iOS so the first paint happens before any layout shift
- Ensure the page background is explicitly non-white while spotlight is open

**Result**: ✅ SUCCESS. White flash is gone on real iPhone in Safari and Chrome.

**Why this worked (plain English):**
On iPhone, the browser uses WebKit and is very sensitive to how layers are painted when an overlay animates in. We were accidentally forcing a big layout change at the exact moment the animation started (locking scroll by switching the body to `position: fixed`). That can cause iOS to briefly "drop" the background and repaint it as white for a frame. We fixed this by:

- **Keeping the gallery on the GPU** so it doesn’t fall out of the render pipeline during the animation.
- **Avoiding the body `position: fixed` swap on iOS**, which is a known trigger for single‑frame flashes.
- **Delaying scroll‑lock on iOS by one extra animation frame**, so the first frame of the animation paints cleanly before any layout change happens.
- **Forcing a non‑white background while spotlight is open**, so if WebKit does a brief repaint, it matches the gallery background instead of white.

---

## WebKit/iOS Evidence & Notes
These references document WebKit compositing behavior and animation timing issues that can produce single-frame flashes when composited overlays animate over non-composited content. Chrome on iOS uses WebKit, so the same behavior is expected in both Safari and Chrome.

- Composited vs non-composited layer flash behavior (iOS Safari): https://ryanseddon.com/css/composited-layers-ios/
- WebKit bug: composited animation delays on iOS: https://bugs.webkit.org/show_bug.cgi?id=229403
- WebKit bug: composited and non-composited animations can be unsynced: https://bugs.webkit.org/show_bug.cgi?id=229399

## WebKit Spotlight Flash Fix (Summary)
The fix is intentionally minimal and WebKit-friendly to preserve the existing UX:

- Keep the gallery container composited during the animation.
- Avoid switching the body to `position: fixed` on iOS (use `overflow: hidden` instead).
- Delay scroll lock by one extra frame on iOS so the first paint completes cleanly.
- Force a non-white background during spotlight to prevent a white flash if WebKit repaints.

## Summary of Investigation

After 11 different attempts to fix the white flash issue, the root cause has not been identified. The attempts covered:
1. Delaying backdrop fade until content is ready
2. Removing/modifying overlay opacity transitions
3. Removing overlay opacity entirely
4. Double RAF for paint timing
5. Creating backdrop after clone
6. Fixing background/transparency issues
7. Delaying overlay DOM insertion
8. Transitioning backdrop opacity instead of background color
9. Debug instrumentation (blocked by gallery.js not executing)
10. Forcing compositor layers on spotlight elements
11. Crossfading clone to spotlight content

**Rollback Note**: User will roll back to the original working code (pre-attempts) before continuing further investigation.

The white flash persists in all cases. The issue appears to be deeply rooted in how the browser renders the initial frames of the spotlight animation. Further investigation may require:
- Browser DevTools performance profiling
- Paint flashing analysis
- Frame-by-frame recording of the animation
- Different browser testing to see if it's browser-specific
- Investigating if it's related to hardware acceleration or compositing layers

**Next Steps**: Need to investigate other potential causes:
- Clone creation and initial rendering
- Initial backdrop state before animation starts
- Z-index stacking context issues
- Browser paint timing issues
- Other elements that might be covering the masonry during initial frames
