<?php
// Exit if accessed directly
defined( 'ABSPATH' ) || exit;
?>
<?php
            if (function_exists('udesly_set_frontend_editor_data') && wp_doing_ajax()) {
              udesly_set_frontend_editor_data('tag');
          }
?>
<?php

        if (isset($_GET['p_id'])) {
          $paged = $_GET['p_id'];
        } else {
          $paged = isset($args['paged']) ? $args['paged'] : 1;  
        }
          
        

$args = [
  "post_type" => "post",
  "tax_query" => [
    "0" => [
      "taxonomy" => "post_tag",
      "field" => "id",
      "operator" => "IN",
      "terms" => [
        get_queried_object_id()
      ]
    ],
    "relation" => "AND"
  ],
  "paged" => $paged
];

$args = apply_filters('udesly/posts/content-kits-where-tags-idin-current', $args);
        
        $query = new WP_Query($args);
?>
<div class="content-kits-wrapper w-dyn-list" udy-collection="posts">
        <?php if ( $query->have_posts() ) : ?><div role="list" class="w-dyn-items">
          <?php while ($query->have_posts()) : $query->the_post(); global $post; ?><div role="listitem" class="collection-item w-dyn-item">
            <a href="<?php the_permalink() ?>" class="open-collection-page w-inline-block">
              <div class="gallery-thumbnail">
                <div id="w-node-db78981b-1be0-8d6b-73c8-bfb52bc1111a-a35483af" class="title-and-text">
                  <div class="title-and-date">
                    <div class="content-kit-name"><?php the_title() ?></div>
                    <div class="date"><?php echo udesly_get_custom_post_field( $post->ID, "date", "PlainText" ) ?></div>
                  </div>
                  <div id="w-node-_835e61cd-7c53-2fd2-b959-25d8f11b8255-a35483af" class="venue-holder">
                    <div class="venue"><?php echo udesly_get_custom_post_field( $post->ID, "venue", "PlainText" ) ?></div>
                  </div>
                </div>
                <div id="w-node-_129305b2-3f78-6913-46a2-9a08e18af11b-a35483af" class="div-block-3"><img src="<?php echo udesly_get_image()->src ?>" loading="lazy" alt="<?php echo udesly_get_image()->alt ?>" class="image-6" data-img="i317f733b" srcset="<?php echo udesly_get_image()->srcset ?>"></div>
              </div>
            </a>
          </div><?php endwhile; ?>
        </div>
        <?php else : ?><div class="w-dyn-empty">
          <div>No items found.</div>
        </div><?php endif; ?>
      </div>
<?php wp_reset_postdata(); ?>
 