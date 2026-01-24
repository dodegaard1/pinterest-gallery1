<?php
// Exit if accessed directly
defined( 'ABSPATH' ) || exit;
?>
<?php

$args = wp_parse_args($args, [
        'footer' => 'footer/front-page',
]);

get_template_part('template-parts/' . $args['footer']);

wp_footer();   

?>
    </body>
</html>
 