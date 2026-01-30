# Social Buttons - Integration Guide

**Purpose:** This document provides technical details for external plugins that need to hook into the ABU Pinterest Gallery's desktop spotlight social buttons (like, comment, share).

**Created:** January 29, 2026  
**Version:** 1.0.0

---

## Overview

The desktop spotlight feature includes three social interaction buttons: **Like**, **Comment**, and **Share**. These buttons are rendered in the spotlight view but do not have built-in functionality. They are designed to be hooked into by external WordPress plugins that manage user interactions and data persistence.

---

## Button Specifications

### Like Button

**Purpose:** Toggle like/unlike state for the spotlight media.

**HTML Structure:**
```html
<button type="button" 
        class="abu-pg-social-btn abu-pg-like-btn" 
        data-media-id="123"
        data-media-filename="example-photo.jpg"
        data-media-url="https://example.com/wp-content/uploads/2026/01/example-photo.jpg"
        data-state="unliked"
        aria-label="Like">
  <svg class="yp-icon"><!-- heart.svg or heart-filled.svg --></svg>
</button>
```

**CSS Classes:**
- `abu-pg-social-btn`: Base class for all social buttons
- `abu-pg-like-btn`: Specific class for like button
- `yp-icon`: Icon styling class

**Data Attributes:**
- `data-media-id`: WordPress attachment ID (integer)
- `data-media-filename`: Original filename (string)
- `data-media-url`: Full URL to media file (string)
- `data-state`: Current state - `"unliked"` or `"liked"` (string)

**States:**
- **Unliked:** Shows `heart.svg` (outline heart)
- **Liked:** Shows `heart-filled.svg` (filled heart)

**Icon Rendering:**
The plugin automatically swaps between `heart.svg` and `heart-filled.svg` based on the `data-state` attribute. External plugins should update this attribute to reflect the current like state.

---

### Comment Button

**Purpose:** Open a comment interface or dialog for the spotlight media.

**HTML Structure:**
```html
<button type="button" 
        class="abu-pg-social-btn abu-pg-comment-btn" 
        data-media-id="123"
        data-media-filename="example-photo.jpg"
        data-media-url="https://example.com/wp-content/uploads/2026/01/example-photo.jpg"
        aria-label="Comment">
  <svg class="yp-icon"><!-- chat-bubble.svg --></svg>
</button>
```

**CSS Classes:**
- `abu-pg-social-btn`: Base class for all social buttons
- `abu-pg-comment-btn`: Specific class for comment button
- `yp-icon`: Icon styling class

**Data Attributes:**
- `data-media-id`: WordPress attachment ID (integer)
- `data-media-filename`: Original filename (string)
- `data-media-url`: Full URL to media file (string)

**Icon:**
- Always shows `chat-bubble.svg`

---

### Share Button

**Purpose:** Open a share interface or trigger share functionality for the spotlight media.

**HTML Structure:**
```html
<button type="button" 
        class="abu-pg-social-btn abu-pg-share-btn" 
        data-media-id="123"
        data-media-filename="example-photo.jpg"
        data-media-url="https://example.com/wp-content/uploads/2026/01/example-photo.jpg"
        aria-label="Share">
  <svg class="yp-icon"><!-- share-2.svg --></svg>
</button>
```

**CSS Classes:**
- `abu-pg-social-btn`: Base class for all social buttons
- `abu-pg-share-btn`: Specific class for share button
- `yp-icon`: Icon styling class

**Data Attributes:**
- `data-media-id`: WordPress attachment ID (integer)
- `data-media-filename`: Original filename (string)
- `data-media-url`: Full URL to media file (string)

**Icon:**
- Always shows `share-2.svg`

---

## Integration Methods

### Method 1: Event Delegation (Recommended)

Use event delegation to listen for clicks on social buttons throughout the document:

```javascript
document.addEventListener('click', function(event) {
  // Like button
  const likeBtn = event.target.closest('.abu-pg-like-btn');
  if (likeBtn) {
    event.preventDefault();
    event.stopPropagation();
    
    const mediaId = likeBtn.dataset.mediaId;
    const filename = likeBtn.dataset.mediaFilename;
    const mediaUrl = likeBtn.dataset.mediaUrl;
    const currentState = likeBtn.dataset.state;
    
    // Your logic here
    if (currentState === 'unliked') {
      // Add like to database
      // Then update button:
      likeBtn.dataset.state = 'liked';
      updateLikeIcon(likeBtn);
    } else {
      // Remove like from database
      // Then update button:
      likeBtn.dataset.state = 'unliked';
      updateLikeIcon(likeBtn);
    }
  }
  
  // Comment button
  const commentBtn = event.target.closest('.abu-pg-comment-btn');
  if (commentBtn) {
    event.preventDefault();
    event.stopPropagation();
    
    const mediaId = commentBtn.dataset.mediaId;
    const filename = commentBtn.dataset.mediaFilename;
    const mediaUrl = commentBtn.dataset.mediaUrl;
    
    // Open comment modal/interface
  }
  
  // Share button
  const shareBtn = event.target.closest('.abu-pg-share-btn');
  if (shareBtn) {
    event.preventDefault();
    event.stopPropagation();
    
    const mediaId = shareBtn.dataset.mediaId;
    const filename = shareBtn.dataset.mediaFilename;
    const mediaUrl = shareBtn.dataset.mediaUrl;
    
    // Open share modal/interface
  }
});

function updateLikeIcon(button) {
  const isLiked = button.dataset.state === 'liked';
  const iconPath = isLiked 
    ? '/wp-content/plugins/abu-pinterest-gallery/assets/icons/radix/heart-filled.svg'
    : '/wp-content/plugins/abu-pinterest-gallery/assets/icons/radix/heart.svg';
  
  // Fetch and replace SVG
  fetch(iconPath)
    .then(response => response.text())
    .then(svg => {
      button.innerHTML = svg;
    });
}
```

### Method 2: MutationObserver (For Dynamic Loading)

If you need to detect when new buttons are added to the DOM:

```javascript
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if (node.nodeType === 1) { // Element node
        // Check if spotlight was added
        if (node.classList && node.classList.contains('abu-pg-desktop-spotlight')) {
          attachSocialButtonListeners(node);
        }
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function attachSocialButtonListeners(spotlight) {
  const likeBtn = spotlight.querySelector('.abu-pg-like-btn');
  const commentBtn = spotlight.querySelector('.abu-pg-comment-btn');
  const shareBtn = spotlight.querySelector('.abu-pg-share-btn');
  
  if (likeBtn) {
    likeBtn.addEventListener('click', handleLike);
  }
  if (commentBtn) {
    commentBtn.addEventListener('click', handleComment);
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', handleShare);
  }
}
```

### Method 3: WordPress Action Hook

You can enqueue your integration script and ensure it loads after the gallery script:

```php
function my_plugin_enqueue_gallery_integration() {
  // Check if ABU Pinterest Gallery is active
  if (function_exists('abu_pg_shortcode')) {
    wp_enqueue_script(
      'my-gallery-integration',
      plugin_dir_url(__FILE__) . 'js/gallery-integration.js',
      array('abu-pg-gallery'), // Depends on gallery script
      '1.0.0',
      true
    );
    
    // Pass WordPress user info if needed
    wp_localize_script(
      'my-gallery-integration',
      'myGalleryData',
      array(
        'userId' => get_current_user_id(),
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('gallery_interaction')
      )
    );
  }
}
add_action('wp_enqueue_scripts', 'my_plugin_enqueue_gallery_integration');
```

---

## Updating Button States

### Like Button State Management

The like button has two visual states that must be manually updated by your integration:

**To mark as liked:**
```javascript
likeBtn.dataset.state = 'liked';
// Update icon (see updateLikeIcon function above)
```

**To mark as unliked:**
```javascript
likeBtn.dataset.state = 'unliked';
// Update icon (see updateLikeIcon function above)
```

**Initial state on spotlight open:**

You can detect when a spotlight opens and set the initial like state based on your database:

```javascript
document.addEventListener('click', function(event) {
  const tile = event.target.closest('.abu-pg-tile');
  if (tile && !event.target.closest('button')) {
    // User is about to open spotlight
    setTimeout(function() {
      const likeBtn = document.querySelector('.abu-pg-desktop-spotlight .abu-pg-like-btn');
      if (likeBtn) {
        const mediaId = likeBtn.dataset.mediaId;
        // Check if user has liked this media
        checkLikeStatus(mediaId).then(isLiked => {
          likeBtn.dataset.state = isLiked ? 'liked' : 'unliked';
          updateLikeIcon(likeBtn);
        });
      }
    }, 100);
  }
});
```

---

## AJAX Integration Example

Here's a complete example of integrating with a WordPress AJAX endpoint:

**JavaScript (gallery-integration.js):**
```javascript
(function() {
  'use strict';
  
  // Handle like button clicks
  document.addEventListener('click', function(event) {
    const likeBtn = event.target.closest('.abu-pg-like-btn');
    if (likeBtn) {
      event.preventDefault();
      event.stopPropagation();
      
      const mediaId = likeBtn.dataset.mediaId;
      const currentState = likeBtn.dataset.state;
      const newState = currentState === 'liked' ? 'unliked' : 'liked';
      
      // Optimistic UI update
      likeBtn.dataset.state = newState;
      updateLikeIcon(likeBtn);
      
      // Send to server
      fetch(myGalleryData.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'toggle_media_like',
          media_id: mediaId,
          nonce: myGalleryData.nonce
        })
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          // Revert on error
          likeBtn.dataset.state = currentState;
          updateLikeIcon(likeBtn);
          alert('Failed to update like status');
        }
      })
      .catch(error => {
        // Revert on error
        likeBtn.dataset.state = currentState;
        updateLikeIcon(likeBtn);
        console.error('Like error:', error);
      });
    }
  });
  
  function updateLikeIcon(button) {
    const isLiked = button.dataset.state === 'liked';
    const iconName = isLiked ? 'heart-filled' : 'heart';
    const iconPath = '/wp-content/plugins/abu-pinterest-gallery/assets/icons/radix/' + iconName + '.svg';
    
    fetch(iconPath)
      .then(response => response.text())
      .then(svg => {
        button.innerHTML = svg;
      });
  }
  
  // Initialize like states on spotlight open
  const observer = new MutationObserver(function(mutations) {
    const spotlight = document.querySelector('.abu-pg-desktop-spotlight');
    if (spotlight) {
      initializeSocialButtons(spotlight);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  function initializeSocialButtons(spotlight) {
    const likeBtn = spotlight.querySelector('.abu-pg-like-btn');
    if (likeBtn) {
      const mediaId = likeBtn.dataset.mediaId;
      
      fetch(myGalleryData.ajaxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'get_media_like_status',
          media_id: mediaId,
          nonce: myGalleryData.nonce
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          likeBtn.dataset.state = data.data.is_liked ? 'liked' : 'unliked';
          updateLikeIcon(likeBtn);
        }
      });
    }
  }
})();
```

**PHP (WordPress plugin):**
```php
// Handle like toggle
function handle_toggle_media_like() {
  check_ajax_referer('gallery_interaction', 'nonce');
  
  $media_id = intval($_POST['media_id']);
  $user_id = get_current_user_id();
  
  if (!$user_id) {
    wp_send_json_error(array('message' => 'Must be logged in'));
  }
  
  // Toggle like in database
  // ... your database logic here ...
  
  wp_send_json_success(array('is_liked' => $is_liked));
}
add_action('wp_ajax_toggle_media_like', 'handle_toggle_media_like');

// Get like status
function handle_get_media_like_status() {
  check_ajax_referer('gallery_interaction', 'nonce');
  
  $media_id = intval($_POST['media_id']);
  $user_id = get_current_user_id();
  
  if (!$user_id) {
    wp_send_json_success(array('is_liked' => false));
  }
  
  // Check database
  // ... your database logic here ...
  
  wp_send_json_success(array('is_liked' => $is_liked));
}
add_action('wp_ajax_get_media_like_status', 'handle_get_media_like_status');
```

---

## Button Styling

The social buttons inherit styles from the main gallery. If you need to customize their appearance:

```css
/* Target all social buttons */
.abu-pg-social-btn {
  /* Your custom styles */
}

/* Target specific buttons */
.abu-pg-like-btn {
  /* Like button styles */
}

.abu-pg-comment-btn {
  /* Comment button styles */
}

.abu-pg-share-btn {
  /* Share button styles */
}

/* Style the liked state */
.abu-pg-like-btn[data-state="liked"] {
  /* Liked state styles */
  color: #ce8466; /* Example: highlight color */
}
```

---

## Best Practices

### 1. Always Use Event Delegation
Since buttons are created dynamically when the spotlight opens, use event delegation on `document` or a persistent parent element.

### 2. Prevent Event Bubbling
Always call `event.preventDefault()` and `event.stopPropagation()` to prevent the spotlight from closing when clicking social buttons.

### 3. Optimistic UI Updates
Update the button state immediately (optimistically) and revert if the server request fails. This provides better UX.

### 4. Handle Unauthenticated Users
Decide how to handle social interactions for logged-out users (e.g., prompt to log in, show guest interface).

### 5. Accessibility
The buttons include `aria-label` attributes. Ensure your custom functionality maintains keyboard accessibility.

### 6. Error Handling
Always include error handling for network requests and provide user feedback on failures.

---

## Troubleshooting

### Buttons Not Appearing
- Check that you're on desktop (not mobile/tablet)
- Verify spotlight is opening correctly
- Inspect console for JavaScript errors

### Click Events Not Firing
- Ensure event listener is attached to `document` or parent
- Check for `event.stopPropagation()` conflicts
- Verify CSS `pointer-events` is not `none`

### Icon Not Updating
- Check icon SVG file exists in `/assets/icons/radix/`
- Verify fetch request succeeds (check network tab)
- Ensure `innerHTML` replacement is working

### Data Attributes Missing
- Verify WordPress attachment has required metadata
- Check `data-media-id` is valid attachment ID
- Ensure filename and URL are properly escaped

---

## Support & Questions

For technical support or questions about integrating with social buttons:
1. Review this documentation thoroughly
2. Check the main `Desktop Spotlight.md` for feature details
3. Inspect browser console for errors
4. Test with debug mode enabled (`?abu_pg_debug=1`)

---

**Last Updated:** January 29, 2026  
**Plugin Version:** ABU Pinterest Gallery 0.1.0  
**Feature:** Desktop Spotlight v1.0.0
