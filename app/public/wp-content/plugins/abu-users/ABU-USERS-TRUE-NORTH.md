# ABU Users — True North

> **This is an aspirational document.** It describes how the ABU Users plugin *should* work and the principles that govern how it is built. If the current implementation deviates from what is described here, this document is right and the code has a bug. Refer to this document before modifying or debugging any user/org/auth code.

**Last Updated:** 2026-02-06

---

## 1. Purpose

ABU Users is the **user management layer** for the ABU platform. It answers three questions:

1. **Who is this user?** — WordPress handles this natively. ABU Users does not replace or modify WordPress user accounts, passwords, sessions, or roles beyond what is strictly necessary.
2. **Which organization does this user belong to?** — A thin layer of user meta (`_abu_primary_organization`) links a WordPress user to an Organization taxonomy term.
3. **How does a new user get onboarded?** — A secure invitation system that generates a one-time-use, time-limited token, emails it, and assigns the user to an organization upon registration.

Everything else — authentication, session management, password hashing, cookie handling, user roles — is **WordPress core**. This plugin augments; it does not replace.

---

## 2. Security Philosophy

### Use WordPress. Do Not Reinvent It.

WordPress has been battle-tested by millions of sites for two decades. Its user authentication, session management, password hashing, nonce system, and capability model are mature and well-audited. This plugin's security posture is simple:

**Use WordPress core for everything auth-related. Only add the minimum custom layer needed for organization assignment and invitation.**

### Attack Surface Minimization

Every custom endpoint, form handler, or data store is a potential attack surface. The plugin minimizes these by:

| Need | Approach | Why Not Custom? |
|------|----------|----------------|
| User accounts | WordPress `wp_users` table | Never store user credentials ourselves |
| Authentication | WordPress `wp_authenticate`, cookies, sessions | Never build a custom login system |
| Password hashing | WordPress `wp_hash_password` / `wp_check_password` | Never write our own crypto |
| Form security | WordPress nonces (`wp_nonce_field`, `check_admin_referer`) | Never roll custom CSRF protection |
| Capability checks | WordPress `current_user_can()` | Never build custom permission logic |
| Email delivery | WordPress `wp_mail()` | Never connect to SMTP directly |
| Redirects | WordPress `wp_safe_redirect()` | Prevents open redirect attacks |
| Input sanitization | WordPress `absint()`, `sanitize_text_field()`, `sanitize_email()` | Never trust raw input |

### What This Plugin Does Add

Only three custom data structures exist:

1. **User meta** (`_abu_primary_organization`) — a single integer linking user to org
2. **Invite CPT** (`abu_invite`) — a private, hidden post type storing hashed invitation tokens
3. **Organization taxonomy** (`abu_organization`) — a standard WordPress taxonomy

### Invitation Token Security

Tokens follow industry best practices:
- **Generation:** `bin2hex(random_bytes(32))` — 64 hex characters, cryptographically random
- **Storage:** Only the hash is stored (`wp_hash_password`). The raw token is never persisted.
- **Validation:** `wp_check_password(raw_token, stored_hash)` — constant-time comparison
- **Single-use:** Marked as used immediately upon registration. Cannot be reused.
- **Time-limited:** 7-day expiration enforced server-side
- **Email-bound (optional):** If an email is stored with the invite, the registering email must match

**The raw token exists only in the invite email URL and nowhere else.** If a database is compromised, the hashes cannot be reversed to generate working invite links.

---

## 3. Architecture

### Organization Taxonomy (`abu_organization`)

A standard WordPress hierarchical taxonomy, registered against `abu_content_kit` posts. Organizations are created by admins in wp-admin, just like categories.

```
Organization term (e.g., "Acme Photography")
├── Tagged on Content Kits → user sees those kits on their dashboard
└── Linked to users via _abu_primary_organization user meta
```

- **Permalink:** `/organization/{slug}/` — serves as the user's dashboard
- **Template:** `taxonomy-abu_organization.php` (provided by the gallery plugin)
- **Admin UI:** Standard WordPress taxonomy UI + custom admin page under Users

### User-to-Organization Relationship

A single user meta value:

```
User meta key:   _abu_primary_organization
User meta value: {term_id}   (integer, the abu_organization term ID)
```

Functions:
- `abu_users_get_user_primary_organization($user_id)` — returns term ID or false
- `abu_users_set_user_primary_organization($user_id, $org_id)` — sets or clears (pass 0 to clear)

Both functions validate that the term exists before returning/setting. Stale references to deleted terms return false.

### Login Redirect

Two hooks handle redirecting users to their organization:

1. **`login_redirect` filter** — fires after WordPress authenticates the user. If the user has a primary org, returns the org archive URL instead of the default redirect.
2. **`template_redirect` action** — fires when a logged-in user visits the homepage. If the user has a primary org, redirects to the org page. Includes redirect-loop prevention.

Both hooks fail gracefully: if the org doesn't exist or the term link can't be generated, the default WordPress behavior takes over.

### Invitation Flow

```
1. Admin goes to Users → ABU Organizations
2. Admin enters email + clicks "Send Invitation"
3. Plugin:
   a. Generates raw token: bin2hex(random_bytes(32))
   b. Hashes token: wp_hash_password(raw_token)
   c. Creates abu_invite post (private, hidden) with:
      - _abu_invite_org_id (organization term ID)
      - _abu_invite_email (invited email)
      - _abu_invite_token_hash (hashed token — NOT raw)
      - _abu_invite_expires_at (Unix timestamp, now + 7 days)
      - _abu_invite_used_at (0 = unused)
      - _abu_invite_used_by (0 = nobody)
   d. Sends email via wp_mail() with URL:
      /wp-login.php?action=register&abu_invite={raw_token}

4. User clicks link → WordPress registration page loads
5. User registers → user_register action fires
6. Plugin:
   a. Reads abu_invite token from URL
   b. Iterates unused invites, checks wp_check_password(raw, hash)
   c. Validates: not expired, not used, email matches (if stored)
   d. Assigns user to organization: update_user_meta
   e. Marks invite as used: _abu_invite_used_at = time()
```

### Social Login Integration

OAuth flows (e.g., Nextend Social Login) redirect away from the site and back, which loses the `abu_invite` URL parameter. The plugin handles this:

1. On `init` (priority 1), if `$_GET['abu_invite']` is present, store it in a secure cookie (`httpOnly`, `secure`, 1-hour TTL)
2. When the social login callback fires (`nsl_register_new_user`), check the cookie for the invite token
3. Process the invite normally, then clear the cookie

The plugin also overrides avatar URLs to prefer social login avatars (e.g., `nsl-profile-picture` user meta from Nextend).

### Auth State Endpoint

A lightweight AJAX endpoint that returns `{ isLoggedIn: true/false }`:

- **Action:** `abu_users_get_auth_state`
- **Available to:** Both logged-in and logged-out users (`wp_ajax_` and `wp_ajax_nopriv_`)
- **No nonce required:** This is read-only public information (WordPress already knows if you're logged in)
- **Used by:** Gallery plugin JS to refresh UI state (e.g., when a user logs in on another tab and returns)

The frontend config object `abuUsersConfig` is localized onto jQuery and provides `ajaxUrl` and `authStateAction` to gallery JS.

---

## 4. Custom Role and Capability

| Name | Type | Purpose |
|------|------|---------|
| `abu_manage_org_users` | Capability | Gates access to the ABU Organizations admin page |
| `administrator` | Role | Automatically receives `abu_manage_org_users` on init |
| `abu_org_admin` | Custom role | For non-admin users who need to manage org users. Has `read` + `abu_manage_org_users` |

The capability is added to the administrator role on every `init`. The custom role is only created if it doesn't already exist (idempotent).

---

## 5. Backward Compatibility

The organization functions were originally in the gallery plugin (`abu_pg_get_user_primary_organization`, `abu_pg_set_user_primary_organization`). Wrapper functions exist so old code continues to work:

```php
// These still work (wrappers):
abu_pg_get_user_primary_organization($user_id);
abu_pg_set_user_primary_organization($user_id, $org_id);

// These are the canonical functions:
abu_users_get_user_primary_organization($user_id);
abu_users_set_user_primary_organization($user_id, $org_id);
```

New code should always use the `abu_users_` prefix.

---

## 6. Integration with Other Plugins

### ABU Pinterest Gallery

| Integration Point | How It Works |
|-------------------|-------------|
| Organization taxonomy | ABU Users registers `abu_organization`; gallery plugin uses it on `abu_content_kit` posts |
| Organization archive template | Gallery plugin provides `taxonomy-abu_organization.php` which queries Content Kits tagged with the org |
| Permission gating | Gallery plugin checks `is_user_logged_in()` for download/like/comment. ABU Users manages the login flow and auth state endpoint. |
| `abuPgConfig.isLoggedIn` | Set by gallery plugin at page load. ABU Users provides the AJAX endpoint for JS to re-check this. |

**Boundary: where does user interaction data live?**

Likes, comments, and download activity on tiles are **not stored by ABU Users**. They are stored on tile posts via `wp_postmeta` and `wp_comments` by the gallery plugin. ABU Users only needs to answer "is this user logged in?" — it does not need to store or query tile interaction data.

When building user-centric features (e.g., "show me all tiles I've liked"), the query runs against tile post meta in the gallery plugin's domain, not against any ABU Users data structure. ABU Users provides the user identity; the gallery plugin provides the interaction data.

### Video Behavior by ABU

No direct integration. Video Behavior operates at the attachment level; ABU Users operates at the user/org level.

### WordPress Core

| WP Feature | How ABU Users Uses It |
|------------|----------------------|
| `wp_users` table | Standard WordPress users — no modifications |
| `usermeta` table | Stores `_abu_primary_organization` |
| Custom taxonomy | `abu_organization` registered via `register_taxonomy()` |
| Custom post type | `abu_invite` (private, hidden) for invitation records |
| `login_redirect` filter | Redirects users to org page after login |
| `template_redirect` action | Redirects logged-in users from homepage to org page |
| `user_register` action | Processes invite token on registration |
| `wp_mail()` | Sends invitation emails |
| `wp_hash_password()` / `wp_check_password()` | Secure token hashing and validation |
| `wp_nonce_field()` / `check_admin_referer()` | CSRF protection on admin forms |
| `current_user_can()` | Capability checks on all admin actions |

---

## 7. Data Schema

### User Meta

| Key | Value | Set By |
|-----|-------|--------|
| `_abu_primary_organization` | Organization term ID (int) | Admin profile edit, invitation processing |

### Invite Post Meta (`abu_invite` CPT)

| Key | Value | Notes |
|-----|-------|-------|
| `_abu_invite_org_id` | Organization term ID (int) | Which org this invite is for |
| `_abu_invite_email` | Email string | Optional — restricts who can use the invite |
| `_abu_invite_token_hash` | Hashed token string | Output of `wp_hash_password()`. Never the raw token. |
| `_abu_invite_expires_at` | Unix timestamp (int) | `time() + 7 * DAY_IN_SECONDS` |
| `_abu_invite_used_at` | Unix timestamp or 0 | 0 = unused. Nonzero = used at this time. |
| `_abu_invite_used_by` | User ID or 0 | 0 = unused. Nonzero = which user redeemed it. |

---

## 8. Good Patterns / Bad Patterns

### User Authentication

**Good:** Let WordPress handle login, logout, session cookies, and password management entirely.
```php
// GOOD: Use WordPress login URL
wp_login_url($redirect);

// GOOD: Check login state with WordPress
is_user_logged_in();
get_current_user_id();
```

**Bad:** Building custom authentication, storing credentials, or creating custom session management.
```php
// BAD: Custom login form that processes credentials directly
if ($_POST['password'] === $stored_password) { ... }

// BAD: Custom session tokens
$_SESSION['abu_logged_in'] = true;

// BAD: Custom cookie-based auth
setcookie('abu_auth', $user_id, ...);
```

### Organization Assignment

**Good:** Use the provided functions which validate the org exists before saving.
```php
// GOOD: Validated assignment
abu_users_set_user_primary_organization($user_id, $org_id);

// GOOD: Validated retrieval (returns false if org term was deleted)
$org_id = abu_users_get_user_primary_organization($user_id);
```

**Bad:** Writing user meta directly without validation.
```php
// BAD: No validation that org term exists
update_user_meta($user_id, '_abu_primary_organization', $org_id);

// BAD: Trusting the meta value without checking term exists
$org_id = get_user_meta($user_id, '_abu_primary_organization', true);
// This could return a stale ID for a deleted term
```

### Invitation Security

**Good:** Use the existing invite functions. Never expose raw tokens in logs, admin UI, or database.
```php
// GOOD: Create invite through the proper function
$raw_token = abu_users_create_invite($org_id, $email);

// GOOD: Validate with constant-time hash comparison
$invite_id = abu_users_validate_invite($raw_token, $email);
```

**Bad:** Storing raw tokens, using predictable tokens, or skipping expiration checks.
```php
// BAD: Storing raw token in database
update_post_meta($invite_id, '_abu_invite_raw_token', $raw_token);

// BAD: Predictable token
$token = md5($email . time());

// BAD: Skipping validation, just checking if invite exists
$invite = get_post($invite_id);
if ($invite) { /* assign user */ }
```

### Admin Actions

**Good:** Always check capabilities and nonces.
```php
// GOOD: Capability check
if (!current_user_can('abu_manage_org_users')) {
    wp_die('Permission denied.');
}

// GOOD: Nonce verification
check_admin_referer('abu_users_admin');
```

**Bad:** Skipping security checks for convenience.
```php
// BAD: No capability check
function handle_admin_action() {
    $user_id = $_POST['user_id'];
    abu_users_set_user_primary_organization($user_id, 0);
}

// BAD: No nonce
if (isset($_POST['action'])) { /* process */ }
```

### Redirects

**Good:** Use `wp_safe_redirect()` which validates the URL is on the same host.
```php
// GOOD: Safe redirect
wp_safe_redirect($org_url);
exit;
```

**Bad:** Using raw redirects that could be exploited for open redirect attacks.
```php
// BAD: Unvalidated redirect
header('Location: ' . $_GET['redirect_to']);

// BAD: wp_redirect without safe
wp_redirect($user_supplied_url);
```

### Extending User Data

**Good:** Use WordPress user meta for additional user fields. Use existing taxonomy terms for categorization.
```php
// GOOD: Additional user metadata via WP API
update_user_meta($user_id, '_abu_user_preference', $value);
```

**Bad:** Creating custom database tables for user data, or building a parallel user system.
```php
// BAD: Custom table
$wpdb->insert('abu_user_profiles', ['user_id' => $id, 'org_id' => $org]);

// BAD: Parallel user system
wp_insert_post(['post_type' => 'abu_user_profile', ...]);
```

---

## 9. What This Plugin Must Never Do

1. **Never store passwords or credentials.** WordPress handles all authentication. No custom login forms, no custom password storage, no custom session tokens.

2. **Never create custom database tables.** Use `user_meta`, `post_meta`, taxonomies, and CPTs. WordPress provides all necessary storage primitives. This applies to future features too — user activity data (liked tiles, download history, etc.) belongs on tile posts via `wp_postmeta`, not in custom tables managed by this plugin.

3. **Never bypass capability checks.** Every admin action must verify `current_user_can()`. Every form must have a nonce.

4. **Never expose raw invite tokens** in admin UI, debug logs, database queries, or API responses. Only the hash is stored; only the email contains the raw token.

5. **Never replace WordPress login/logout/registration flow.** Augment it (via filters and actions), but never replace it. The `login_redirect` filter and `user_register` action are the correct integration points.

6. **Never create custom AJAX endpoints that modify user data without authentication.** The auth-state endpoint is read-only and returns only public information. Any write operation must require login + capability check + nonce.

7. **Never hardcode organization IDs or user IDs.** Always look them up dynamically via `get_user_meta()`, `get_term()`, etc.

8. **Never assume a user has an organization.** Always handle the `false` return from `abu_users_get_user_primary_organization()`. Many users (admins, users not yet invited) won't have one.

---

## 10. Edge Cases

### User's organization term is deleted
- `abu_users_get_user_primary_organization()` verifies the term exists
- Returns `false` if the term was deleted
- User sees default homepage on next login (no redirect loop)
- The stale user meta value remains but is functionally ignored

### Invite token used twice
- After first use, `_abu_invite_used_at` is set to a nonzero timestamp
- `abu_users_validate_invite()` checks `_abu_invite_used_at = 0` as a query condition
- Second use attempt fails validation silently

### Invite token expired
- `abu_users_validate_invite()` checks `time() > $expires_at`
- Returns `false` — user sees standard registration page with no org assignment
- Admin must send a new invite

### User belongs to org but org has no Content Kits
- User is redirected to org archive page
- Archive template shows "No galleries available yet" message
- This is correct behavior — the org exists but has no content yet

### Social login callback loses invite token
- Token stored in `abu_invite_token` cookie before OAuth redirect
- Cookie is `httpOnly`, `secure`, 1-hour TTL
- Retrieved on social login callback, then cleared
- If cookie is blocked (strict privacy settings), org assignment fails silently and user registers without an org

### Multiple tabs / login state changes
- Gallery JS can call the `abu_users_get_auth_state` endpoint to detect login changes
- This is a poll, not a push — the UI doesn't update in real-time
- A page reload always gets the correct auth state from PHP

---

## 11. File Structure

```
abu-users/
├── abu-users.php          ← Entire plugin in one file (all logic)
├── README.md              ← Quick-start guide for admin
└── ABU-USERS-TRUE-NORTH.md ← This document
```

The plugin is intentionally a single file. All logic — taxonomy registration, user meta, invitation system, redirects, admin UI, auth endpoint, social login, backward compatibility — lives in `abu-users.php`. This makes it fully portable and easy to audit.

**Do not split this into multiple files unless the plugin grows significantly in scope.** A single-file plugin is easier to read, search, and audit than a multi-file structure with includes.

---

## 12. User Data in Gallery Plugin (2026-02-06)

The gallery plugin (`abu-pinterest-gallery`) surfaces user data from WordPress in two places:

### Comment Avatars

Comment AJAX responses (`abu_pg_ajax_load_tile_comments`, `abu_pg_ajax_submit_comment`) include an `avatarUrl` field via `get_avatar_url($user_id, ['size' => 80])`. This returns:
- **Gravatar** by default (hash of user email)
- **Social login profile picture** when Nextend Social Login is active (ABU Users overrides `get_avatar_url` to prefer `nsl-profile-picture` user meta)

The JS renders an `<img>` inside `.abu-pg-comment-avatar` when `avatarUrl` is present, falling back to text initials when absent.

### Comment Author Names

Comment responses use `first_name` + `last_name` from `get_user_meta()` instead of `display_name` / `comment_author`. Falls back to `comment_author` if no first/last name is stored. Social login users will have these populated automatically by Nextend from their Google/Meta profile.

### Tile Likes

Likes are stored as user IDs in `_abu_pg_likes` post meta on tile posts (managed by the gallery plugin). The gallery plugin's `abu_pg_get_tile_metadata()` includes `userHasLiked` (bool) in its JSON response, checked via `abu_pg_user_has_liked_tile()`. The JS like button persists state across SPA navigation by updating both the local item object and the `GalleryStateManager` cache on like/unlike. ABU Users provides the user identity; the gallery plugin owns the interaction data.
