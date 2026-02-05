# ABU Users Plugin - Quick Start

## Installation & Activation

1. **Activate the Plugin:**
   - Go to WordPress admin → Plugins
   - Find "ABU Users" in the list
   - Click "Activate"

2. **Verify Activation:**
   - Go to Users → ABU Organizations (should appear in menu)
   - Go to Users → Edit any user → should see "Organization" section

## First-Time Setup

### Step 1: Create Organizations
1. Go to WordPress admin → Organizations (or Content Kits → Organizations in sidebar)
2. Click "Add New Organization"
3. Enter organization name (e.g., "Acme Corporation")
4. Click "Add New Organization"

### Step 2: Assign Users to Organizations
Two ways to do this:

**Method A: Via User Profile (for existing users)**
1. Go to Users → All Users
2. Edit a user
3. Scroll to "Organization" section
4. Select primary organization from dropdown
5. Click "Update User"

**Method B: Via Invitation (for new users)**
1. Go to Users → ABU Organizations
2. Find the organization section
3. Enter email address in "Invite User to Organization" form
4. Click "Send Invitation"
5. User will receive email with registration link
6. After registration, user is automatically assigned to organization

### Step 3: Test Login Redirect
1. Log in as a user with a primary organization set
2. You should be redirected to `/organization/{slug}/` instead of homepage
3. This organization page becomes the user's dashboard

## Features Overview

### Organization Management
- **Location:** Users → ABU Organizations
- **View:** All organizations with their users
- **Actions:**
  - Remove user from organization (clears primary org, doesn't delete account)
  - Send invitation to new user via email

### User Profile Integration
- **Location:** Users → Edit User → Organization section
- **Field:** Primary Organization dropdown
- **Effect:** Sets where user is redirected after login

### Invitation System
- **Secure tokens:** 64-character hex tokens (non-guessable, non-spoofable)
- **Single-use:** Each invite can only be used once
- **Expiration:** Invites expire after 7 days
- **Email validation:** Optional - can restrict invite to specific email
- **URL format:** `/wp-login.php?action=register&abu_invite=TOKEN`

### Login Redirects
- **Login:** Redirects to organization archive page
- **Homepage:** If logged-in user visits homepage, redirects to org page
- **No org:** Users without primary org see normal homepage

### Auth State Helpers
- **AJAX endpoint:** `abu_users_get_auth_state`
- **Returns:** `{ isLoggedIn: boolean }`
- **Used by:** Gallery plugin to refresh button visibility
- **Triggers:** 
  - When spotlight opens
  - When page becomes visible (catches login in another tab)

### Social Login Support
- **Compatible with:** Nextend Social Login, other OAuth plugins
- **Preserves invite:** Stores token in cookie through OAuth redirect
- **Avatar support:** Uses social login avatar in comments
- **Hook:** `nsl_register_new_user` (Nextend)

## Capabilities & Roles

### abu_manage_org_users Capability
- **Granted to:** Administrators (automatic)
- **Allows:** 
  - View ABU Organizations page
  - Remove users from organizations
  - Send invitations
  
### abu_org_admin Role
- **Purpose:** Non-admin users who manage organizations
- **Capabilities:** `read`, `abu_manage_org_users`
- **Assign via:** Users → Edit User → Role dropdown

## Common Tasks

### How to invite a user
1. Go to Users → ABU Organizations
2. Find the organization section you want
3. Enter email in "Invite User to Organization" form
4. Click "Send Invitation"
5. User receives email with link
6. User clicks link → registers → automatically assigned to org

### How to remove a user from organization
1. Go to Users → ABU Organizations
2. Find the organization with the user
3. Click "Remove" next to user's name
4. Confirm removal
5. User's primary org is cleared (account NOT deleted)
6. Next login: user goes to homepage instead of org page

### How to check user's organization
1. Go to Users → All Users
2. Edit user
3. Check "Organization" section → shows selected org

### How to manually assign organization
1. Edit user profile
2. Select organization from dropdown in "Organization" section
3. Click "Update User"

## Troubleshooting

### User not redirecting to org page after login
**Check:**
- User has primary organization set (Users → Edit User → Organization)
- Organization term exists (Organizations menu)
- No browser caching issues (try incognito)

### Invitation email not received
**Check:**
- WordPress wp_mail() is configured correctly
- Check spam folder
- Verify SMTP settings if using SMTP plugin
- Test with WordPress admin → Tools → Site Health → Email Test

### Social login not assigning organization
**Check:**
- Social login plugin is active (e.g., Nextend Social Login)
- Invite token in URL: `/wp-login.php?action=register&abu_invite=TOKEN`
- Cookie storage working (check browser allows cookies)
- Token not expired (7 days max)

### Buttons showing when logged out
**Check:**
- ABU Users plugin is active
- Gallery JS successfully calls `abu_users_get_auth_state` endpoint
- Browser console for errors (F12 → Console tab)
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Security Notes

✅ **Tokens are secure:**
- 32 random bytes = 64 hex characters
- Only hash stored in database (wp_hash_password)
- Cannot be guessed or reversed

✅ **CSRF protected:**
- All admin forms use nonces
- Capability checks on all actions

✅ **Single-use invites:**
- Marked as used after registration
- Cannot be reused even if link is shared

✅ **Email validation:**
- If email stored in invite, must match registering email
- Prevents invite link from being used by wrong person

## Developer Notes

### Backward Compatibility
The plugin provides wrapper functions for old gallery plugin function names:

```php
// Old function (still works via wrapper)
abu_pg_get_user_primary_organization( $user_id );

// New function (recommended)
abu_users_get_user_primary_organization( $user_id );
```

Both work identically. Existing code doesn't need changes.

### Hooks Available

**Actions:**
- `abu_users_after_invite_sent` - After invite email sent
- `abu_users_after_org_assigned` - After user assigned to org
- `abu_users_after_org_removed` - After user removed from org

**Filters:**
- `abu_users_invite_expiration_days` - Change invite expiration (default: 7)
- `abu_users_invite_email_subject` - Customize invite email subject
- `abu_users_invite_email_message` - Customize invite email body

### Database Schema

**User Meta:**
- `_abu_primary_organization` - Organization term ID (integer)

**Invite Post Meta:**
- `_abu_invite_org_id` - Organization term ID
- `_abu_invite_email` - Invited email (optional)
- `_abu_invite_token_hash` - Hashed token
- `_abu_invite_expires_at` - Unix timestamp
- `_abu_invite_used_at` - Unix timestamp (0 = unused)
- `_abu_invite_used_by` - User ID

**Social Login User Meta (Nextend):**
- `nsl-profile-picture` - Avatar URL

## Success!

Your ABU Users plugin is now active and ready to use. Test the invitation flow and login redirects to verify everything works correctly.

For issues or questions, check the main documentation file: `ABU-USERS-PLUGIN-SUMMARY.md`
