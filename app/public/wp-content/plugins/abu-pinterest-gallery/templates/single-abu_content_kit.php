<?php
/**
 * Template for single Content Kit posts.
 * 
 * This template automatically renders the masonry gallery for a Content Kit.
 * It loads chapter data from the kit's post meta and displays the gallery.
 * 
 * @package ABU_Pinterest_Gallery
 */

defined( 'ABSPATH' ) || exit;

get_header();

?>

<div id="primary" class="content-area">
	<main id="main" class="site-main">

		<?php
		while ( have_posts() ) :
			the_post();
			?>

			<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
				
				<header class="entry-header">
					<?php the_title( '<h1 class="entry-title">', '</h1>' ); ?>
					
					<?php if ( has_excerpt() ) : ?>
						<div class="entry-excerpt">
							<?php the_excerpt(); ?>
						</div>
					<?php endif; ?>
				</header>

				<div class="entry-content">
					<?php
					// Auto-render the gallery for this Content Kit
					// Note: The shortcode renders the masonry gallery from post meta
					echo do_shortcode( '[abu_pinterest_gallery]' );
					?>
				</div>

			</article>

		<?php endwhile; ?>

	</main>
</div>

<?php
get_sidebar();
get_footer();
