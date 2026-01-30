# ABU Pinterest Gallery - Project Documentation

**Version:** 0.1.0  
**Last Updated:** January 30, 2026  
**Status:** ✅ Production Ready (Core features complete)

---

## Project Overview

A custom WordPress plugin that renders media galleries in a Pinterest-style masonry feed with a highly polished, fast, and mobile-first UI. The plugin handles mixed media (images and videos) at scale with efficient rendering, custom video controls, and a smooth mobile spotlight experience.

### Original Project Goal

Build a custom WordPress plugin that renders galleries in a Pinterest-like masonry feed with a highly polished, fast, and mobile-first UI: images and videos load efficiently at scale (hundreds/thousands of items) using chunked rendering and lazy loading; videos play inline with no native controls and only custom UI (mute/unmute, play/pause behaviors, download/share); on mobile, tapping an item opens a smooth Pinterest-style spotlight/lightbox transition that preserves scroll position and overlays the same controls; and a separate "Video Behavior by ABU" plugin powers an FFmpeg-based pipeline that generates poster frames and multiple playback renditions (e.g., 720p/360p), stores them as clean attachment metadata/sidecar files in uploads, and exposes status/debug info in the WP admin—while keeping everything self-contained (no third-party frontend libraries/CDNs), maintainable, and forward-compatible with future features like filtering, sorting, and chapters.

---

## Core Features

### 1. Masonry Gallery Layout
- Pinterest-style masonry grid using JavaScript positioning (`transform: translate()`)
- Responsive column layout (mobile forces 2 columns)
- Stable layout with no content jumps during load
- Container height dynamically adjusts to tallest column

### 2. Performance & Optimization
- **Chunked Rendering**: Initial ~120 items, then ~60-item chunks
- **Lazy Loading**: Images use `loading="lazy"` + IntersectionObserver; videos load on demand
- **Adaptive Video Quality**: Connection API detection (2g/3g → 360p, desktop → 720p)
- **Efficient at Scale**: Handles hundreds/thousands of items smoothly

### 3. Video Functionality
- Custom video UI (no native controls)
- Inline playback with play/pause toggle
- Mute/unmute with smooth volume ramping
- Hover-to-play on desktop (when allowed)
- Multiple renditions support (360p, 720p, original)
- Poster frame display before playback
- Integration with "Video Behavior by ABU" plugin for FFmpeg processing

### 4. Mobile Spotlight View
- Fullscreen overlay with smooth FLIP animation
- White backdrop with gradual crossfade
- Crisp full-resolution content display
- Scroll position preservation
- Back button and overlay-click to close
- Background scroll locking (iOS-optimized)
- **WebKit Flash Fix**: GPU-accelerated rendering with iOS-specific scroll handling

### 5. Chapter-Based Organization
- Multiple chapters per gallery with sticky navigation
- Smooth scrolling with nav offset
- Active chapter highlighting via IntersectionObserver
- Independent masonry grid per chapter
- Keyboard navigation and ARIA labels

### 6. Admin Experience
- **ABU Gallery Maker Block**: Gutenberg block for chapter management
- Two-column editor UI (chapter sidebar + media management)
- Drag-and-drop media reordering
- WordPress Media Library integration
- Data stored as JSON in post meta (`abu_pg_chapters_json`)

### 7. Share & Download
- Desktop: Download button forces file download
- Mobile: Web Share API integration
- Works for both images and videos

---

## Technical Architecture

### Design Constraints
- ✅ No third-party JavaScript libraries (vanilla JS only)
- ✅ No CSS columns (JavaScript masonry only)
- ✅ Self-contained within plugin folder
- ✅ Data-driven rendering for future extensibility
- ✅ No dependencies on other gallery plugins

### File Structure

```
abu-pinterest-gallery/
├── abu-pinterest-gallery.php       # Main plugin file, shortcode, tile rendering
├── gallery-maker/                  # Gutenberg block for admin
│   ├── block.json                  # Block metadata
│   ├── index.php                   # Block registration
│   ├── src/                        # React source files
│   └── build/                      # Compiled block assets
├── assets/
│   ├── js/
│   │   ├── gallery.js              # Frontend masonry, spotlight, video logic
│   │   └── abu-chapters.js         # Chapter navigation behavior
│   ├── css/
│   │   ├── gallery.css             # Gallery layout, tiles, spotlight
│   │   └── abu-chapters.css        # Chapter navigation styles
│   └── icons/radix/*.svg           # SVG icons
├── package.json                    # Build dependencies
└── webpack.config.js               # Build configuration
```

### Data Model

**Chapter Structure** (stored in `abu_pg_chapters_json` post meta):
```json
[
  {
    "id": "ch1",
    "name": "Chapter Name",
    "order": 1,
    "mediaIds": [123, 456, 789]
  }
]
```

**Tile Data Attributes** (rendered per media item):
- `data-id` - Attachment ID
- `data-type` - "image" or "video"
- `data-url` - Original attachment URL
- `data-created` - ISO timestamp
- `data-filename` - File name
- `data-title` - Attachment title
- `data-width` / `data-height` - Media dimensions
- **Video-specific:**
  - `data-src-360` - 360p rendition URL
  - `data-src-720` - 720p rendition URL
  - `data-poster` - Poster image URL

---

## Implementation Log

### ✅ Phase 1: Admin Block Editor (Jan 29, 2026)

**Completed Features:**
- Gutenberg block "ABU Gallery Maker" with chapter management
- Post meta registration with REST API support
- Two-column editor UI (chapters + media)
- Chapter CRUD operations (create, rename, delete)
- Media management (add, reorder, remove)
- JSON data persistence
- Validation warnings for empty chapters
- Security: `edit_posts` capability checks
- Build system with `@wordpress/scripts`

**Files Created:**
- `gallery-maker/block.json`
- `gallery-maker/index.php`
- `gallery-maker/src/` directory
- `gallery-maker/build/` directory

---

### ✅ Phase 2: Chapter-Based Frontend (Jan 29, 2026)

**Completed Features:**
- Sticky chapter navigation (100px desktop, 60px mobile)
- Active chapter highlighting with IntersectionObserver
- Smooth scroll with nav offset compensation
- Reduced-motion support for accessibility
- Chapter section spacing (200px desktop, 120px mobile)
- Multi-grid masonry (independent grid per chapter)
- Legacy code removal (old meta box, admin scripts)
- Chapter-only data source (no fallback to old format)

**Files Created:**
- `assets/css/abu-chapters.css`
- `assets/js/abu-chapters.js`

**Files Modified:**
- `abu-pinterest-gallery.php` - Complete shortcode rewrite

**Styling Updates (Jan 30, 2026):**
- Chapter names: uppercase with letter-spacing
- Navigation: left-aligned layout
- Active state: 3px black underline (not rounded button)
- Inactive chapters: light gray (#bcbcbc)
- Icon templates: moved to wrapper level for multi-chapter support

**Bug Fixes:**
- Fixed icon template race condition for chapter 2+
- Ensured all controls work across multiple chapters
- Improved mobile spotlight poster transition

---

### ✅ Phase 3: iOS Spotlight Flash Fix (Jan 30, 2026)

**Problem:** White flash at start of spotlight animation on iPhone (Safari & Chrome)

**Root Cause:** WebKit compositor glitch triggered by `position: fixed` scroll lock coinciding with overlay animation start

**Solution Implemented:**
- Promoted masonry container to GPU composited layer
- iOS-specific scroll lock using `overflow: hidden` instead of `position: fixed`
- Delayed scroll lock by one animation frame on iOS
- Forced non-white background during spotlight transitions

**Result:** ✅ White flash eliminated on iPhone across all browsers

**Technical Details:**
After 13 different attempts, the solution involved WebKit-specific compositor handling:
1. Keep gallery on GPU to prevent pipeline fallback
2. Avoid `position: fixed` body swap on iOS (known flash trigger)
3. Delay scroll lock by one RAF so first paint completes cleanly
4. Force matching background color during transition

**References:**
- [iOS Safari Composited Layers](https://ryanseddon.com/css/composited-layers-ios/)
- [WebKit Bug #229403](https://bugs.webkit.org/show_bug.cgi?id=229403)
- [WebKit Bug #229399](https://bugs.webkit.org/show_bug.cgi?id=229399)

---

## Key Behaviors Reference

### Masonry Layout
- Absolute positioning with `transform: translate(x, y)`
- Container height set to tallest column
- Mobile forces 2 columns via JavaScript

### Chunked Rendering
- Initial render: ~120 items
- Subsequent chunks: ~60 items
- IntersectionObserver sentinel triggers next chunk

### Lazy Loading
- **Images**: `loading="lazy"` + `decoding="async"` + IntersectionObserver
- **Videos**: No `src` until user interaction (click to play)

### Video Source Selection
Uses Connection API when available:
- `saveData` or 2g/3g network → 360p
- Small viewport → 720p (if available)
- Desktop → 720p
- Fallback to original if derivatives missing

### Video Playback
- Tap/click toggles play/pause
- Volume toggle uses smooth ramping to reduce audio stutter
- Hover autoplay only when source loaded and allowed

### Spotlight Animation (Mobile)
- FLIP animation using clone for smooth glide
- Clone → full-resolution content swap
- White backdrop crossfade during animation
- Back button + overlay click to close
- iOS-optimized scroll locking

### Share & Download
- Desktop: Download button forces file download
- Mobile: Web Share API for native sharing

---

## Development Guidelines

### "Do Not Do" List
- ❌ Do not reintroduce CSS columns
- ❌ Do not add external JS libraries or CDNs
- ❌ Do not scrape DOM for data (use `allItems` dataset)
- ❌ Do not modify or depend on Modula or other gallery plugins
- ❌ Do not run heavy observers or speed test downloads
- ❌ Do not reparent original tiles (use clones for spotlight)

### Testing Requirements
When making changes:
- Test with both image and video tiles
- Test on mobile (especially iOS Safari/Chrome)
- Verify masonry layout stability
- Check spotlight animation smoothness
- Validate chapter navigation
- Test with large galleries (100+ items)

---

## Future Roadmap

### Potential Enhancements
- Filtering by media type
- Sorting options (date, title, custom)
- Search functionality
- Grid density controls
- Animation preferences
- Keyboard shortcuts
- Admin bulk operations

---

## Integration Notes

### Video Behavior by ABU Plugin
This plugin integrates with the separate "Video Behavior by ABU" plugin for video processing:
- FFmpeg-based pipeline for poster frames and renditions
- Multiple quality outputs (720p, 360p)
- Metadata storage as attachment meta and sidecar files
- Admin status/debug interface

### WordPress Compatibility
- Requires: WordPress 5.8+
- Gutenberg block editor
- REST API for post meta
- Media Library integration

---

## Shortcode Usage

```php
[abu_pinterest_gallery]
```

Place this shortcode on any post or page where you want the gallery to appear. Configure chapters and media using the **ABU Gallery Maker** block in the editor.

---

## Debug Mode

Enable debug mode by adding `?abu_pg_debug=1` to any gallery page URL. This enables:
- Asset cache busting for logged-in users
- Debug logging to `.cursor/debug.log`
- Extended data attributes on tiles

---

## Support & Maintenance

For issues, questions, or feature requests related to this plugin, refer to this documentation and the plugin source code. All functionality is self-contained within the plugin directory.
