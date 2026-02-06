# Comments Testing Checklist

**Quick reference for testing comment functionality**

---

## Pre-Test Setup

- [ ] Clear browser cache
- [ ] Ensure you have a test user account (logged in)
- [ ] Ensure you have test tiles in a gallery
- [ ] Open browser console to watch for errors

---

## Desktop Spotlight Tests

### Basic Submission
- [ ] Open spotlight on any tile (desktop)
- [ ] Verify comment input bar appears at bottom
- [ ] Type a comment and press Enter
- [ ] Verify comment appears in list above input
- [ ] Verify input clears after submission
- [ ] Verify "Posting..." placeholder shows during submission
- [ ] Submit 2-3 more comments, verify they all appear

### Auth State (Logged In)
- [ ] Verify input placeholder says "Add a comment..."
- [ ] Verify input is editable (not read-only)
- [ ] Verify you can type in the input
- [ ] Verify Enter key submits comment

### Auth State (Logged Out)
- [ ] Log out of WordPress
- [ ] Open spotlight on a tile
- [ ] Verify input placeholder says "Log in to comment"
- [ ] Verify input is read-only (can't type)
- [ ] Click the input field
- [ ] Verify you're redirected to login page

### Navigation Context
- [ ] **Test 1: Gallery → Spotlight**
  - Open main gallery page
  - Click a tile to open spotlight
  - Verify comments load
  - Submit a comment
  - Verify it appears

- [ ] **Test 2: SPA Navigation**
  - With spotlight open, click a different tile in right column
  - Verify new tile's comments load
  - Verify old tile's comments are gone
  - Navigate back to first tile
  - Verify original comments appear again

- [ ] **Test 3: Direct Tile URL**
  - Copy tile permalink from browser address bar
  - Close spotlight
  - Paste URL in new tab and visit
  - Verify spotlight opens automatically
  - Verify comments load on initial page load
  - Submit a comment
  - Verify it appears

### Comment Display
- [ ] Verify comment shows author name
- [ ] Verify comment shows content text
- [ ] Verify comment shows timestamp (relative: "2m ago")
- [ ] Verify newest comments appear at top of list
- [ ] Verify scrolling works if many comments

### Edge Cases
- [ ] Try submitting empty comment (press Enter with no text)
  - Should do nothing (no submission)
- [ ] Type a very long comment (multiple paragraphs)
  - Should submit successfully
  - Should display with line breaks preserved
- [ ] Submit comment with special characters: @#$%&*()
  - Should submit and display correctly
- [ ] Submit comment with HTML: `<script>alert('test')</script>`
  - Should be sanitized (no alert, shows as text)

---

## Mobile Tests (Groundwork)

- [ ] Visit gallery on mobile device (or mobile view)
- [ ] Tap a tile to open spotlight
- [ ] Verify spotlight opens normally
- [ ] Verify no console errors
- [ ] Verify no comment UI displays (expected)
- [ ] Verify no JavaScript errors in console
- [ ] Navigate between tiles
- [ ] Verify everything works smoothly

---

## WordPress Admin Verification

- [ ] Log into WordPress admin
- [ ] Go to Comments section
- [ ] Verify test comments appear in the list
- [ ] Verify they're marked as "Approved"
- [ ] Verify they're associated with correct tile post
- [ ] Click on a comment to view details
- [ ] Verify author, content, date are correct

---

## Browser Console Checks

**Should see NO errors for:**
- [ ] Opening spotlight
- [ ] Submitting comment
- [ ] Loading comments
- [ ] Navigating between tiles
- [ ] Closing spotlight

**Expected logs (optional debug):**
- Comment submission request/response
- Comments loaded successfully
- Any custom debug logs you added

---

## Performance Check

- [ ] Open spotlight → comments should load quickly (<1s)
- [ ] Submit comment → should appear immediately (<500ms)
- [ ] Navigate between tiles → new comments load quickly
- [ ] Scroll comment list → should be smooth (no lag)
- [ ] Multiple rapid submissions → all should work

---

## Security Checks

- [ ] Open Network tab in browser console
- [ ] Submit a comment
- [ ] Verify POST request includes:
  - `action: abu_pg_submit_comment`
  - `nonce: [some hash]`
  - `tile_id: [number]`
  - `comment: [your text]`
- [ ] Verify response is JSON with success and comment data
- [ ] Try submitting without nonce (manually in console)
  - Should fail with error

---

## Accessibility Check

- [ ] Tab through spotlight interface
- [ ] Verify comment input is keyboard accessible
- [ ] Press Enter to submit (keyboard only)
- [ ] Verify focus returns to input after submission
- [ ] Use screen reader (optional)
  - Verify comment structure is announced
  - Verify input has proper label/placeholder

---

## Cross-Browser Check

Test in at least 2-3 browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)

Verify all above tests pass in each browser.

---

## Regression Check

Make sure existing features still work:
- [ ] Like button works
- [ ] Share button works
- [ ] Download button works
- [ ] Video playback works
- [ ] Mute button works
- [ ] Spotlight navigation (left/right arrows) works
- [ ] Back button works
- [ ] Masonry grid still renders correctly

---

## Known Issues to Watch For

- Comment list not scrolling → Check CSS max-height
- Comments not loading → Check AJAX endpoint URL
- Input not clearing → Check JavaScript event handler
- Duplicated comments → Check if addCommentToList is called twice
- Mobile crashes → Check if desktop-only code leaked to mobile path
- Auth state wrong → Check abuPgConfig.canComment value

---

## Quick Fixes

**If comments don't load:**
```javascript
// Check in console:
window.abuPgConfig.ajaxUrl
// Should output: "http://yoursite.com/wp-admin/admin-ajax.php"
```

**If submission fails:**
```javascript
// Check in console:
window.abuPgConfig.nonce
// Should output a hash string
```

**If auth state wrong:**
```javascript
// Check in console:
window.abuPgConfig.canComment
// Should be true when logged in, false when logged out
```

---

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ Comments persist after page reload  
✅ Auth gating works correctly  
✅ Mobile doesn't crash  
✅ WordPress admin shows comments  
✅ Performance is acceptable (<1s loads)  

---

**When all tests pass, mark the feature as COMPLETE!** 🎉
