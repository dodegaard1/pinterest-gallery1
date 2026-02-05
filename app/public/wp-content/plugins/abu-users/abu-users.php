<?php
/**
 * Plugin Name: ABU Users
 * Description: Manages users, organizations, invitations, redirects, and auth-state helpers for ABU projects.
 * Version: 1.0.0
 * Author: ABU
 * 
 * TESTING CHECKLIST:
 * ☐ Create organization term via wp-admin
 * ☐ Assign primary org to user → confirm login redirects to org archive URL
 * ☐ Generate invite link → register new account → verify user lands in org
 * ☐ Remove user from org → confirm user meta cleared → verify homepage redirect
 * ☐ Test auth-state endpoint while logged out → confirm buttons hidden
 * ☐ Test auth-state endpoint while logged in → confirm buttons visible
 * ☐ Navigate away from direct tile URL → return → confirm auth state persists correctly
 * ☐ Social login with invite token → confirm org assignment works
 */

defined( 'ABSPATH' ) || exit;

define( 'ABU_USERS_PATH', plugin_dir_path( __FILE__ ) );
define( 'ABU_USERS_URL', plugin_dir_url( __FILE__ ) );
define( 'ABU_USERS_VERSION', '1.0.0' );

/**
 * ========================================
 * ORGANIZATION TAXONOMY
 * ========================================
 */

/**
 * Register Organization taxonomy (abu_organization).
 * 
 * Moved from abu-pinterest-gallery plugin to centralize user/org management.
 * Organizations are teams/clients that content kits can be tagged with.
 */
function abu_users_register_organization_taxonomy() {
	$labels = array(
		'name'                       => __( 'Organizations', 'abu-users' ),
		'singular_name'              => __( 'Organization', 'abu-users' ),
		'menu_name'                  => __( 'Organizations', 'abu-users' ),
		'all_items'                  => __( 'All Organizations', 'abu-users' ),
		'edit_item'                  => __( 'Edit Organization', 'abu-users' ),
		'view_item'                  => __( 'View Organization', 'abu-users' ),
		'update_item'                => __( 'Update Organization', 'abu-users' ),
		'add_new_item'               => __( 'Add New Organization', 'abu-users' ),
		'new_item_name'              => __( 'New Organization Name', 'abu-users' ),
		'parent_item'                => __( 'Parent Organization', 'abu-users' ),
		'parent_item_colon'          => __( 'Parent Organization:', 'abu-users' ),
		'search_items'               => __( 'Search Organizations', 'abu-users' ),
		'popular_items'              => __( 'Popular Organizations', 'abu-users' ),
		'separate_items_with_commas' => __( 'Separate organizations with commas', 'abu-users' ),
		'add_or_remove_items'        => __( 'Add or remove organizations', 'abu-users' ),
		'choose_from_most_used'      => __( 'Choose from most used organizations', 'abu-users' ),
		'not_found'                  => __( 'No organizations found', 'abu-users' ),
	);
	
	$args = array(
		'labels'            => $labels,
		'public'            => true,
		'show_ui'           => true,
		'show_in_menu'      => true,
		'show_in_nav_menus' => true,
		'show_in_rest'      => true,
		'show_admin_column' => true,
		'hierarchical'      => true,
		'query_var'         => true,
		'rewrite'           => array(
			'slug'         => 'organization',
			'with_front'   => false,
			'hierarchical' => true,
		),
		'capabilities'      => array(
			'manage_terms' => 'manage_categories',
			'edit_terms'   => 'manage_categories',
			'delete_terms' => 'manage_categories',
			'assign_terms' => 'edit_posts',
		),
	);
	
	// Register for abu_content_kit (from gallery plugin)
	register_taxonomy( 'abu_organization', array( 'abu_content_kit' ), $args );
}
add_action( 'init', 'abu_users_register_organization_taxonomy', 5 ); // Priority 5 to run before gallery plugin

/**
 * ========================================
 * USER → ORGANIZATION RELATIONSHIP
 * ========================================
 */

/**
 * Get the primary organization for a user.
 * 
 * @param int $user_id User ID (0 for current user).
 * @return int|false Organization term ID or false if not set.
 */
function abu_users_get_user_primary_organization( $user_id = 0 ) {
	if ( ! $user_id ) {
		$user_id = get_current_user_id();
	}
	
	if ( ! $user_id ) {
		return false;
	}
	
	$org_id = get_user_meta( $user_id, '_abu_primary_organization', true );
	
	if ( ! $org_id ) {
		return false;
	}
	
	// Verify organization term exists
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return false;
	}
	
	return absint( $org_id );
}

/**
 * Set the primary organization for a user.
 * 
 * @param int $user_id User ID.
 * @param int $org_id Organization term ID (0 to clear).
 * @return bool Success.
 */
function abu_users_set_user_primary_organization( $user_id, $org_id ) {
	$user_id = absint( $user_id );
	
	if ( ! $user_id ) {
		return false;
	}
	
	if ( ! $org_id ) {
		// Clear organization
		return delete_user_meta( $user_id, '_abu_primary_organization' );
	}
	
	$org_id = absint( $org_id );
	
	// Verify organization exists
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return false;
	}
	
	return update_user_meta( $user_id, '_abu_primary_organization', $org_id );
}

/**
 * ========================================
 * LOGIN REDIRECT
 * ========================================
 */

/**
 * Redirect logged-in users to their organization page after login.
 * 
 * Uses login_redirect filter for clean integration with WordPress auth flow.
 * 
 * @param string $redirect_to URL to redirect to.
 * @param string $request Requested redirect URL.
 * @param object $user WP_User object.
 * @return string Modified redirect URL.
 */
function abu_users_login_redirect( $redirect_to, $request, $user ) {
	if ( ! isset( $user->ID ) ) {
		return $redirect_to;
	}
	
	$org_id = abu_users_get_user_primary_organization( $user->ID );
	
	if ( ! $org_id ) {
		return $redirect_to; // No org set, use default redirect
	}
	
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return $redirect_to;
	}
	
	$org_url = get_term_link( $term );
	if ( is_wp_error( $org_url ) ) {
		return $redirect_to;
	}
	
	return $org_url;
}
add_filter( 'login_redirect', 'abu_users_login_redirect', 10, 3 );

/**
 * Fallback homepage redirect (only if no login_redirect caught it).
 * 
 * This handles cases where user navigates to homepage while already logged in.
 */
function abu_users_homepage_redirect() {
	if ( ! is_front_page() || ! is_user_logged_in() ) {
		return;
	}
	
	$user_id = get_current_user_id();
	$org_id = abu_users_get_user_primary_organization( $user_id );
	
	if ( ! $org_id ) {
		return; // No organization set, show normal homepage
	}
	
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return;
	}
	
	$org_url = get_term_link( $term );
	if ( is_wp_error( $org_url ) ) {
		return;
	}
	
	// Prevent redirect loop
	if ( isset( $_SERVER['REQUEST_URI'] ) && strpos( $_SERVER['REQUEST_URI'], $term->slug ) !== false ) {
		return;
	}
	
	wp_safe_redirect( $org_url );
	exit;
}
add_action( 'template_redirect', 'abu_users_homepage_redirect' );

/**
 * ========================================
 * ADMIN UI - USER PROFILE FIELD
 * ========================================
 */

/**
 * Add organization field to user profile.
 */
function abu_users_add_user_organization_field( $user ) {
	if ( ! current_user_can( 'edit_user', $user->ID ) ) {
		return;
	}
	
	$org_id = abu_users_get_user_primary_organization( $user->ID );
	
	$organizations = get_terms(
		array(
			'taxonomy'   => 'abu_organization',
			'hide_empty' => false,
			'orderby'    => 'name',
			'order'      => 'ASC',
		)
	);
	
	?>
	<h3><?php _e( 'Organization', 'abu-users' ); ?></h3>
	<table class="form-table">
		<tr>
			<th><label for="abu_primary_organization"><?php _e( 'Primary Organization', 'abu-users' ); ?></label></th>
			<td>
				<select name="abu_primary_organization" id="abu_primary_organization" class="regular-text">
					<option value=""><?php _e( '— Select Organization —', 'abu-users' ); ?></option>
					<?php if ( ! empty( $organizations ) && ! is_wp_error( $organizations ) ) : ?>
						<?php foreach ( $organizations as $org ) : ?>
							<option value="<?php echo esc_attr( $org->term_id ); ?>" <?php selected( $org_id, $org->term_id ); ?>>
								<?php echo esc_html( $org->name ); ?>
							</option>
						<?php endforeach; ?>
					<?php endif; ?>
				</select>
				<p class="description">
					<?php _e( 'When logged in, you will be redirected to this organization\'s page as your dashboard.', 'abu-users' ); ?>
				</p>
			</td>
		</tr>
	</table>
	<?php
}
add_action( 'show_user_profile', 'abu_users_add_user_organization_field' );
add_action( 'edit_user_profile', 'abu_users_add_user_organization_field' );

/**
 * Save user organization field.
 */
function abu_users_save_user_organization_field( $user_id ) {
	if ( ! current_user_can( 'edit_user', $user_id ) ) {
		return false;
	}
	
	if ( isset( $_POST['abu_primary_organization'] ) ) {
		$org_id = absint( $_POST['abu_primary_organization'] );
		if ( $org_id > 0 ) {
			abu_users_set_user_primary_organization( $user_id, $org_id );
		} else {
			delete_user_meta( $user_id, '_abu_primary_organization' );
		}
	}
}
add_action( 'personal_options_update', 'abu_users_save_user_organization_field' );
add_action( 'edit_user_profile_update', 'abu_users_save_user_organization_field' );

/**
 * ========================================
 * ORGANIZATION ADMIN CAPABILITY & ROLE
 * ========================================
 */

/**
 * Add custom capability for managing organization users.
 */
function abu_users_add_org_admin_capability() {
	// Grant capability to administrators
	$admin_role = get_role( 'administrator' );
	if ( $admin_role ) {
		$admin_role->add_cap( 'abu_manage_org_users' );
	}
	
	// Create org admin role if it doesn't exist
	if ( ! get_role( 'abu_org_admin' ) ) {
		add_role(
			'abu_org_admin',
			__( 'ABU Organization Admin', 'abu-users' ),
			array(
				'read'                 => true,
				'abu_manage_org_users' => true,
			)
		);
	}
}
add_action( 'init', 'abu_users_add_org_admin_capability' );

/**
 * ========================================
 * ADMIN PAGE - ORGANIZATION USER MANAGEMENT
 * ========================================
 */

/**
 * Add admin menu page for organization management.
 */
function abu_users_add_admin_menu() {
	add_users_page(
		__( 'ABU Organizations', 'abu-users' ),
		__( 'ABU Organizations', 'abu-users' ),
		'abu_manage_org_users',
		'abu-organizations',
		'abu_users_render_admin_page'
	);
}
add_action( 'admin_menu', 'abu_users_add_admin_menu' );

/**
 * Render organization admin page.
 */
function abu_users_render_admin_page() {
	if ( ! current_user_can( 'abu_manage_org_users' ) ) {
		wp_die( __( 'You do not have permission to access this page.', 'abu-users' ) );
	}
	
	// Handle form submissions
	if ( isset( $_POST['abu_users_action'] ) ) {
		check_admin_referer( 'abu_users_admin' );
		
		$action = sanitize_text_field( $_POST['abu_users_action'] );
		
		if ( 'remove_user' === $action && isset( $_POST['user_id'] ) ) {
			$user_id = absint( $_POST['user_id'] );
			abu_users_set_user_primary_organization( $user_id, 0 );
			echo '<div class="notice notice-success"><p>' . __( 'User removed from organization.', 'abu-users' ) . '</p></div>';
		}
		
		if ( 'send_invite' === $action && isset( $_POST['org_id'], $_POST['email'] ) ) {
			$org_id = absint( $_POST['org_id'] );
			$email = sanitize_email( $_POST['email'] );
			
			if ( $org_id && is_email( $email ) ) {
				$invite_token = abu_users_create_invite( $org_id, $email );
				if ( $invite_token ) {
					$invite_sent = abu_users_send_invite_email( $email, $invite_token, $org_id );
					if ( $invite_sent ) {
						echo '<div class="notice notice-success"><p>' . __( 'Invitation sent successfully!', 'abu-users' ) . '</p></div>';
					} else {
						echo '<div class="notice notice-error"><p>' . __( 'Failed to send invitation email.', 'abu-users' ) . '</p></div>';
					}
				} else {
					echo '<div class="notice notice-error"><p>' . __( 'Failed to create invitation.', 'abu-users' ) . '</p></div>';
				}
			} else {
				echo '<div class="notice notice-error"><p>' . __( 'Invalid organization or email.', 'abu-users' ) . '</p></div>';
			}
		}
	}
	
	// Get all organizations
	$organizations = get_terms(
		array(
			'taxonomy'   => 'abu_organization',
			'hide_empty' => false,
			'orderby'    => 'name',
			'order'      => 'ASC',
		)
	);
	
	?>
	<div class="wrap">
		<h1><?php _e( 'ABU Organizations', 'abu-users' ); ?></h1>
		
		<?php if ( empty( $organizations ) || is_wp_error( $organizations ) ) : ?>
			<p><?php _e( 'No organizations found. Create organizations first.', 'abu-users' ); ?></p>
		<?php else : ?>
			<?php foreach ( $organizations as $org ) : ?>
				<div class="abu-org-section" style="margin-bottom: 40px; padding: 20px; background: #fff; border: 1px solid #ccc; border-radius: 4px;">
					<h2><?php echo esc_html( $org->name ); ?></h2>
					
					<!-- Users in this org -->
					<h3><?php _e( 'Users in this Organization', 'abu-users' ); ?></h3>
					<?php
					$users = get_users(
						array(
							'meta_key'   => '_abu_primary_organization',
							'meta_value' => $org->term_id,
						)
					);
					?>
					
					<?php if ( ! empty( $users ) ) : ?>
						<table class="widefat">
							<thead>
								<tr>
									<th><?php _e( 'User', 'abu-users' ); ?></th>
									<th><?php _e( 'Email', 'abu-users' ); ?></th>
									<th><?php _e( 'Actions', 'abu-users' ); ?></th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ( $users as $user ) : ?>
									<tr>
										<td><?php echo esc_html( $user->display_name ); ?></td>
										<td><?php echo esc_html( $user->user_email ); ?></td>
										<td>
											<form method="post" style="display: inline;">
												<?php wp_nonce_field( 'abu_users_admin' ); ?>
												<input type="hidden" name="abu_users_action" value="remove_user">
												<input type="hidden" name="user_id" value="<?php echo esc_attr( $user->ID ); ?>">
												<button type="submit" class="button button-secondary" onclick="return confirm('<?php esc_attr_e( 'Remove this user from the organization?', 'abu-users' ); ?>');">
													<?php _e( 'Remove', 'abu-users' ); ?>
												</button>
											</form>
										</td>
									</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					<?php else : ?>
						<p><?php _e( 'No users in this organization.', 'abu-users' ); ?></p>
					<?php endif; ?>
					
					<!-- Invite form -->
					<h3 style="margin-top: 20px;"><?php _e( 'Invite User to Organization', 'abu-users' ); ?></h3>
					<form method="post" style="max-width: 500px;">
						<?php wp_nonce_field( 'abu_users_admin' ); ?>
						<input type="hidden" name="abu_users_action" value="send_invite">
						<input type="hidden" name="org_id" value="<?php echo esc_attr( $org->term_id ); ?>">
						<table class="form-table">
							<tr>
								<th><label for="email_<?php echo esc_attr( $org->term_id ); ?>"><?php _e( 'Email Address', 'abu-users' ); ?></label></th>
								<td>
									<input type="email" name="email" id="email_<?php echo esc_attr( $org->term_id ); ?>" class="regular-text" required>
									<p class="description"><?php _e( 'Enter the email address of the person to invite.', 'abu-users' ); ?></p>
								</td>
							</tr>
						</table>
						<p class="submit">
							<button type="submit" class="button button-primary"><?php _e( 'Send Invitation', 'abu-users' ); ?></button>
						</p>
					</form>
				</div>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * ========================================
 * INVITATION SYSTEM (SECURE TOKENS)
 * ========================================
 */

/**
 * Register private CPT for invitations.
 */
function abu_users_register_invite_cpt() {
	register_post_type(
		'abu_invite',
		array(
			'labels'              => array( 'name' => 'Invitations' ),
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_nav_menus'   => false,
			'show_in_admin_bar'   => false,
			'exclude_from_search' => true,
			'capability_type'     => 'post',
			'has_archive'         => false,
			'hierarchical'        => false,
			'supports'            => array( 'title' ),
		)
	);
}
add_action( 'init', 'abu_users_register_invite_cpt' );

/**
 * Create a new invitation.
 * 
 * @param int    $org_id Organization term ID.
 * @param string $email Email address (optional, for validation).
 * @return string|false Raw token on success, false on failure.
 */
function abu_users_create_invite( $org_id, $email = '' ) {
	$org_id = absint( $org_id );
	
	if ( ! $org_id ) {
		return false;
	}
	
	// Verify org exists
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return false;
	}
	
	// Generate secure random token (32 bytes = 64 hex chars)
	$raw_token = bin2hex( random_bytes( 32 ) );
	
	// Hash the token for storage (use wp_hash_password for WordPress integration)
	$token_hash = wp_hash_password( $raw_token );
	
	// Set expiration (7 days from now)
	$expires_at = time() + ( 7 * DAY_IN_SECONDS );
	
	// Create invite post
	$invite_id = wp_insert_post(
		array(
			'post_type'   => 'abu_invite',
			'post_title'  => 'Invite to ' . $term->name . ' - ' . ( $email ? $email : 'No email' ),
			'post_status' => 'private',
		)
	);
	
	if ( ! $invite_id || is_wp_error( $invite_id ) ) {
		return false;
	}
	
	// Store invite metadata
	update_post_meta( $invite_id, '_abu_invite_org_id', $org_id );
	update_post_meta( $invite_id, '_abu_invite_email', sanitize_email( $email ) );
	update_post_meta( $invite_id, '_abu_invite_token_hash', $token_hash );
	update_post_meta( $invite_id, '_abu_invite_expires_at', $expires_at );
	update_post_meta( $invite_id, '_abu_invite_used_at', 0 );
	update_post_meta( $invite_id, '_abu_invite_used_by', 0 );
	
	return $raw_token;
}

/**
 * Validate an invitation token.
 * 
 * @param string $raw_token Raw token from URL.
 * @param string $email Email being registered (optional, for validation).
 * @return int|false Invite post ID on success, false on failure.
 */
function abu_users_validate_invite( $raw_token, $email = '' ) {
	if ( empty( $raw_token ) ) {
		return false;
	}
	
	// Find invite by checking all private invites
	$invites = get_posts(
		array(
			'post_type'      => 'abu_invite',
			'post_status'    => 'private',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => array(
				array(
					'key'     => '_abu_invite_used_at',
					'value'   => 0,
					'compare' => '=',
				),
			),
		)
	);
	
	foreach ( $invites as $invite_id ) {
		$token_hash = get_post_meta( $invite_id, '_abu_invite_token_hash', true );
		
		// Check if token matches using wp_check_password
		if ( wp_check_password( $raw_token, $token_hash ) ) {
			// Found matching invite, validate it
			
			// Check expiration
			$expires_at = absint( get_post_meta( $invite_id, '_abu_invite_expires_at', true ) );
			if ( $expires_at && time() > $expires_at ) {
				return false; // Expired
			}
			
			// Check if already used
			$used_at = absint( get_post_meta( $invite_id, '_abu_invite_used_at', true ) );
			if ( $used_at ) {
				return false; // Already used
			}
			
			// If email is stored, validate it matches
			if ( $email ) {
				$stored_email = get_post_meta( $invite_id, '_abu_invite_email', true );
				if ( $stored_email && $stored_email !== sanitize_email( $email ) ) {
					return false; // Email mismatch
				}
			}
			
			return $invite_id;
		}
	}
	
	return false;
}

/**
 * Mark an invitation as used.
 * 
 * @param int $invite_id Invite post ID.
 * @param int $user_id User ID who used the invite.
 * @return bool Success.
 */
function abu_users_mark_invite_used( $invite_id, $user_id ) {
	$invite_id = absint( $invite_id );
	$user_id = absint( $user_id );
	
	if ( ! $invite_id || ! $user_id ) {
		return false;
	}
	
	update_post_meta( $invite_id, '_abu_invite_used_at', time() );
	update_post_meta( $invite_id, '_abu_invite_used_by', $user_id );
	
	return true;
}

/**
 * Send invitation email.
 * 
 * @param string $email Recipient email.
 * @param string $raw_token Raw invitation token.
 * @param int    $org_id Organization term ID.
 * @return bool Success.
 */
function abu_users_send_invite_email( $email, $raw_token, $org_id ) {
	if ( ! is_email( $email ) || ! $raw_token || ! $org_id ) {
		return false;
	}
	
	$term = get_term( $org_id, 'abu_organization' );
	if ( is_wp_error( $term ) || ! $term ) {
		return false;
	}
	
	// Build invite URL
	$invite_url = add_query_arg(
		array(
			'action'     => 'register',
			'abu_invite' => $raw_token,
		),
		wp_login_url()
	);
	
	$subject = sprintf( __( 'You\'re invited to join %s', 'abu-users' ), $term->name );
	
	$message = sprintf(
		__( "Hi,\n\nYou've been invited to join the %s organization.\n\nClick the link below to register your account:\n\n%s\n\nThis invitation will expire in 7 days.\n\nBest regards,\nThe Team", 'abu-users' ),
		$term->name,
		$invite_url
	);
	
	return wp_mail( $email, $subject, $message );
}

/**
 * Process invitation during user registration.
 */
function abu_users_process_invite_on_registration( $user_id ) {
	// Check if abu_invite token is present
	$raw_token = isset( $_GET['abu_invite'] ) ? sanitize_text_field( $_GET['abu_invite'] ) : '';
	
	if ( ! $raw_token ) {
		return; // No invite token
	}
	
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return;
	}
	
	// Validate invite
	$invite_id = abu_users_validate_invite( $raw_token, $user->user_email );
	
	if ( ! $invite_id ) {
		return; // Invalid invite
	}
	
	// Get org from invite
	$org_id = absint( get_post_meta( $invite_id, '_abu_invite_org_id', true ) );
	
	if ( ! $org_id ) {
		return;
	}
	
	// Assign user to organization
	abu_users_set_user_primary_organization( $user_id, $org_id );
	
	// Mark invite as used
	abu_users_mark_invite_used( $invite_id, $user_id );
}
add_action( 'user_register', 'abu_users_process_invite_on_registration' );

/**
 * ========================================
 * SOCIAL LOGIN INTEGRATION
 * ========================================
 */

/**
 * Hook for social login plugins to attach organization during registration.
 * 
 * This works with plugins like Nextend Social Login that create users
 * via social OAuth. If an invite token is present in the URL when the
 * social login callback happens, we attach the organization.
 */
function abu_users_social_login_attach_org( $user_id, $provider = '' ) {
	// Check if abu_invite token is present in URL
	$raw_token = isset( $_GET['abu_invite'] ) ? sanitize_text_field( $_GET['abu_invite'] ) : '';
	
	// Also check session/cookie in case token was stored before OAuth redirect
	if ( ! $raw_token && isset( $_COOKIE['abu_invite_token'] ) ) {
		$raw_token = sanitize_text_field( $_COOKIE['abu_invite_token'] );
		// Clear cookie after use
		setcookie( 'abu_invite_token', '', time() - 3600, COOKIEPATH, COOKIE_DOMAIN );
	}
	
	if ( ! $raw_token ) {
		return; // No invite
	}
	
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return;
	}
	
	// Validate and process invite
	$invite_id = abu_users_validate_invite( $raw_token, $user->user_email );
	
	if ( ! $invite_id ) {
		return;
	}
	
	$org_id = absint( get_post_meta( $invite_id, '_abu_invite_org_id', true ) );
	
	if ( $org_id ) {
		abu_users_set_user_primary_organization( $user_id, $org_id );
		abu_users_mark_invite_used( $invite_id, $user_id );
	}
}
// Hook into common social login actions
add_action( 'nsl_register_new_user', 'abu_users_social_login_attach_org', 10, 2 ); // Nextend Social Login

/**
 * Store invite token in cookie before OAuth redirect.
 * 
 * Some social login flows redirect away and back, losing URL params.
 * Store the invite token in a cookie for retrieval after OAuth.
 */
function abu_users_store_invite_token_cookie() {
	if ( isset( $_GET['abu_invite'] ) ) {
		$raw_token = sanitize_text_field( $_GET['abu_invite'] );
		setcookie( 'abu_invite_token', $raw_token, time() + 3600, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true );
	}
}
add_action( 'init', 'abu_users_store_invite_token_cookie', 1 );

/**
 * Override avatar URL with social login avatar if available.
 * 
 * Integration with social login plugins that store avatar URLs.
 */
function abu_users_filter_avatar_url( $url, $id_or_email, $args ) {
	$user = false;
	
	if ( is_numeric( $id_or_email ) ) {
		$user = get_user_by( 'id', absint( $id_or_email ) );
	} elseif ( is_object( $id_or_email ) && isset( $id_or_email->user_id ) ) {
		$user = get_user_by( 'id', absint( $id_or_email->user_id ) );
	} elseif ( is_string( $id_or_email ) && is_email( $id_or_email ) ) {
		$user = get_user_by( 'email', $id_or_email );
	}
	
	if ( ! $user ) {
		return $url;
	}
	
	// Check for Nextend Social Login avatar
	$nsl_avatar = get_user_meta( $user->ID, 'nsl-profile-picture', true );
	if ( $nsl_avatar ) {
		return $nsl_avatar;
	}
	
	// Add support for other social login plugins here
	
	return $url;
}
add_filter( 'get_avatar_url', 'abu_users_filter_avatar_url', 10, 3 );

/**
 * ========================================
 * AUTH STATE AJAX ENDPOINT
 * ========================================
 */

/**
 * AJAX endpoint to check current auth state.
 * 
 * Returns JSON with isLoggedIn boolean.
 * Used by gallery JS to refresh UI state when spotlight opens or visibility changes.
 */
function abu_users_ajax_get_auth_state() {
	// No nonce required - this is read-only public data
	wp_send_json_success(
		array(
			'isLoggedIn' => is_user_logged_in(),
		)
	);
}
add_action( 'wp_ajax_abu_users_get_auth_state', 'abu_users_ajax_get_auth_state' );
add_action( 'wp_ajax_nopriv_abu_users_get_auth_state', 'abu_users_ajax_get_auth_state' );

/**
 * Enqueue auth state script for frontend.
 */
function abu_users_enqueue_auth_state_script() {
	if ( is_admin() ) {
		return;
	}
	
	// Make auth state endpoint available to frontend JS
	wp_localize_script(
		'jquery', // Use jQuery as dependency (always loaded)
		'abuUsersConfig',
		array(
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'authStateAction' => 'abu_users_get_auth_state',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'abu_users_enqueue_auth_state_script' );

/**
 * ========================================
 * BACKWARD COMPATIBILITY HELPERS
 * ========================================
 * 
 * Provide backward compatibility for code that may still call
 * the old function names from abu-pinterest-gallery plugin.
 */

if ( ! function_exists( 'abu_pg_get_user_primary_organization' ) ) {
	function abu_pg_get_user_primary_organization( $user_id = 0 ) {
		return abu_users_get_user_primary_organization( $user_id );
	}
}

if ( ! function_exists( 'abu_pg_set_user_primary_organization' ) ) {
	function abu_pg_set_user_primary_organization( $user_id, $org_id ) {
		return abu_users_set_user_primary_organization( $user_id, $org_id );
	}
}
