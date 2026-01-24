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

$args = apply_filters('udesly/posts/content-kits-where-tags-idin-current-v0', $args);
        
        $query = new WP_Query($args);
?>
<div class="collection-list-wrapper-2 w-dyn-list" udy-collection="posts">
          <?php if ( $query->have_posts() ) : ?><div role="list" class="collection-list-3 section-3 w-dyn-items">
            <?php while ($query->have_posts()) : $query->the_post(); global $post; ?><div role="listitem" class="collection-item-3 w-dyn-item">
              <a href="<?php the_permalink() ?>" class="link-block-3 w-inline-block">
                <div data-w-id="9f408214-c386-da7b-7eb1-815cea81391a" style="-webkit-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-moz-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-ms-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);background-color:rgba(0,0,0,0.34)" class="gallery-item-desktop section-3">
                  <div class="title-veniue-date-desktop section-3">
                    <div class="desktop-wedding-name"><?php the_title() ?></div>
                    <div class="wedding-date-desktop"><?php echo udesly_get_custom_post_field( $post->ID, "date", "PlainText" ) ?></div>
                    <div class="div-block-10 section-3">
                      <div data-w-id="9f408214-c386-da7b-7eb1-815cea81391f" style="background-color:rgba(0,0,0,0.81)" class="title-date-desktop section-3">
                        <div data-w-id="9f408214-c386-da7b-7eb1-815cea813920" style="color:rgb(255,255,255)" class="desktop-venue-name"><?php echo udesly_get_custom_post_field( $post->ID, "venue", "PlainText" ) ?></div>
                      </div>
                    </div>
                  </div>
                  <div class="desktop-preview-image section-3" style="<?php echo "background-image: url('" . udesly_get_image()->src . "')" ?>"></div>
                  <div id="w-node-_9f408214-c386-da7b-7eb1-815cea813924-a35483af" class="arrow-holder-desktop"><img src="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->src ?>" loading="lazy" sizes="(max-width: 512px) 100vw, 512px" srcset="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->srcset ?>" alt="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->alt ?>" class="arrow section-3" data-img="i611dcb39"></div>
                  <div class="gradient-background-desktop"></div>
                </div>
              </a>
            </div><?php endwhile; ?>
          </div>
          <?php else : ?><div class="w-dyn-empty">
            <div>No items found.</div>
          </div><?php endif; ?>
        </div>
<?php wp_reset_postdata(); ?>
 