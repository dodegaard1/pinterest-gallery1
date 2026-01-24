<?php
// Exit if accessed directly
defined( 'ABSPATH' ) || exit;
?>
<?php
            if (function_exists('udesly_set_frontend_editor_data') && wp_doing_ajax()) {
              udesly_set_frontend_editor_data('page-guide');
          }
?>
<?php

        if (isset($_GET['p_id'])) {
          $paged = $_GET['p_id'];
        } else {
          $paged = isset($args['paged']) ? $args['paged'] : 1;  
        }
          
        

$args = [
  "post_type" => "website-assets",
  "meta_query" => [
    "relation" => "AND",
    [
      "key" => "page-location",
      "value" => "Guide",
      "compare" => "=="
    ]
  ],
  "paged" => $paged
];

$args = apply_filters('udesly/posts/website-assets-where-page-location-eq-guide', $args);
        
        $query = new WP_Query($args);
?>
<div class="w-dyn-list" udy-collection="website-assets">
        <?php if ( $query->have_posts() ) : ?><div role="list" class="w-dyn-items">
          <?php while ($query->have_posts()) : $query->the_post(); global $post; ?><div role="listitem" class="w-dyn-item">
            <div class="video-3 w-video w-embed" style="aspect-ratio: 16 / 9;"><?php echo wp_oembed_get(udesly_get_custom_post_field( $post->ID, "video-link-vimeo-youtube", "Video" )) ?></div>
          </div><?php endwhile; ?>
        </div>
        <?php else : ?><div class="w-dyn-empty">
          <div>No items found.</div>
        </div><?php endif; ?>
      </div>
<?php wp_reset_postdata(); ?>
 