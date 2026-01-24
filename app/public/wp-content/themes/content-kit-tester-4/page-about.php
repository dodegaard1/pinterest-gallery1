<?php


$args = [
    'wfPage' => '67c1f30e1244a60a2eeb6f9f',
    'body' => 'body',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('page-about');
}
     
get_header('', $args);

/* Start the Loop */
while ( have_posts() ) :
    the_post();
    udesly_get_content_template( 'page-about' );
endwhile;
// End of the loop.

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('page-about');
}

get_footer('', $args);
