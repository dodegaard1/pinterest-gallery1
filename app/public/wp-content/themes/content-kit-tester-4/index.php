<?php


$args = [
    'wfPage' => '67af910a80505d210a76d1d7',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('front-page');
}
     
get_header('', $args);

udesly_get_content_template( 'front-page' );

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('front-page');
}

get_footer('', $args);
