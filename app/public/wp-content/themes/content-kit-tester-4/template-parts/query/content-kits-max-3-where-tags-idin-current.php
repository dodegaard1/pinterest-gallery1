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
  "posts_per_page" => 3,
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

$args = apply_filters('udesly/posts/content-kits-max-3-where-tags-idin-current', $args);
        
        $query = new WP_Query($args);
?>
<div class="collection-list-wrapper-2 section-1 w-dyn-list" udy-collection="posts">
          <?php if ( $query->have_posts() ) : ?><div role="list" class="collection-list-3 section-1 w-dyn-items">
            <?php while ($query->have_posts()) : $query->the_post(); global $post; ?><div role="listitem" class="collection-item-4 w-dyn-item">
              <a href="<?php the_permalink() ?>" class="link-block w-inline-block">
                <div data-w-id="6b519126-2410-b81e-2c07-8c7f8589d25e" class="gallery-item-desktop">
                  <div data-w-id="d61b3242-b9a3-fe3e-d43e-31f3b741cf69" style="color:rgb(51,51,51)" class="title-veniue-date-desktop">
                    <div class="desktop-wedding-name"><?php the_title() ?></div>
                    <div class="wedding-date-desktop"><?php echo udesly_get_custom_post_field( $post->ID, "date", "PlainText" ) ?></div>
                    <div class="div-block-10">
                      <div data-w-id="0e47817f-106a-5160-30eb-139a574971ad" style="background-color:rgb(0,0,0)" class="title-date-desktop">
                        <div class="desktop-venue-name"><?php echo udesly_get_custom_post_field( $post->ID, "venue", "PlainText" ) ?></div>
                      </div>
                    </div>
                  </div>
                  <div data-w-id="31bc58a7-cb9b-dfcb-4b43-21a2ae31acab" style="-webkit-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-moz-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-ms-transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);transform:translate3d(0, 0, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0) ;<?php echo "background-image: url('" . udesly_get_image()->src . "')" ?>" class="desktop-preview-image"></div>
                  <div id="w-node-_484ad7f9-03e1-70fb-a707-b2af67ebe35c-a35483af" class="arrow-holder-desktop"><img class="arrow" src="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->src ?>" alt="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->alt ?>" style="filter:invert(0%)" sizes="(max-width: 512px) 100vw, 512px" data-w-id="9e631d0d-f0af-443f-8148-e59852982328" loading="lazy" srcset="<?php echo udesly_get_image(_u('i611dcb39', 'img'))->srcset ?>" data-img="i611dcb39"></div>
                  <div data-w-id="fe24930a-139d-78da-fb67-ab7bc05025bb" style="opacity:0" class="gradient-background-desktop"></div>
                </div>
              </a>
            </div><?php endwhile; ?>
          </div>
          <?php else : ?><div class="w-dyn-empty">
            <div>No items found.</div>
          </div><?php endif; ?>
        </div>
<?php wp_reset_postdata(); ?>
 