<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST endpoint سفارشی که بک‌اند میرا سرور-به-سرور صداش می‌زنه (نه مرورگر بازدیدکننده)
 * احراز هویت با هدر X-Mira-Api-Key، نه کوکی/نشست وردپرس
 */
class Mira_Rest_Api {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() {
		register_rest_route(
			'mira/v1',
			'/customer-context',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_customer_context' ),
				'permission_callback' => array( $this, 'check_api_key' ),
				'args'                => array(
					'email' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_email',
						'validate_callback' => function ( $value ) {
							return is_email( $value );
						},
					),
				),
			)
		);
	}

	/**
	 * مقایسه‌ی timing-safe با hash_equals تا مقدار کلید از طریق زمان‌سنجی پاسخ لو نره
	 */
	public function check_api_key( WP_REST_Request $request ) {
		$configured_key = get_option( 'mira_api_key', '' );
		if ( empty( $configured_key ) ) {
			return new WP_Error( 'mira_not_configured', 'کلید API تنظیم نشده است', array( 'status' => 403 ) );
		}

		$provided_key = $request->get_header( 'x-mira-api-key' );
		if ( empty( $provided_key ) || ! hash_equals( $configured_key, $provided_key ) ) {
			return new WP_Error( 'mira_unauthorized', 'کلید API نامعتبر است', array( 'status' => 401 ) );
		}

		return true;
	}

	public function handle_customer_context( WP_REST_Request $request ) {
		$email   = $request->get_param( 'email' );
		$context = Mira_WooCommerce::get_customer_context( $email );
		return new WP_REST_Response( $context, 200 );
	}
}
