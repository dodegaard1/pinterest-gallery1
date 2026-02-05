<?php
/**
 * Template for Organization taxonomy archive pages.
 * 
 * Displays all Content Kits tagged with this organization.
 * Functions as a dashboard for users affiliated with this organization.
 * 
 * @package ABU_Pinterest_Gallery
 */

defined( 'ABSPATH' ) || exit;

get_header();

$term = get_queried_object();

?>

<div id="primary" class="content-area abu-organization-page">
	<main id="main" class="site-main">

		<header class="page-header organization-header">
			<h1 class="page-title"><?php echo esc_html( $term->name ); ?></h1>
			
			<?php if ( $term->description ) : ?>
				<div class="taxonomy-description">
					<?php echo wp_kses_post( wpautop( $term->description ) ); ?>
				</div>
			<?php endif; ?>
		</header>

		<div class="organization-content-kits">
			<?php
			// Query Content Kits tagged with this organization
			$kits_query = new WP_Query(
				array(
					'post_type'      => 'abu_content_kit',
					'post_status'    => 'publish',
					'posts_per_page' => 20,
					'orderby'        => 'date',
					'order'          => 'DESC',
					'tax_query'      => array(
						array(
							'taxonomy' => 'abu_organization',
							'field'    => 'term_id',
							'terms'    => $term->term_id,
						),
					),
				)
			);

			if ( $kits_query->have_posts() ) :
				?>
				<div class="content-kits-grid">
					<?php
					while ( $kits_query->have_posts() ) :
						$kits_query->the_post();
						?>
						<article id="post-<?php the_ID(); ?>" <?php post_class( 'content-kit-card' ); ?>>
							<?php if ( has_post_thumbnail() ) : ?>
								<div class="kit-thumbnail">
									<a href="<?php the_permalink(); ?>">
										<?php the_post_thumbnail( 'medium_large' ); ?>
									</a>
								</div>
							<?php endif; ?>
							
							<div class="kit-card-content">
								<h2 class="kit-title">
									<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
								</h2>
								
								<?php if ( has_excerpt() ) : ?>
									<div class="kit-excerpt">
										<?php the_excerpt(); ?>
									</div>
								<?php endif; ?>
								
								<div class="kit-meta">
									<time class="kit-date" datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>">
										<?php echo esc_html( get_the_date() ); ?>
									</time>
									
									<?php
									// Show tile count if available
									$chapters_json = get_post_meta( get_the_ID(), 'abu_pg_chapters_json', true );
									$chapters = abu_pg_parse_chapters( $chapters_json );
									if ( $chapters ) {
										$total_tiles = 0;
										foreach ( $chapters as $chapter ) {
											if ( ! empty( $chapter['tileIds'] ) ) {
												$total_tiles += count( $chapter['tileIds'] );
											}
										}
										if ( $total_tiles > 0 ) {
											?>
											<span class="kit-tile-count">
												<?php
												printf(
													/* translators: %s: number of tiles */
													_n( '%s tile', '%s tiles', $total_tiles, 'abu-pg' ),
													number_format_i18n( $total_tiles )
												);
												?>
											</span>
											<?php
										}
									}
									?>
								</div>
								
								<a href="<?php the_permalink(); ?>" class="kit-view-button">
									<?php _e( 'View Gallery', 'abu-pg' ); ?>
								</a>
							</div>
						</article>
						<?php
					endwhile;
					?>
				</div>
				
				<?php
				// Pagination
				the_posts_pagination(
					array(
						'mid_size'  => 2,
						'prev_text' => __( '&laquo; Previous', 'abu-pg' ),
						'next_text' => __( 'Next &raquo;', 'abu-pg' ),
					)
				);
				?>
				
				<?php
				wp_reset_postdata();
			else :
				?>
				<div class="no-content-kits">
					<?php if ( current_user_can( 'edit_posts' ) ) : ?>
						<p><?php _e( 'No content kits found for this organization.', 'abu-pg' ); ?></p>
						<p>
							<a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=abu_content_kit' ) ); ?>" class="button">
								<?php _e( 'Create First Content Kit', 'abu-pg' ); ?>
							</a>
						</p>
					<?php else : ?>
						<p><?php _e( 'No galleries available yet.', 'abu-pg' ); ?></p>
					<?php endif; ?>
				</div>
				<?php
			endif;
			?>
		</div>

	</main>
</div>

<style>
/* Basic styling for organization page */
.abu-organization-page .organization-header {
	margin-bottom: 2rem;
	padding-bottom: 1.5rem;
	border-bottom: 2px solid #e5e5e5;
}

.abu-organization-page .page-title {
	font-size: 2.5rem;
	margin-bottom: 0.5rem;
}

.abu-organization-page .taxonomy-description {
	color: #666;
	font-size: 1.1rem;
	max-width: 800px;
}

.content-kits-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 2rem;
	margin: 2rem 0;
}

.content-kit-card {
	background: #fff;
	border: 1px solid #ddd;
	border-radius: 8px;
	overflow: hidden;
	transition: transform 0.2s, box-shadow 0.2s;
}

.content-kit-card:hover {
	transform: translateY(-4px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.content-kit-card .kit-thumbnail {
	aspect-ratio: 16 / 9;
	overflow: hidden;
	background: #f5f5f5;
}

.content-kit-card .kit-thumbnail img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.3s;
}

.content-kit-card:hover .kit-thumbnail img {
	transform: scale(1.05);
}

.content-kit-card .kit-card-content {
	padding: 1.5rem;
}

.content-kit-card .kit-title {
	font-size: 1.4rem;
	margin: 0 0 0.5rem;
}

.content-kit-card .kit-title a {
	color: #333;
	text-decoration: none;
}

.content-kit-card .kit-title a:hover {
	color: #0073aa;
}

.content-kit-card .kit-excerpt {
	color: #666;
	font-size: 0.95rem;
	margin-bottom: 1rem;
	line-height: 1.5;
}

.content-kit-card .kit-meta {
	display: flex;
	gap: 1rem;
	font-size: 0.85rem;
	color: #999;
	margin-bottom: 1rem;
}

.content-kit-card .kit-view-button {
	display: inline-block;
	padding: 0.5rem 1.5rem;
	background: #0073aa;
	color: #fff;
	text-decoration: none;
	border-radius: 4px;
	font-size: 0.9rem;
	transition: background 0.2s;
}

.content-kit-card .kit-view-button:hover {
	background: #005177;
}

.no-content-kits {
	text-align: center;
	padding: 4rem 2rem;
	color: #666;
}

.no-content-kits p {
	font-size: 1.1rem;
	margin-bottom: 1.5rem;
}

.no-content-kits .button {
	display: inline-block;
	padding: 0.75rem 2rem;
	background: #0073aa;
	color: #fff;
	text-decoration: none;
	border-radius: 4px;
	transition: background 0.2s;
}

.no-content-kits .button:hover {
	background: #005177;
}

/* Responsive */
@media (max-width: 768px) {
	.content-kits-grid {
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}
	
	.abu-organization-page .page-title {
		font-size: 2rem;
	}
}
</style>

<?php
get_sidebar();
get_footer();
