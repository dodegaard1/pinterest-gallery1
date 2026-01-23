<?php
/**
 * Plugin Name: Video Behavior by ABU
 * Description: Detects FFmpeg availability and exposes status in admin.
 * Version: 0.1.0
 * Author: ABU
 */

defined( 'ABSPATH' ) || exit;

define( 'VBA_PATH', plugin_dir_path( __FILE__ ) );
define( 'VBA_URL', plugin_dir_url( __FILE__ ) );
define( 'VBA_OPTION_FFMPEG_PATH', 'vba_ffmpeg_path' );
define( 'VBA_OPTION_QUEUE', 'vba_video_queue' );

require_once VBA_PATH . 'includes/ffmpeg-status.php';
require_once VBA_PATH . 'includes/queue.php';
require_once VBA_PATH . 'includes/worker.php';
require_once VBA_PATH . 'includes/derivatives.php';
require_once VBA_PATH . 'includes/attachment-ui.php';

function vba_register_settings() {
	register_setting(
		'vba_settings',
		VBA_OPTION_FFMPEG_PATH,
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => 'ffmpeg',
		)
	);
}
add_action( 'admin_init', 'vba_register_settings' );

function vba_add_settings_page() {
	add_options_page(
		'Video Behavior by ABU',
		'Video Behavior by ABU',
		'manage_options',
		'vba-settings',
		'vba_render_settings_page'
	);
}
add_action( 'admin_menu', 'vba_add_settings_page' );

function vba_admin_enqueue( $hook ) {
	if ( ! in_array( $hook, array( 'post.php', 'post-new.php', 'upload.php' ), true ) ) {
		return;
	}

	wp_enqueue_media();
	wp_enqueue_script(
		'vba-media-id',
		VBA_URL . 'assets/js/admin-media-id.js',
		array(),
		'0.1.0',
		true
	);
}
add_action( 'admin_enqueue_scripts', 'vba_admin_enqueue' );

function vba_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$status = vba_get_ffmpeg_status();
	?>
	<div class="wrap">
		<h1>Video Behavior by ABU</h1>
		<p>
			<strong>Status:</strong>
			<?php echo $status['ok'] ? '✅ FFmpeg found and executable' : '❌ FFmpeg missing / shell execution disabled'; ?>
		</p>
		<?php if ( ! empty( $status['message'] ) ) : ?>
			<p><?php echo esc_html( $status['message'] ); ?></p>
		<?php endif; ?>

		<?php
			$run_now_url = add_query_arg(
				array(
					'action' => 'vba_run_queue_now',
				),
				admin_url( 'admin-post.php' )
			);
			$run_now_url = wp_nonce_url( $run_now_url, 'vba_run_queue_now', 'vba_run_queue_nonce' );
		?>
		<p>
			<a class="button button-secondary" href="<?php echo esc_url( $run_now_url ); ?>">Run Queue Now</a>
		</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'vba_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="vba-ffmpeg-path">FFmpeg Path</label></th>
					<td>
						<input type="text" id="vba-ffmpeg-path" name="<?php echo esc_attr( VBA_OPTION_FFMPEG_PATH ); ?>" value="<?php echo esc_attr( vba_get_ffmpeg_path() ); ?>" class="regular-text">
						<p class="description">Default: <code>ffmpeg</code>. Use a full path if needed.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

function vba_plugin_action_links( $links ) {
	$settings_link = '<a href="' . esc_url( admin_url( 'options-general.php?page=vba-settings' ) ) . '">Settings</a>';
	array_unshift( $links, $settings_link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'vba_plugin_action_links' );

function vba_plugin_row_meta( $links, $file ) {
	if ( plugin_basename( __FILE__ ) !== $file ) {
		return $links;
	}

	$status = vba_get_ffmpeg_status();
	$label  = $status['ok'] ? '✅ FFmpeg found and executable' : '❌ FFmpeg missing / shell execution disabled';
	$links[] = '<span>' . esc_html( $label ) . '</span>';
	return $links;
}
add_filter( 'plugin_row_meta', 'vba_plugin_row_meta', 10, 2 );

function vba_is_derivative_attachment( $attachment_id ) {
	$attachment_id = absint( $attachment_id );
	if ( ! $attachment_id ) {
		return false;
	}

	if ( get_post_meta( $attachment_id, '_abu_video_quality', true ) ) {
		return true;
	}

	$post = get_post( $attachment_id );
	if ( ! $post || empty( $post->post_parent ) ) {
		return false;
	}

	$file_path = get_attached_file( $attachment_id );
	if ( ! $file_path ) {
		return false;
	}

	$normalized = wp_normalize_path( $file_path );
	$needle = '/abu-video/' . absint( $post->post_parent ) . '/';
	return false !== strpos( $normalized, $needle );
}

function vba_on_attachment_added( $attachment_id ) {
	if ( vba_is_derivative_attachment( $attachment_id ) ) {
		return;
	}

	$mime = get_post_mime_type( $attachment_id );
	if ( 'video/mp4' !== $mime ) {
		return;
	}

	vba_enqueue_attachment( $attachment_id );
}
add_action( 'add_attachment', 'vba_on_attachment_added' );

function vba_on_attachment_deleted( $attachment_id ) {
	$mime = get_post_mime_type( $attachment_id );
	if ( 'video/mp4' !== $mime ) {
		return;
	}

	vba_remove_from_queue( $attachment_id );
	vba_cleanup_derivatives( $attachment_id );
}
add_action( 'delete_attachment', 'vba_on_attachment_deleted' );

add_action( 'admin_post_vba_run_queue_now', 'vba_handle_run_queue_now' );
add_action( 'admin_post_vba_sync_derivatives', 'vba_handle_sync_derivatives' );

function vba_handle_run_queue_now() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Insufficient permissions.' );
	}

	$nonce = isset( $_REQUEST['vba_run_queue_nonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['vba_run_queue_nonce'] ) ) : '';
	if ( ! $nonce || ! wp_verify_nonce( $nonce, 'vba_run_queue_now' ) ) {
		wp_die( 'Invalid request.' );
	}

	if ( ! wp_next_scheduled( 'vba_process_video_queue' ) ) {
		wp_schedule_single_event( time() + 5, 'vba_process_video_queue' );
	}

	$redirect = wp_get_referer();
	if ( ! $redirect ) {
		$redirect = admin_url( 'options-general.php?page=vba-settings' );
	}

	wp_safe_redirect( $redirect );
	exit;
}