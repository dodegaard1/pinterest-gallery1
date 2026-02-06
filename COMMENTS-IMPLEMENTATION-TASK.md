# Comments Implementation Task

**Status:** Ready for Implementation  
**Priority:** High  
**Context:** Desktop Spotlight Comments  
**Scope:** Wire up existing comment UI to backend functionality

---

## PROBLEM STATEMENT

Users can type in the comment input field in desktop spotlight, but pressing Enter does nothing. The comment UI exists and backend functions are present, but they're not connected. We need to complete the comment submission flow.

---

## CURRENT STATE

### What Exists ✅

**Backend (abu-pinterest-gallery.php):**
- `abu_pg_user_can_comment_on_tile()` - Permission check (line 463)
- `abu_pg_enforce_tile_comment_permissions()` - Server validation (line 2093)
- `abu_pg_ajax_load_tile_comments()` - AJAX endpoint to load comments (line 2133)
- `abu_pg_comment_post_redirect()` - AJAX comment submission handler (line 2234)
- WordPress hooks: `wp_ajax_abu_pg_load_tile_comments` and `wp_ajax_nopriv_abu_pg_load_tile_comments`

**Frontend:**
- Comment input bar in desktop spotlight (`.abu-pg-spotlight-comment-bar`)
- Auth state gating (shows "Log in to comment" when logged out)
- `abuPgConfig.canComment` properly set based on login state

**Auth System:**
- ABU Users plugin handles auth state via `abu_users_get_auth_state` endpoint
- Gallery plugin consumes `abuPgConfig.isLoggedIn` for gating

### What's Missing ❌

- Comment submission event handler (Enter key or submit button)
- Comment display/rendering in spotlight
- AJAX connection between frontend and backend
- Real-time comment list updates after submission
- Error handling for failed submissions

---

## REQUIRED READING

Before starting, read these files to understand the architecture:

### 1. **Navigation & SPA Context**
- `COMPLETE-SPA-NAVIGATION-TEST-PLAN.md` - Understand SPA navigation, URL handling, and state management
- `WEEK-3-BUILD.md` - Implementation patterns, deep linking, and tile context

### 2. **Plugin Architecture**
- `app/public/wp-content/plugins/abu-pinterest-gallery/abu-pinterest-gallery.php`
  - Lines 463-480: Comment permission functions
  - Lines 2093-2125: Comment enforcement filter
  - Lines 2133-2229: Comment AJAX endpoints
  - Lines 2234-2248: Comment submission handler
- `app/public/wp-content/plugins/abu-users/abu-users.php`
  - Lines 835-864: Auth state endpoint (for understanding gating)

### 3. **Frontend Code**
- `app/public/wp-content/plugins/abu-pinterest-gallery/assets/js/gallery.js`
  - Search for: `abu-pg-spotlight-comment-bar` (comment input)
  - Search for: `renderDesktopSpotlightMedia` (desktop spotlight rendering)
  - Search for: `updateAuthGating` (auth state management)
- `UI-ELEMENTS-REFERENCE.md` - Reference for understanding existing UI components

### 4. **Related Context**
- `ABU-USERS-PLUGIN-SUMMARY.md` - Understand separation of concerns (auth vs functionality)

---

## TASK REQUIREMENTS

### Desktop Spotlight (Primary Goal)

**Must Implement:**
1. **Comment Submission Flow:**
   - Wire up Enter key press on comment input field
   - Send AJAX request to `abu_pg_load_tile_comments` endpoint
   - Use WordPress comment system (wp_insert_comment)
   - Pass tile ID, user info, and comment text
   - Handle success/error responses

2. **Comment Display:**
   - Load existing comments when spotlight opens
   - Show comment list above input field
   - Real-time update: add new comment to list after successful submission
   - Show comment author, text, and timestamp
   - Handle empty state (no comments yet)

3. **Auth Gating:**
   - Respect existing `abuPgConfig.canComment` state
   - Show error if logged-out user tries to submit
   - Clear input field after successful submission
   - Show loading state during submission

4. **Cross-Context Compatibility:**
   - Works when opening tile from main gallery
   - Works when navigating between tiles in desktop spotlight (SPA)
   - Works on direct tile URLs
   - Comment list updates when switching tiles

### Mobile (Groundwork Only)

**Do NOT implement full mobile comment UI yet.** Just ensure:
- Comment data structure works across mobile/desktop
- Mobile spotlight can load comments (even if not displayed)
- No errors when comments exist on mobile tiles
- Placeholder for future mobile comment UI

---

## TECHNICAL CONSTRAINTS

### Critical Rules (DO NOT VIOLATE):

1. **No Spotlight Duplication:**
   - Desktop spotlight code lives in ONE place: `renderDesktopSpotlightMedia()`
   - Mobile spotlight code lives in ONE place: `createSpotlightSlide()` + `preloadSpotlightTile()`
   - Comment code must integrate into existing functions, not duplicate them

2. **Surgical Modifications Only:**
   - Find the ONE true north spot for each change
   - Do not copy/paste spotlight rendering code
   - Add event listeners in existing render functions
   - Respect existing architecture patterns

3. **WordPress Native:**
   - Use WordPress comment system (`wp_insert_comment`, `get_comments`)
   - Comments are stored as standard WP comments on `abu_pg_tile` posts
   - Use existing comment forms/filters where possible

4. **Auth State Integration:**
   - Check `window.abuPgConfig.canComment` before submission
   - Use existing auth gating patterns from download/share buttons
   - Don't duplicate auth state logic

---

## IMPLEMENTATION STEPS

### Step 1: Wire Up Comment Submission (JavaScript)

**Location:** `gallery.js` in `renderDesktopSpotlightMedia()` function

1. Find the comment input field: `.abu-pg-spotlight-comment-bar input[type="text"]`
2. Add keypress event listener for Enter key
3. On Enter:
   - Check `abuPgConfig.canComment`
   - Get comment text from input
   - Get tile ID from current item
   - Send AJAX POST to `abuPgConfig.ajaxUrl` with action: `abu_pg_submit_comment`
4. Handle response:
   - Success: Clear input, add comment to list
   - Error: Show error message
   - Always: Remove loading state

### Step 2: Create Comment Submission Endpoint (PHP)

**Location:** `abu-pinterest-gallery.php`

1. Create new function: `abu_pg_ajax_submit_comment()`
2. Validate:
   - User is logged in
   - Tile ID is valid
   - Comment text is not empty
   - User has permission via `abu_pg_user_can_comment_on_tile()`
3. Use `wp_insert_comment()` to save comment
4. Return JSON response with new comment data
5. Hook to `wp_ajax_abu_pg_submit_comment`

### Step 3: Load and Display Comments (JavaScript)

**Location:** `gallery.js` in `renderDesktopSpotlightMedia()` function

1. When spotlight opens, call existing `abu_pg_load_tile_comments` AJAX action
2. Parse returned HTML or JSON
3. Inject comment list into `.abu-pg-comments-container` or create if doesn't exist
4. Position above comment input bar
5. Style to match existing spotlight UI

### Step 4: Real-Time Updates (JavaScript)

After successful comment submission:
1. Don't reload entire comment list
2. Create comment element from response data
3. Prepend to existing comment list
4. Animate appearance (optional fade-in)

### Step 5: Mobile Groundwork (JavaScript)

**Location:** `gallery.js` mobile spotlight code

1. Ensure mobile spotlight can load comments via AJAX (don't display yet)
2. Add placeholder comment container in mobile markup (hidden)
3. Don't add event listeners for mobile comments yet
4. Document where mobile comment UI will go

---

## TESTING CHECKLIST

Once implemented, verify:

- [ ] Can submit comment in desktop spotlight via Enter key
- [ ] Comment appears immediately in list after submission
- [ ] Input field clears after successful submission
- [ ] Comments load when opening tile from main gallery
- [ ] Comments load when navigating between tiles in spotlight (SPA)
- [ ] Comments load on direct tile URLs
- [ ] Comment list updates when switching tiles
- [ ] Logged-out users see "Log in to comment" (no submission allowed)
- [ ] Error handling works (empty comment, network error, etc.)
- [ ] Comments persist (reload page, comment still shows)
- [ ] Mobile spotlight doesn't crash (even though comments not shown)
- [ ] No console errors in any context
- [ ] WordPress admin shows comments on tile posts

---

## SUCCESS CRITERIA

✅ Users can leave comments on tiles in desktop spotlight  
✅ Comments display in real-time after submission  
✅ Comments work across all navigation contexts (gallery, SPA, direct URL)  
✅ Auth gating prevents logged-out users from commenting  
✅ Mobile spotlight has comment groundwork (no errors, ready for UI)  
✅ No duplication of spotlight code  
✅ Surgical modifications only  

---

## EXAMPLE AJAX CALL (JavaScript)

```javascript
// In renderDesktopSpotlightMedia() after rendering comment bar
const commentInput = leftColumn.querySelector('.abu-pg-spotlight-comment-bar input[type="text"]');
if (commentInput) {
  commentInput.addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      if (!window.abuPgConfig || !window.abuPgConfig.canComment) {
        alert('Please log in to comment');
        return;
      }
      
      const commentText = commentInput.value.trim();
      if (!commentText) return;
      
      // Show loading state
      commentInput.disabled = true;
      
      try {
        const response = await fetch(window.abuPgConfig.ajaxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            action: 'abu_pg_submit_comment',
            nonce: window.abuPgConfig.nonce,
            tile_id: item.id,
            comment: commentText
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Clear input
          commentInput.value = '';
          // Add comment to list (implement this)
          addCommentToList(data.data.comment);
        } else {
          alert(data.data.message || 'Failed to submit comment');
        }
      } catch (error) {
        console.error('Comment submission error:', error);
        alert('Failed to submit comment');
      } finally {
        commentInput.disabled = false;
      }
    }
  });
}
```

---

## EXAMPLE PHP ENDPOINT

```php
/**
 * AJAX handler for submitting comments
 */
function abu_pg_ajax_submit_comment() {
	// Verify nonce
	check_ajax_referer( 'abu_pg_ajax', 'nonce' );
	
	// Check if user is logged in
	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => 'You must be logged in to comment.' ) );
	}
	
	$tile_id = isset( $_POST['tile_id'] ) ? absint( $_POST['tile_id'] ) : 0;
	$comment_text = isset( $_POST['comment'] ) ? sanitize_textarea_field( $_POST['comment'] ) : '';
	$user_id = get_current_user_id();
	
	// Validate
	if ( ! $tile_id || ! $comment_text ) {
		wp_send_json_error( array( 'message' => 'Invalid comment data.' ) );
	}
	
	// Check permission
	if ( ! abu_pg_user_can_comment_on_tile( $user_id, $tile_id ) ) {
		wp_send_json_error( array( 'message' => 'You do not have permission to comment.' ) );
	}
	
	// Insert comment
	$comment_data = array(
		'comment_post_ID'      => $tile_id,
		'comment_author'       => wp_get_current_user()->display_name,
		'comment_author_email' => wp_get_current_user()->user_email,
		'comment_content'      => $comment_text,
		'user_id'              => $user_id,
		'comment_approved'     => 1, // Auto-approve
	);
	
	$comment_id = wp_insert_comment( $comment_data );
	
	if ( ! $comment_id ) {
		wp_send_json_error( array( 'message' => 'Failed to save comment.' ) );
	}
	
	// Get comment data for response
	$comment = get_comment( $comment_id );
	
	wp_send_json_success( array(
		'comment' => array(
			'id'      => $comment_id,
			'author'  => $comment->comment_author,
			'content' => $comment->comment_content,
			'date'    => $comment->comment_date,
		),
	) );
}
add_action( 'wp_ajax_abu_pg_submit_comment', 'abu_pg_ajax_submit_comment' );
```

---

## NOTES FOR NEXT CHAT

- Comment backend functions already exist but may need minor adjustments
- Focus on wiring up frontend to backend
- Desktop spotlight is the priority (mobile later)
- Respect existing spotlight architecture (no duplication)
- Use WordPress native comment system
- Test across all navigation contexts (main gallery, SPA, direct URL)

**Good luck! 🚀**
