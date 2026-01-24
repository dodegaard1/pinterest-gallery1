<?php
// Exit if accessed directly
defined( 'ABSPATH' ) || exit;
?>
<?php 

            if (function_exists('udesly_set_frontend_editor_data') && wp_doing_ajax()) {
              udesly_set_frontend_editor_data('single');
          }

                global $post;
                $sub_posts_ids = get_the_terms( $post->ID, "post_tag");
                $sub_posts = [];
                $limit = 100;
                $i = 1;
                if (is_array($sub_posts_ids)) {
                  foreach ($sub_posts_ids as $sub_posts_id) {
                    if ($i > $limit) {
                      break;
                    }
                    $sub_posts[] = get_term($sub_posts_id);
                    $i++;
                  }
                }
                $count = count($sub_posts);
                
            ?>
                <div data-w-id="39b913db-560b-c667-8b8b-7c9abb7dad6f" style="-webkit-transform:translate3d(0, 10px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-moz-transform:translate3d(0, 10px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);-ms-transform:translate3d(0, 10px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);transform:translate3d(0, 10px, 0) scale3d(1, 1, 1) rotateX(0) rotateY(0) rotateZ(0) skew(0, 0);opacity:0" class="collection-list-wrapper w-dyn-list" udy-collection="tags">
          <?php if ( $count > 0 ) : ?><div role="list" class="collection-list-2 w-dyn-items">
            <?php foreach ($sub_posts as $term) : ?><div role="listitem" class="collection-item-2 w-dyn-item">
              <div class="text-block-5"><?php echo udesly_get_custom_term_field( $term->term_id, "instagram-handle", "PlainText" ) ?></div>
            </div><?php endforeach ?>
          </div>
          <?php else : ?><div class="empty-state w-dyn-empty">
            <div>No items found.</div>
          </div><?php endif; ?>
        </div>
 