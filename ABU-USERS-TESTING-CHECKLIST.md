# ABU Users Plugin - Testing Checklist

Use this checklist to verify all functionality works correctly after activation.

## Prerequisites
- [ ] ABU Users plugin activated
- [ ] ABU Pinterest Gallery plugin activated (depends on ABU Users)
- [ ] WordPress permalinks set to "Post name" or similar (not "Plain")
- [ ] Email configured (check wp_mail works via Site Health)

---

## Test 1: Organization Creation ✓

### Steps:
1. Go to WordPress admin → Organizations (or Content Kits → Organizations)
2. Click "Add New Organization"
3. Enter name: "Test Organization"
4. Click "Add New Organization"

### Expected:
- [ ] Organization created successfully
- [ ] Shows in Organizations list
- [ ] Archive URL works: `/organization/test-organization/`

---

## Test 2: User Profile Organization Field ✓

### Steps:
1. Go to Users → All Users
2. Edit any user (or your own profile)
3. Scroll to "Organization" section

### Expected:
- [ ] "Organization" section appears
- [ ] "Primary Organization" dropdown shows
- [ ] "Test Organization" appears in dropdown
- [ ] Description text explains redirect behavior

---

## Test 3: Assign Organization to User ✓

### Steps:
1. Edit user profile
2. Select "Test Organization" from Primary Organization dropdown
3. Click "Update User"
4. Verify in database (wp_usermeta table):
   - meta_key: `_abu_primary_organization`
   - meta_value: [organization term_id]

### Expected:
- [ ] User updated successfully
- [ ] User meta saved
- [ ] Dropdown shows selected org when editing user again

---

## Test 4: Login Redirect ✓

### Steps:
1. Log out
2. Log back in as user with primary organization
3. Check URL after login

### Expected:
- [ ] Redirected to `/organization/test-organization/`
- [ ] NOT redirected to `/wp-admin/`
- [ ] Organization archive page displays (with content kits if any)

---

## Test 5: Homepage Redirect ✓

### Steps:
1. While logged in as user with org
2. Navigate to homepage (site root URL)

### Expected:
- [ ] Automatically redirected to `/organization/test-organization/`
- [ ] Homepage acts as org dashboard for logged-in users

---

## Test 6: ABU Organizations Admin Page ✓

### Steps:
1. Go to Users → ABU Organizations
2. Check page displays

### Expected:
- [ ] Page loads without errors
- [ ] Shows "Test Organization" section
- [ ] Lists "Users in this Organization" table
- [ ] Shows user assigned in previous test
- [ ] Shows "Invite User to Organization" form
- [ ] Remove button appears next to user

---

## Test 7: Send Invitation ✓

### Steps:
1. On ABU Organizations page
2. Find "Test Organization" section
3. Enter valid email address in "Invite User" form
4. Click "Send Invitation"
5. Check email inbox (might be in spam)

### Expected:
- [ ] Success message: "Invitation sent successfully!"
- [ ] Email received at specified address
- [ ] Email contains invitation link with format:
   `/wp-login.php?action=register&abu_invite=[64-char-hex-token]`
- [ ] Email mentions "Test Organization"
- [ ] Email says invitation expires in 7 days

---

## Test 8: Registration via Invite ✓

### Steps:
1. Click invitation link from email (in incognito/private window)
2. Should see WordPress registration form
3. Fill out form with:
   - Username
   - Email (same as invited email for best results)
   - Password
4. Submit registration
5. After registration, check where you land

### Expected:
- [ ] Registration successful
- [ ] New user created
- [ ] User automatically assigned to "Test Organization"
- [ ] Redirected to `/organization/test-organization/` after registration

### Verify:
- [ ] Check Users → All Users → Edit new user
- [ ] Primary Organization = "Test Organization"
- [ ] User meta `_abu_primary_organization` is set

---

## Test 9: Invite Single-Use Validation ✓

### Steps:
1. Try to use the same invitation link again (from Test 8)
2. Register with different email/username

### Expected:
- [ ] Registration completes but NO org assigned
- [ ] OR registration blocked with "Invalid invite" message
- [ ] Invite cannot be reused

---

## Test 10: Remove User from Organization ✓

### Steps:
1. Go to Users → ABU Organizations
2. Find user in "Test Organization" section
3. Click "Remove" button next to user
4. Confirm removal
5. Log out, log back in as that user

### Expected:
- [ ] Success message: "User removed from organization"
- [ ] User no longer appears in org user list
- [ ] User meta `_abu_primary_organization` cleared
- [ ] After login, user goes to HOMEPAGE (not org page)
- [ ] User account still exists (not deleted)

---

## Test 11: Auth State - Logged Out Buttons ✓

### Steps:
1. Log out completely
2. Visit any tile URL: `/tile/[tile-slug]/`
3. Check spotlight view

### Expected:
- [ ] Tile loads and is viewable
- [ ] Download button HIDDEN
- [ ] Like button visible but shows login prompt on click
- [ ] Comment input shows "Log in to comment" placeholder
- [ ] Comment input is readonly

---

## Test 12: Auth State - Logged In Buttons ✓

### Steps:
1. Log in
2. Visit same tile URL: `/tile/[tile-slug]/`
3. Check spotlight view

### Expected:
- [ ] Download button VISIBLE
- [ ] Like button functional (can click heart)
- [ ] Comment input shows "Add a comment..." placeholder
- [ ] Comment input is editable (not readonly)

---

## Test 13: Auth State - Stale State Bug Fix ✓

### Steps:
1. Log in
2. Open tile in spotlight
3. Navigate away to another site
4. Log out in another tab
5. Return to tile page (browser back button)
6. Check button visibility

### Expected:
- [ ] Download/like/comment buttons HIDDEN (not stale visible)
- [ ] Auth state refreshed when page becomes visible
- [ ] Buttons correctly reflect logged-out state

### Verify in Browser DevTools:
- [ ] Open Network tab (F12)
- [ ] Filter by "abu_users_get_auth_state"
- [ ] See AJAX request when spotlight opens
- [ ] See AJAX request on visibility change

---

## Test 14: Auth State - Visibility Change ✓

### Steps:
1. Open tile in spotlight while logged out
2. In another tab, log in to WordPress
3. Return to tile tab (don't refresh, just switch tabs)
4. Wait a moment for visibility change event

### Expected:
- [ ] Buttons appear without page refresh
- [ ] Auth state refreshed on visibility change
- [ ] Download/like buttons now visible

---

## Test 15: Social Login Integration (Optional) ✓

**Only test if you have a social login plugin installed (e.g., Nextend Social Login)**

### Steps:
1. Get an invitation link (from Test 7)
2. Open link in incognito window
3. Instead of filling registration form, click "Login with Google" (or other provider)
4. Complete OAuth flow
5. After redirect, check user account

### Expected:
- [ ] User created via social login
- [ ] User automatically assigned to organization from invite
- [ ] Social avatar appears in comments (if provider supplies one)

### Verify:
- [ ] Check user meta `_abu_primary_organization` is set
- [ ] User redirects to org page on next login

---

## Test 16: Organization Archive Template ✓

### Steps:
1. Visit `/organization/test-organization/`
2. Check page displays correctly

### Expected:
- [ ] Archive page loads
- [ ] Shows content kits tagged with "Test Organization"
- [ ] Template from `abu-pinterest-gallery/templates/taxonomy-abu_organization.php` used
- [ ] No errors or broken layout

---

## Test 17: Backward Compatibility ✓

### Steps:
1. In PHP code (or browser console), test old function names:
   ```php
   // Should work via wrapper
   $org_id = abu_pg_get_user_primary_organization( $user_id );
   ```

### Expected:
- [ ] Old function names still work
- [ ] No PHP warnings or errors
- [ ] Return values identical to new function names

---

## Test 18: Capability & Role Check ✓

### Steps:
1. Check administrator user:
   - Go to Users → Your Profile
   - View capabilities (may need plugin like "User Role Editor")
2. Create new role test:
   - Use "Members" plugin or code to assign "ABU Organization Admin" role to user
   - Log in as that user
   - Check menu access

### Expected:
- [ ] Administrators have `abu_manage_org_users` capability
- [ ] "ABU Organization Admin" role exists
- [ ] Users with this role can see Users → ABU Organizations
- [ ] Users with this role can remove users and send invites

---

## Test 19: No Org User (Default Behavior) ✓

### Steps:
1. Create new user
2. Do NOT assign primary organization
3. Log in as that user

### Expected:
- [ ] User sees normal homepage (not redirected)
- [ ] Can browse site normally
- [ ] Tiles are viewable (tiles are public)
- [ ] Download/like/comment require login (work as expected)

---

## Test 20: Edge Case - Deleted Organization ✓

### Steps:
1. Assign user to "Test Organization"
2. Delete "Test Organization" taxonomy term
3. Log in as that user

### Expected:
- [ ] No errors or fatal crashes
- [ ] User redirects to homepage (org no longer exists)
- [ ] Stale user meta doesn't cause issues
- [ ] Functions handle missing term gracefully

---

## Performance Checks

### Auth State Caching:
- [ ] Check Network tab: `abu_users_get_auth_state` not called excessively
- [ ] 30-second cache working (subsequent calls within 30s use cached value)
- [ ] No performance impact on page load

### Invite Lookup Performance:
- [ ] Invite validation doesn't cause slow registration
- [ ] Token hash comparison is fast (wp_check_password is optimized)

---

## Security Verification

### Token Security:
- [ ] Check database: only hash stored in `_abu_invite_token_hash` meta
- [ ] Raw token NOT stored anywhere
- [ ] Token is 64 hex characters (32 random bytes)

### CSRF Protection:
- [ ] All admin forms have nonce fields
- [ ] Form submissions check nonces
- [ ] Direct POST to wp-admin blocked without valid nonce

### Capability Checks:
- [ ] Non-admin users cannot access ABU Organizations page
- [ ] Non-privileged users cannot remove users or send invites
- [ ] Edit user profile requires `edit_user` capability

---

## Final Verification

- [ ] No PHP errors in debug.log
- [ ] No JavaScript errors in browser console
- [ ] All features working as documented
- [ ] No conflicts with other plugins
- [ ] Gallery plugin still works (masonry + spotlight)
- [ ] Organization pages display correctly
- [ ] User workflow feels smooth

---

## Success Criteria Summary

✅ **Organizations work:**
- Created, listed, assigned to users

✅ **Login redirects work:**
- To org page after login
- To org page when visiting homepage

✅ **Invitations work:**
- Secure tokens generated
- Emails sent
- Registration assigns org
- Single-use enforced

✅ **Admin page works:**
- Lists orgs and users
- Remove user functionality
- Send invite functionality

✅ **Auth state works:**
- Buttons hidden when logged out
- Buttons shown when logged in
- State refreshes on spotlight open
- State refreshes on visibility change
- Stale state bug fixed

✅ **Social login works:**
- Invite preserved through OAuth
- Org assigned after social registration
- Avatar support functional

✅ **Security verified:**
- Tokens secure (hash-only storage)
- CSRF protected
- Capability checks enforced
- Single-use invites

✅ **Backward compatibility:**
- Old function names work
- No breaking changes
- Gallery plugin unaffected

---

## Troubleshooting Reference

**Issue:** Email not received  
**Fix:** Check WordPress Site Health → Email Test, configure SMTP

**Issue:** Redirect loop  
**Fix:** Clear browser cache, check permalink settings

**Issue:** Buttons not hiding when logged out  
**Fix:** Hard refresh (Ctrl+Shift+R), check browser console for JS errors

**Issue:** Invite link doesn't assign org  
**Fix:** Check token in URL, verify invite not expired/used

**Issue:** Social login doesn't preserve invite  
**Fix:** Check browser allows cookies, verify token in cookie storage

---

**Test Date:** _______________  
**Tested By:** _______________  
**Result:** ☐ Pass  ☐ Fail  
**Notes:**
