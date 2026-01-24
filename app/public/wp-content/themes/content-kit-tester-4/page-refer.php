<?php


$args = [
    'wfPage' => '67c5e8e2e651d957b48ebe75',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('page-refer');
}
     
get_header('', $args);

/* Start the Loop */
while ( have_posts() ) :
    the_post();
    udesly_get_content_template( 'page-refer' );
endwhile;
// End of the loop.

$args = [
  'footer' => 'footer/page-refer',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('page-refer');
}

get_footer('', $args);
