## Project Brief — ABU Pinterest Gallery

### Purpose & UX Goals
- Provide a Pinterest-style masonry gallery for posts/pages via `[abu_pinterest_gallery]`.
- Support mixed media (images + MP4 videos) with custom video UI.
- Mobile spotlight view with FLIP animation and crisp, non-scaled controls.
- Smooth scrolling and stable layout (no jumps while media loads).

### Explicit Constraints
- No third‑party JS libraries; vanilla JS/CSS only.
- Runs entirely inside this plugin folder.
- Avoid CSS columns for layout (use JS masonry).
- Compatible with future filters/chapters/search (data-driven rendering).
- Must not depend on Modula or other gallery plugins.

### Current File Map
- `abu-pinterest-gallery.php`
  - Plugin bootstrap, admin metabox, shortcode renderer.
  - Outputs gallery markup + data attributes for each item.
- `assets/js/gallery.js`
  - Frontend logic: data model, chunked rendering, masonry layout, lazy loading,
    video source selection, spotlight overlay with FLIP animation.
- `assets/js/admin-media.js`
  - Admin media picker for attachment selection and ordering.
- `assets/css/gallery.css`
  - Gallery layout, tile styling, overlay controls, spotlight styles.
- `assets/css/admin.css`
  - Admin metabox UI styles.
- `assets/icons/radix/*.svg`
  - SVG icons used by `your_plugin_icon()` helper.

### Data Model (per media item)
Each tile is built from data attributes in `abu-pinterest-gallery.php`.
- `id`: attachment ID
- `type`: `image` or `video`
- `url`: original attachment URL
- `createdAt`: ISO timestamp (`data-created`)
- `filename`: attachment filename (`data-filename`)
- `title`: attachment title (`data-title`)
- `width` / `height`: media dimensions (images from attachment metadata;
  videos from `_abu_video_derivatives` when available)
- Video derivatives (when `_abu_video_derivatives.status === "ready"`):
  - `poster` (poster image URL)
  - `src360` (360p MP4)
  - `src720` (720p MP4)
  - `srcOriginal` (original MP4)

### Key Behaviors
- **Masonry layout**
  - Absolute positioning with `transform: translate(x, y)`.
  - Container height set to tallest column.
  - Mobile forces 2 columns (JS).
- **Chunked rendering**
  - Initial render ~120 items; append in ~60-item chunks.
  - IntersectionObserver sentinel triggers additional chunk render.
- **Lazy loading**
  - Images: `data-src` until near viewport (IntersectionObserver);
    `loading="lazy"`, `decoding="async"`.
  - Videos: no `src` until user clicks play (no prewarm by default).
- **Video source selection**
  - Uses Connection API if available:
    - `saveData` or `2g/3g` -> 360p
    - small viewport -> 720p if available
    - desktop -> 720p
  - Falls back to original if derivatives missing.
- **Video playback rules**
  - Tap/Click toggles play/pause.
  - Volume toggle uses volume ramp to reduce stutter.
  - Hover autoplay only when source is loaded and allowed.
- **Spotlight (mobile)**
  - Fullscreen overlay with white fade.
  - FLIP animation using a clone for glide, then swap to a crisp full‑res tile.
  - Back button inside tile; overlay click closes.
  - Background scroll locked/restored.
- **Share / Download**
  - Desktop: Download button forces download.
  - Mobile: Save button triggers Web Share API.

### “Do Not Do” List
- Do not reintroduce CSS columns.
- Do not add external JS libraries.
- Do not scrape DOM for data (use `allItems` dataset).
- Do not modify or depend on Modula or other gallery plugins.
- Do not run heavy observers or speed test downloads.
- Do not alter layout by reparenting original tiles (use clones for spotlight).
