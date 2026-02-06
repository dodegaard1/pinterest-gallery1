# Mobile Direct URL Fix - Technical Call Chain

## Problem → Solution

**Problem**: Mobile direct URL (`/tile/slug/?kit=123`) had:
- Empty `state.allItems` → no swipe navigation
- Missing gallery context → blank page on close

**Solution**: Bootstrap `state.allItems` from `adjacentTiles` **BEFORE** calling `openSpotlight()`

## Call Chain (Mobile Direct Entry)

### 1. PHP Bootstrap (Template)
```
single-tile.php:14-64
├── Get kit_id from ?kit= parameter
├── abu_pg_parse_chapters($chapters_json)
├── abu_pg_get_all_tiles_from_kit($kit_id)      ← Returns ordered array of ALL kit tiles
├── abu_pg_find_tile_in_chapters($tile_id, $chapters)
└── $tile_data['adjacentTiles'] = $adjacent_tiles  ← Available to JavaScript
```

**Output**: JSON in DOM
```html
<script type="application/json" id="abu-pg-tile-data">
{
  "id": 123,
  "type": "image",
  "adjacentTiles": [          ← All kit tiles in order
    { "id": 120, ... },
    { "id": 121, ... },
    { "id": 122, ... },
    { "id": 123, ... },       ← Current tile
    { "id": 124, ... },
    ...
  ]
}
</script>

<script type="application/json" id="abu-pg-kit-context">
{
  "kitId": 456,
  "kitUrl": "/content-kit/gallery-name/",
  "kitTitle": "Gallery Name"
}
</script>
```

### 2. JavaScript Initialization
```
single-tile.php:187-234
├── Parse tileData from DOM
├── Parse kitContext from DOM
└── window.openSpotlightForTilePermalink(tileData, kitContext)
```

### 3. Mobile Branch Bootstrap (NOW FIXED)
```
gallery.js:5588-5643 (openSpotlightForTilePermalink)

IF shouldUseMobileLayout():
  ├── Map tileData.adjacentTiles → state.allItems[]        ← FIX: Now populates!
  │   └── Transform each tile to item format {id, type, url, ...}
  │
  ├── state.kitContext = kitContext                        ← FIX: Now set before!
  │
  └── openSpotlight(state, null, item, skipAnimation=true)
```

### 4. Open Spotlight (Shared Function)
```
gallery.js:1808-2507 (openSpotlight)

├── createSpotlight(state) → Creates overlay + carousel DOM
├── Sort state.allItems by masonry order                   ← Uses populated allItems ✅
├── Find currentIndex in state.allItems                    ← Uses populated allItems ✅
├── state.spotlight.currentIndex = itemIndex
├── createSpotlightSlide(state, item, itemIndex)           ← Current tile slide
│   ├── createTileElement(state, item)
│   └── preloadSpotlightTile(state, item, slide)
│
├── attachSpotlightGestures(state)                         ← Swipe handlers
└── preloadAdjacentTiles(state)                            ← Uses state.allItems ✅
```

### 5. Swipe Navigation (Automatic)
```
gallery.js:1413-1479 (navigateSpotlight)

User swipes left/right:
├── direction = 'next' or 'prev'
├── newIndex = currentIndex ± 1
├── Check bounds: 0 <= newIndex < state.allItems.length    ← Uses allItems ✅
├── Get newItem = state.allItems[newIndex]                 ← Uses allItems ✅
├── createSpotlightSlide(state, newItem, newIndex)
├── Animate transition
└── preloadAdjacentTiles(state)                            ← Preload next neighbors ✅
```

### 6. Close Spotlight (Already Worked)
```
gallery.js:1601-1675 (closeSpotlight)

User swipes up/down or taps back:
├── Check if state.kitContext exists
├── IF state.kitContext.kitUrl:
│   └── window.location.href = state.kitContext.kitUrl     ← Navigate to gallery ✅
└── ELSE:
    └── Remove overlay, restore scroll position
```

## Key Functions Called

| Function | File | Line | Purpose | Uses allItems? |
|----------|------|------|---------|----------------|
| `abu_pg_get_all_tiles_from_kit()` | abu-pinterest-gallery.php | 1829 | Get ordered kit tiles from PHP | - |
| `openSpotlightForTilePermalink()` | gallery.js | 5331 | Entry point from template | ✅ Populates it |
| `openSpotlight()` | gallery.js | 1808 | Core spotlight renderer | ✅ Reads from it |
| `navigateSpotlight()` | gallery.js | 1413 | Swipe handler | ✅ Reads from it |
| `preloadAdjacentTiles()` | gallery.js | 1482 | Preload neighbors | ✅ Reads from it |
| `closeSpotlight()` | gallery.js | 1601 | Close handler | Uses kitContext |

## State Structure

```javascript
state = {
  container: document.body,
  isSpotlightEnabled: true,
  
  // CRITICAL: Ordered list of all kit tiles (NOW POPULATED ✅)
  allItems: [
    { id: 120, type: 'image', url: '...', permalink: '...', width, height, ... },
    { id: 121, type: 'video', url: '...', poster: '...', src720: '...', ... },
    // ...
    { id: 123, ... },  // Current tile (index N)
    { id: 124, ... },
    // ...
  ],
  
  activeItems: [...],  // Same as allItems for direct entry
  
  // CRITICAL: Kit context for back navigation (NOW SET ✅)
  kitContext: {
    kitId: 456,
    kitUrl: '/content-kit/gallery-name/',
    kitTitle: 'Gallery Name'
  },
  
  spotlight: {
    currentIndex: N,              // Index of current tile in allItems
    overlay: <div>,               // DOM element
    carouselContainer: <div>,     // DOM element
    loadedIndices: Set([N]),      // Track which slides are loaded
    isTransitioning: false,
    isDragging: false,
    // ...
  },
  
  templates: { ... },    // Icon templates
  iconTemplates: { ... } // Icon templates
}
```

## Data Flow Diagram

```
PHP Template (single-tile.php)
│
├─ Load Kit Metadata
│  └─ abu_pg_get_all_tiles_from_kit($kit_id)
│     └─ Returns: [tile120, tile121, ..., tile123, ...]
│
├─ Output to DOM
│  ├─ <script id="abu-pg-tile-data">
│  │  └─ { id: 123, adjacentTiles: [...] }
│  └─ <script id="abu-pg-kit-context">
│     └─ { kitId: 456, kitUrl: '...' }
│
└─ Call JS Initializer
   └─ openSpotlightForTilePermalink(tileData, kitContext)
      │
      ├─ IF MOBILE:
      │  │
      │  ├─ state.allItems = tileData.adjacentTiles.map(...)  ← FIX ✅
      │  ├─ state.kitContext = kitContext                      ← FIX ✅
      │  └─ openSpotlight(state, null, item, true)
      │     │
      │     ├─ createSpotlight(state)
      │     ├─ Sort allItems                                    ✅
      │     ├─ Find currentIndex in allItems                    ✅
      │     ├─ Create slide for current tile
      │     ├─ Attach swipe gestures
      │     └─ preloadAdjacentTiles(state)                      ✅
      │        └─ Loads tiles at currentIndex ± 1               ✅
      │
      └─ User Interaction:
         │
         ├─ SWIPE LEFT/RIGHT:
         │  └─ navigateSpotlight(state, direction)
         │     ├─ newIndex = currentIndex ± 1
         │     ├─ Check: 0 <= newIndex < allItems.length        ✅
         │     ├─ newItem = allItems[newIndex]                  ✅
         │     └─ Create + animate to new slide                 ✅
         │
         └─ SWIPE UP/DOWN or BACK:
            └─ closeSpotlight(state)
               └─ window.location.href = kitContext.kitUrl      ✅
```

## Debugging Logs (window.ABU_DEBUG = true)

### Mobile Bootstrap
```javascript
// Entry
logMobile({
  location: 'openSpotlightForTilePermalink:mobile-branch',
  message: 'Mobile branch - bootstrapping state',
  data: { hasAdjacent, adjacentCount, hasKitContext }
});

// Populate allItems
logMobile({
  location: 'openSpotlightForTilePermalink:populate-allItems',
  message: 'Populating allItems from adjacentTiles',
  data: { count: tileData.adjacentTiles.length }
});

logMobile({
  location: 'openSpotlightForTilePermalink:allItems-populated',
  message: 'allItems populated',
  data: { allItemsCount, currentTileId }
});

// Set kitContext
logMobile({
  location: 'openSpotlightForTilePermalink:kitContext-set',
  message: 'kitContext added to state',
  data: { kitId, kitUrl }
});

// Call openSpotlight
logMobile({
  location: 'openSpotlightForTilePermalink:calling-openSpotlight',
  message: 'Calling openSpotlight',
  data: { allItemsCount, hasKitContext, skipAnimation: true }
});
```

### During openSpotlight
```javascript
// After sorting
logMobile({
  location: 'openSpotlight:after-sort',
  message: 'Checking if item exists in allItems',
  data: { itemId, allItemsCount, allItemIds: '...' }
});

// Item found
logMobile({
  location: 'openSpotlight:item-found',
  message: 'Item found, continuing to create spotlight',
  data: { itemIndex, itemId }
});
```

## Expected Debug Output

```
[MOBILE_BOOTSTRAP] Mobile branch - bootstrapping state
  { hasAdjacent: true, adjacentCount: 47, hasKitContext: true }

[MOBILE_BOOTSTRAP] Populating allItems from adjacentTiles
  { count: 47 }

[MOBILE_BOOTSTRAP] allItems populated
  { allItemsCount: 47, currentTileId: 123 }

[MOBILE_BOOTSTRAP] kitContext added to state
  { kitId: 456, kitUrl: '/content-kit/gallery-name/' }

[MOBILE_BOOTSTRAP] Calling openSpotlight
  { allItemsCount: 47, hasKitContext: true, skipAnimation: true }

[openSpotlight] Checking if item exists in allItems
  { itemId: 123, allItemsCount: 47, allItemIds: '120,121,122,123,124,...' }

[openSpotlight] Item found, continuing to create spotlight
  { itemIndex: 25, itemId: 123 }
```

## Files Modified

- `app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js` (lines 5588-5643)

## Files Unchanged (But Critical to Understanding)

- `templates/single-tile.php` (PHP bootstrap already correct)
- `abu-pinterest-gallery.php` (helper functions already correct)
- `gallery.js` (all other functions already correct)

The fix was surgical: **only the mobile branch bootstrap was missing**. All other infrastructure was already in place!
