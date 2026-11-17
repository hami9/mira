<?php
// فقط محیط آزمایشی وردپرس/ووکامرس: سفارش موقت می‌سازد و پاک می‌کند.
// MIRA_WP_FIXTURE=1 WP_LOAD_PATH=/var/www/html/wp-load.php MIRA_PLUGIN_DIR=/path/to/mira php tests/fixtures/wordpress-diagnostics.php
if (getenv('MIRA_WP_FIXTURE') !== '1') {
    fwrite(STDERR, "Set MIRA_WP_FIXTURE=1 only on a disposable test database.\n");
    exit(1);
}
require getenv('WP_LOAD_PATH') ?: '/var/www/html/wp-load.php';
$plugin_dir = getenv('MIRA_PLUGIN_DIR') ?: dirname(__DIR__, 2) . '/wordpress-plugin/mira';
if (!defined('MIRA_VERSION')) define('MIRA_VERSION', '1.5.4');
require_once $plugin_dir . '/includes/class-mira-woocommerce.php';
require_once $plugin_dir . '/includes/class-mira-rest-api.php';
function check($condition, $label) {
    if (!$condition) {
        throw new RuntimeException($label);
    }
}
$api = Mira_Rest_Api::instance();
check(Mira_WooCommerce::get_customer_context(null)['found'] === false, 'empty helper');
$empty = $api->handle_customer_context(new WP_REST_Request('GET'));
check(is_wp_error($empty) && $empty->get_error_data()['status'] === 400, 'empty identity rejected');
$status = $api->handle_status()->get_data();
check($status['woocommerceAvailable'] === true && $status['capabilities']['products'] === true, 'capabilities');
$invalid = new WP_REST_Request('GET');
$invalid->set_header('X-Mira-Api-Key', 'invalid-fixture-key');
check(is_wp_error($api->check_api_key($invalid)), 'invalid key');
add_filter('pre_option_mira_api_key', function () { return 'local-fixture-key-only'; });
rest_get_server();
$api->register_routes();
foreach (array(array('/mira/v1/status', '', 401), array('/mira/v1/status', 'local-fixture-key-only', 200), array('/mira/v1/customer-context', 'local-fixture-key-only', 400)) as $case) {
  $request = new WP_REST_Request('GET', $case[0]);
  $request->set_header('X-Mira-Api-Key', $case[1]);
  $response = rest_do_request($request);
  check($response->get_status() === $case[2], 'Unexpected route status ' . $response->get_status());
}
echo "REST routing passed: status 401/200, customer identity 400.\n";

$user = wp_create_user('mira-test-' . wp_generate_password(8, false), wp_generate_password(30), 'mira-' . wp_generate_password(8,false) . '@fixture.invalid');
check(!is_wp_error($user), 'fixture user');
$orders = array();
add_filter('pre_wp_mail', '__return_true');
try {
  for ($i = 0; $i < 12; $i++) {
    $order = wc_create_order(array('customer_id' => $user));
    $orders[] = $order;
    $order->set_total(100);
    $order->set_status($i === 0 ? 'cancelled' : 'completed');
    $order->save();
  }
  delete_user_meta($user, '_money_spent');
  delete_user_meta($user, '_order_count');
  $account = get_user_by('id', $user);
  $result = Mira_WooCommerce::get_customer_context($account->user_email);
  check($result['totalSpent'] === 1100.0, 'lifetime paid total excludes cancelled and exceeds ten');
  check(count($result['recentOrders']) === 10, 'bounded history');
  echo "Woo diagnostics fixture passed: capabilities, invalid key, missing identity, lifetime paid total, bounded history.\n";
} finally {
  foreach ($orders as $order) {
    $order->delete(true);
  }
  require_once ABSPATH . 'wp-admin/includes/user.php';
  wp_delete_user($user);
}

