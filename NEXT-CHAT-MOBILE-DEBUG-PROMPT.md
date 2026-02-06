# Mobile Direct URL Debug - Next Chat Prompt

**Copy this entire prompt into the next chat:**

---

Continue debugging the mobile spotlight bug in my WordPress plugin:

**Current Issue:** Direct visits to `/tile/slug/?kit=123` on iPhone Safari open the spotlight UI shell (white background + buttons visible) but the media inside is blank/invisible. Tap-from-masonry works fine on mobile. Desktop direct URLs work fine.

**What Was Already Done (Previous Chat):**

1. Added debug logging to `gallery.js` guarded by `window.ABU_DEBUG === true`
2. Added lazy-load hydration fix for direct-open path (lines ~1887-1930)
3. Debug logs placed at 4 critical points:
   - `openSpotlight` entry (logs mode, item keys, URL fields)
   - `createTileElement` entry (logs data received)
   - Image URL selection (logs which URL chosen)
   - Active slide media state (logs src attributes + mixed content warnings)

**Current State:**

Files modified in previous session:
- `/app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`
- Created `/MOBILE-DIRECT-URL-DEBUG.md` (testing guide)

**What I Need You To Do:**

## Step 1: Verify Debug Mode Is Active

Add this JavaScript to the mobile tile permalink template to enable debug logging:

**File:** `app/public/wp-content/plugins/abu-pinterest-gallery/templates/single-tile.php`  
**Location:** Before the closing `</script>` tag in the JavaScript section (around line 220-230)

```javascript
// Enable debug mode for mobile spotlight debugging
window.ABU_DEBUG = true;
console.log('[ABU_DEBUG] Debug mode enabled on tile permalink page');
```

## Step 2: Check What Debug Logs Reveal

On iPhone 14 Safari (including Private mode), visit a direct tile URL like:
```
https://your-tunnel-url.local/tile/some-slug/?kit=123
```

Open Safari's Web Inspector (via Mac Safari → Develop menu → iPhone device) and check console for these logs:

### Expected Log Sequence:

1. **`[ABU_DEBUG] Debug mode enabled on tile permalink page`**
   - Confirms debug mode is on

2. **`[ABU_DEBUG] openSpotlight:entry`**
   - Check `mode:` should be `"direct-open"`
   - Check `itemKeys:` what fields does the item object have?
   - **CRITICAL:** Check these fields:
     - `hasPreviewSrc:` true or false?
     - `previewSrc:` URL string or `"MISSING"`?
     - `hasWebUrl:` true or false?
     - `webUrl:` URL string or `"MISSING"`?
     - `hasGridUrl:` true or false?
     - `gridUrl:` URL string or `"MISSING"`?

3. **`[ABU_DEBUG] createTileElement:entry`**
   - Check all the URL fields being passed to renderer
   - Are they valid URLs or missing?

4. **`[ABU_DEBUG] createTileElement:image-url-selection`**
   - Check `selectedUrl:` is it a valid URL?
   - Check `willSetDataSrc:` should be `"yes"` not `"NO - IMAGE WILL BE BLANK"`

5. **`[ABU_DEBUG] openSpotlight:active-slide-media`**
   - Check `imgSrc:` should be a full URL, not empty
   - Check `warnings:` any mixed content issues?
     - `"Mixed content: HTTPS page loading HTTP image"`
     - `"Localhost image URL (may fail on iPhone tunnel)"`
     - `"Cross-origin image: page=X, img=Y"`

## Step 3: Report Findings

Tell me EXACTLY what you see in the logs. Specifically:

**Question A:** Does the item object have URL fields populated?
```
previewSrc: "https://..." ✅ populated
OR
previewSrc: "MISSING" ❌ empty
```

**Question B:** What is `selectedUrl` in image-url-selection log?

**Question C:** What is `imgSrc` in active-slide-media log?

**Question D:** Are there any warnings about mixed content, localhost, or cross-origin?

## Step 4: Fix Based on Findings

### If URLs are MISSING (Questions A/B show "MISSING"):

**Root Cause:** PHP `abu_pg_get_tile_metadata()` not returning complete image variant data.

**Fix Location:** `app/public/wp-content/plugins/abu-pinterest-gallery/abu-pinterest-gallery.php`  
**Function:** `abu_pg_get_tile_metadata()` around line 1870-2032

Check that for images, this code is returning data:
```php
$tile_data['gridUrl']     = $image_variants['grid_url'];
$tile_data['webUrl']      = $image_variants['web_url'];
$tile_data['originalUrl'] = $image_variants['original_url'];
```

Test by adding PHP debug logging:
```php
error_log('Tile metadata: ' . print_r($tile_data, true));
```

### If URLs are PRESENT but imgSrc is EMPTY (Question C):

**Root Cause:** Hydration not running or failed.

**Fix Location:** `gallery.js` line ~2476 in `createTileElement()`

Check that for spotlight context, this code runs:
```javascript
if (isSpotlight) {
  img.src = imageUrl;  // This should set src immediately
}
```

The hydration fix added in previous session (lines ~1887-1930) should catch this, but may need adjustment.

### If WARNINGS show mixed content or localhost issues (Question D):

**Root Cause:** Tunnel setup or WordPress site URL configuration.

**Fix Options:**
1. Ensure WordPress Site URL uses HTTPS (not HTTP)
2. Check that media URLs in database use HTTPS
3. Verify Local by Flywheel tunnel settings

**Quick test:** Run this in WordPress PHP console:
```php
$test_tile_id = 123; // Use a real tile ID
$attachment_id = get_post_meta($test_tile_id, '_abu_pg_attachment_id', true);
echo wp_get_attachment_url($attachment_id);
// Should return https:// URL, not http://
```

## Step 5: Apply the Fix

Once you identify the root cause from the logs, make the minimal targeted fix:

- **Don't rewrite spotlight rendering**
- **Don't create duplicate UI**
- **Fix the data at its source** (PHP metadata function OR JS hydration)

## Files You May Need to Edit:

1. `app/public/wp-content/plugins/abu-pinterest-gallery/templates/single-tile.php` (add debug enable)
2. `app/public/wp-content/plugins/abu-pinterest-gallery/abu-pinterest-gallery.php` (if PHP data issue)
3. `app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js` (if hydration issue)

## Success Criteria:

After the fix:
- iPhone Safari direct URL: `/tile/slug/?kit=123` → spotlight opens WITH visible media ✅
- Console logs show `imgSrc: "https://..."` (not empty) ✅
- No warnings in logs ✅
- Tap-from-masonry still works (no regression) ✅

## Important Reminders:

- Single rendering path (don't duplicate mobile spotlight UI)
- Minimal patch approach (small targeted changes)
- Plugin-only (no theme edits)
- Debug logs stay in place until verified working

Let me know what the debug logs reveal and I'll provide the exact fix.
