<?php


$args = [
    'wfPage' => '67d47d48db20f4ec86145298',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('page-privacy-policy');
}
     
get_header('', $args);

/* Start the Loop */
while ( have_posts() ) :
    the_post();
    udesly_get_content_template( 'page-privacy-policy' );
endwhile;
// End of the loop.

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('page-privacy-policy');
}

get_footer('', $args);
