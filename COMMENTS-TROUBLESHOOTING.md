# Comments Implementation - Troubleshooting Guide

**Quick reference for debugging common issues**

---

## Issue: Comments Not Loading

### Symptoms
- Comment list stays empty
- No comments appear when spotlight opens

### Debugging Steps

1. **Check Network Request:**
   - Open browser DevTools → Network tab
   - Open spotlight on a tile
   - Look for request to `admin-ajax.php?action=abu_pg_load_tile_comments&tile_id=X`
   - Check response:
     - Should be JSON: `{success: true, data: {comments: [...]}}`
     - If 404: AJAX endpoint not registered
     - If 403: Permission issue
     - If 500: PHP error (check server logs)

2. **Check Console Errors:**
   ```javascript
   // Run in console:
   fetch(`${window.abuPgConfig.ajaxUrl}?action=abu_pg_load_tile_comments&tile_id=123`)
     .then(r => r.json())
     .then(console.log)
   ```
   - Should output: `{success: true, data: {comments: []}}`

3. **Check Function Exists:**
   - Verify `abu_pg_ajax_load_tile_comments` is defined in `abu-pinterest-gallery.php`
   - Verify action hooks are registered:
     - `add_action('wp_ajax_abu_pg_load_tile_comments', ...)`
     - `add_action('wp_ajax_nopriv_abu_pg_load_tile_comments', ...)`

4. **Check Tile ID:**
   ```javascript
   // In spotlight, run in console:
   state.desktopSpotlight.currentItem.id
   ```
   - Should output a number (tile post ID)

### Solutions

**If endpoint returns 404:**
- Clear WordPress cache
- Visit Settings → Permalinks and click "Save Changes"
- Verify plugin is activated

**If endpoint returns empty array:**
- This is normal if no comments exist yet
- Try submitting a comment first

**If JavaScript error "loadComments is not defined":**
- Check that `loadComments` function is defined before `renderDesktopSpotlightMedia`
- Clear browser cache and reload

---

## Issue: Comment Submission Fails

### Symptoms
- Pressing Enter does nothing
- Error alert appears
- Comment doesn't appear in list

### Debugging Steps

1. **Check Network Request:**
   - Open DevTools → Network tab
   - Type comment and press Enter
   - Look for POST request to `admin-ajax.php`
   - Check request payload:
     - `action: abu_pg_submit_comment`
     - `nonce: [hash]`
     - `tile_id: [number]`
     - `comment: [text]`
   - Check response:
     - Success: `{success: true, data: {comment: {...}}}`
     - Error: `{success: false, data: {message: "..."}}`

2. **Check Console Errors:**
   - Look for JavaScript errors
   - Look for failed fetch requests

3. **Check Auth State:**
   ```javascript
   // Run in console:
   window.abuPgConfig.canComment
   window.abuPgConfig.isLoggedIn
   ```
   - Both should be `true` when logged in

4. **Check Nonce:**
   ```javascript
   // Run in console:
   window.abuPgConfig.nonce
   ```
   - Should output a hash string
   - If empty/undefined: nonce not localized

### Solutions

**If "Invalid nonce" error:**
- Verify `wp_create_nonce('abu_pg_ajax')` in PHP
- Verify nonce is included in POST request
- Clear cache and reload page

**If "Must be logged in" error:**
- Verify you're actually logged into WordPress
- Check `is_user_logged_in()` in PHP
- Check `abuPgConfig.isLoggedIn` in JS

**If "Permission denied" error:**
- Check tile exists and is published
- Check `abu_pg_user_can_comment_on_tile()` logic
- Verify tile `comment_status` is 'open'

**If "Failed to save comment" error:**
- Check server PHP error logs
- Verify `wp_insert_comment()` succeeds
- Check database connection

---

## Issue: Input Not Clearing

### Symptoms
- Comment submits successfully
- But input field still contains text

### Solution

Check event handler in `renderDesktopSpotlightMedia`:
```javascript
if (data.success) {
  commentInput.value = ''; // This line should exist
  addCommentToList(commentsList, data.data.comment);
}
```

---

## Issue: Comments Duplicate

### Symptoms
- Same comment appears multiple times in list

### Debugging Steps

1. **Check addCommentToList calls:**
   - Should only be called once per comment
   - Check if `loadComments` is called multiple times

2. **Check server response:**
   - Verify only one comment returned
   - Check if comment is being created multiple times

### Solution

Add guard to prevent duplicate additions:
```javascript
// Check if comment already exists before adding
const existingComment = commentsList.querySelector(`[data-comment-id="${comment.id}"]`);
if (!existingComment) {
  // Add comment
}
```

---

## Issue: Auth State Wrong

### Symptoms
- Logged in but input says "Log in to comment"
- Logged out but can type in input

### Debugging Steps

1. **Check PHP localization:**
   ```php
   // In abu-pinterest-gallery.php, verify:
   'canComment' => is_user_logged_in(),
   ```

2. **Check JS reads config:**
   ```javascript
   // In console:
   window.abuPgConfig
   ```
   - Should show object with all config values

3. **Check input rendering:**
   ```javascript
   // In renderDesktopSpotlightMedia:
   const isLoggedIn = window.abuPgConfig && window.abuPgConfig.isLoggedIn;
   ```

### Solution

**If abuPgConfig is undefined:**
- Verify `wp_localize_script` is called
- Verify script is enqueued
- Reload page

**If canComment is always false:**
- Check `is_user_logged_in()` returns true
- Clear WordPress user cache
- Check session/cookies

---

## Issue: Mobile Crashes

### Symptoms
- Mobile spotlight won't open
- JavaScript errors on mobile
- White screen on mobile

### Debugging Steps

1. **Check if desktop code leaking:**
   - Mobile uses `preloadSpotlightTile`, not `renderDesktopSpotlightMedia`
   - Verify comment code only runs in desktop path

2. **Check for mobile-specific errors:**
   - Use remote debugging (Chrome DevTools)
   - Look for "querySelector" errors on missing elements

### Solution

Comment loading should ONLY happen in desktop spotlight:
```javascript
// This should ONLY be in renderDesktopSpotlightMedia, NOT in preloadSpotlightTile
loadComments(item.id, commentsList);
```

---

## Issue: Styling Looks Wrong

### Symptoms
- Comment list not scrolling
- Input bar not pill-shaped
- Colors don't match design

### Debugging Steps

1. **Check CSS loaded:**
   - Open DevTools → Sources
   - Find `gallery.css`
   - Verify comment styles exist (lines 1264+)

2. **Check class names:**
   - Elements should have correct classes:
     - `.abu-pg-spotlight-comments`
     - `.abu-pg-spotlight-comments-list`
     - `.abu-pg-spotlight-comment-bar`

3. **Check for conflicting CSS:**
   - Use DevTools → Elements → Computed
   - Look for overriding styles

### Solution

**If styles not loaded:**
- Clear WordPress cache
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check CSS file version in PHP

**If styles overridden:**
- Increase specificity in CSS
- Add `!important` as last resort

---

## Issue: Comments Not Persisting

### Symptoms
- Comment submits successfully
- But disappears on page reload

### Debugging Steps

1. **Check WordPress admin:**
   - Go to Comments section
   - Look for submitted comments
   - If they're there, it's a loading issue
   - If not, they're not being saved

2. **Check database:**
   - Look at `wp_comments` table
   - Check if comments exist with `comment_post_ID = tile_id`

3. **Check PHP insertion:**
   ```php
   // In abu_pg_ajax_submit_comment:
   $comment_id = wp_insert_comment($comment_data);
   error_log('Comment inserted: ' . $comment_id); // Add debug log
   ```

### Solution

**If not saving:**
- Check `wp_insert_comment()` return value
- Check server PHP error logs
- Verify database permissions

**If saved but not loading:**
- Check `get_comments()` query
- Verify tile ID matches
- Check comment approval status

---

## Issue: Performance Slow

### Symptoms
- Comments take >2 seconds to load
- UI lags when submitting
- Scrolling is janky

### Debugging Steps

1. **Check network timing:**
   - DevTools → Network
   - Look at AJAX request timing
   - Should be <500ms

2. **Check comment count:**
   - If >100 comments, may need pagination
   - Use `get_comments(['number' => 50])` to limit

3. **Check animations:**
   - Disable CSS transitions temporarily
   - Check if performance improves

### Solutions

**If network slow:**
- Add server-side caching
- Optimize database queries
- Use CDN for assets

**If rendering slow:**
- Add comment pagination
- Limit initial load to 20 comments
- Use virtual scrolling for large lists

---

## Common Error Messages

### "Invalid tile ID"
- **Cause:** Tile ID is 0, null, or not a number
- **Fix:** Verify `item.id` is correct when calling `loadComments()`

### "Permission denied"
- **Cause:** User can't view tile or comments are closed
- **Fix:** Check `abu_pg_user_can_comment_on_tile()` logic

### "Invalid comment data"
- **Cause:** Empty comment text or missing tile ID
- **Fix:** Verify input validation before submission

### "Failed to save comment"
- **Cause:** `wp_insert_comment()` returned false/error
- **Fix:** Check PHP error logs, verify database

### "You must be logged in to comment"
- **Cause:** User not logged in but tried to submit
- **Fix:** This is expected behavior, ensure auth gating works

---

## Debug Helpers

### Log All AJAX Requests
```javascript
// Add to gallery.js temporarily:
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('AJAX Request:', args);
  return originalFetch(...args).then(response => {
    console.log('AJAX Response:', response);
    return response;
  });
};
```

### Log Comment State
```javascript
// Add to renderDesktopSpotlightMedia:
console.log('Loading comments for tile:', item.id);
console.log('Comments list element:', commentsList);
console.log('Auth state:', {
  isLoggedIn: window.abuPgConfig.isLoggedIn,
  canComment: window.abuPgConfig.canComment
});
```

### Test Comment Submission Manually
```javascript
// Run in browser console:
fetch(window.abuPgConfig.ajaxUrl, {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    action: 'abu_pg_submit_comment',
    nonce: window.abuPgConfig.nonce,
    tile_id: 123, // Replace with actual tile ID
    comment: 'Test comment'
  })
}).then(r => r.json()).then(console.log);
```

---

## When All Else Fails

1. **Clear everything:**
   - WordPress cache (if using cache plugin)
   - Browser cache (hard refresh)
   - Permalinks (Settings → Permalinks → Save)

2. **Check file changes:**
   - Verify all 3 files were modified:
     - `abu-pinterest-gallery.php`
     - `gallery.js`
     - `gallery.css`

3. **Revert and retry:**
   - Use git to revert changes
   - Re-apply changes one file at a time
   - Test after each file

4. **Check WordPress environment:**
   - Verify WordPress version (5.0+)
   - Check PHP version (7.4+)
   - Disable conflicting plugins temporarily

---

**Still stuck? Check WordPress debug logs at `.cursor/debug.log`**
