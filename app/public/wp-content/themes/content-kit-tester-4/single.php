<?php


$args = [
    'wfPage' => '67ae496f5db0a32a0892d645',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('single');
}
     
get_header('', $args);

/* Start the Loop */
while ( have_posts() ) :
    the_post();
    udesly_get_content_template( 'single' );
endwhile;
// End of the loop.

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('single');
}

get_footer('', $args);
