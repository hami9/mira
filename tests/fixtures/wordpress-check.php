<?php
// این فایل فقط برای سایت موقت تست است؛ داده‌ی تجاری را تغییر نمی‌دهد.
if ( getenv( 'MIRA_WP_FIXTURE' ) !== '1' ) {
    throw new RuntimeException( 'Fixture environment required' );
}
$ids = array();
$original_key = get_option( 'mira_api_key', '' );
$GLOBALS['mira_fixture_checks'] = 0;
function fixture_assert( $condition, $message ) {
    if ( ! $condition ) { throw new RuntimeException( $message ); }
    ++$GLOBALS['mira_fixture_checks'];
}
function fixture_request( $key, $products = '1', $pages = '1' ) {
    $request = new WP_REST_Request( 'GET', '/mira/v1/ai-context' );
    $request->set_header( 'X-Mira-Api-Key', $key );
    $request->set_param( 'search', 'mira-fixture' );
    $request->set_param( 'products', $products );
    $request->set_param( 'pages', $pages );
    return rest_do_request( $request );
}
try {
    update_option( 'mira_api_key', 'fixture-ai-key' );
    wp_set_current_user( 0 );
    foreach ( array( 'publish', 'private', 'draft', 'password' ) as $status ) {
        $ids[] = wp_insert_post( array(
            'post_type' => 'page', 'post_title' => 'mira-fixture ' . $status,
            'post_content' => 'mira-fixture public shipping information',
            'post_status' => $status === 'password' ? 'publish' : $status,
            'post_password' => $status === 'password' ? 'fixture-password' : '',
        ) );
    }
    $product = new WC_Product_Simple();
    $product->set_name( 'mira-fixture cable' );
    $product->set_regular_price( '125000' );
    $product->set_status( 'publish' );
    $product->set_stock_status( 'instock' );
    $ids[] = $product->save();
    $hidden = new WC_Product_Simple();
    $hidden->set_name( 'mira-fixture hidden' );
    $hidden->set_regular_price( '999' );
    $hidden->set_catalog_visibility( 'hidden' );
    $hidden->set_status( 'publish' );
    $ids[] = $hidden->save();

    fixture_assert( fixture_request( '' )->get_status() === 401, 'Missing key must fail' );
    fixture_assert( fixture_request( 'wrong-key' )->get_status() === 401, 'Wrong key must fail' );
    $response = fixture_request( 'fixture-ai-key' );
    fixture_assert( $response->get_status() === 200, 'Context request failed' );
    $data = $response->get_data();
    fixture_assert( count( $data['products'] ) === 1, 'Only visible products must be returned' );
    fixture_assert( $data['products'][0]['price'] === '125000', 'Price must come from WooCommerce' );
    fixture_assert( $data['products'][0]['inStock'] === true, 'Stock must come from WooCommerce' );
    fixture_assert( count( $data['documents'] ) === 1, 'Only public passwordless pages must be returned' );
    fixture_assert( $data['documents'][0]['id'] === (string) $ids[0], 'Wrong document returned' );
    fixture_assert( $response->get_headers()['Cache-Control'] === 'no-store', 'Context must not be cached' );
    $disabled = fixture_request( 'fixture-ai-key', '0', '0' )->get_data();
    fixture_assert( $disabled['products'] === array() && $disabled['documents'] === array(), 'Disabled sources must be empty' );
    echo 'WordPress AI checks passed: ' . $GLOBALS['mira_fixture_checks'] . "\n";
} finally {
    foreach ( $ids as $id ) { wp_delete_post( $id, true ); }
    update_option( 'mira_api_key', $original_key );
}
