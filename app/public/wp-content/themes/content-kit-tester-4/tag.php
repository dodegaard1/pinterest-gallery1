<?php


$args = [
    'wfPage' => '67ae48cf8dc3c526a35483af',
    'body' => '',
    'head' => 'head/tag',
];   

if (function_exists('udesly_set_frontend_editor_data')) {
    udesly_set_frontend_editor_data('tag');
}
     
get_header('', $args);

udesly_get_content_template( 'tag' );

$args = [
  'footer' => 'footer/tag',
];  

if (function_exists('udesly_output_frontend_editor_data')) {
     udesly_output_frontend_editor_data('tag');
}

get_footer('', $args);
