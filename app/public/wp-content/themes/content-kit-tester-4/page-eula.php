<?php


$args = [
    'wfPage' => '67d477c5ace9711453fe4355',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('page-eula');
}
     
get_header('', $args);

/* Start the Loop */
while ( have_posts() ) :
    the_post();
    udesly_get_content_template( 'page-eula' );
endwhile;
// End of the loop.

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('page-eula');
}

get_footer('', $args);
