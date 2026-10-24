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
		register_rest_route( 'mira/v1', '/ai-context', array(
			'methods' => 'GET',
			'callback' => array( $this, 'handle_ai_context' ),
			'permission_callback' => array( $this, 'check_api_key' ),
			'args' => array(
				'search' => array( 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
				'products' => array( 'default' => '0', 'enum' => array( '0', '1' ) ),
				'pages' => array( 'default' => '0', 'enum' => array( '0', '1' ) ),
			),
		) );
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

	/** فقط محتوای عمومی منتشرشده؛ بدون سفارش، حساب مشتری، پیش‌نویس یا محتوای رمزدار. */
	public function handle_ai_context( WP_REST_Request $request ) {
		$search = (string) $request->get_param( 'search' );
		if ( '' === trim( $search ) || strlen( $search ) > 1000 ) {
			return new WP_Error( 'mira_invalid_search', 'عبارت جستجو معتبر نیست', array( 'status' => 400 ) );
		}
		$result = array( 'products' => array(), 'documents' => array() );
		$common = array( 'post_status' => 'publish', 'has_password' => false, 's' => $search, 'no_found_rows' => true );
		if ( '1' === $request->get_param( 'products' ) && function_exists( 'wc_get_product' ) ) {
			$query = new WP_Query( array_merge( $common, array( 'post_type' => 'product', 'posts_per_page' => 6 ) ) );
			foreach ( $query->posts as $post ) {
				$product = wc_get_product( $post->ID );
				if ( ! $product || ! $product->is_visible() || ! $product->is_purchasable() || '' === $product->get_price() ) {
					continue;
				}
				$result['products'][] = array(
					'id' => (string) $product->get_id(),
					'name' => wp_strip_all_tags( $product->get_name() ),
					'url' => $product->get_permalink(),
					'imageUrl' => wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ) ?: null,
					'price' => (string) wc_get_price_to_display( $product ),
					'currency' => get_woocommerce_currency(),
					'inStock' => $product->is_in_stock(),
					'priceIsMinimum' => $product->is_type( 'variable' ),
					'description' => wp_html_excerpt( wp_strip_all_tags( strip_shortcodes( $product->get_short_description() ?: $product->get_description() ) ), 800, '' ),
				);
			}
		}
		if ( '1' === $request->get_param( 'pages' ) ) {
			$query = new WP_Query( array_merge( $common, array( 'post_type' => array( 'page', 'post' ), 'posts_per_page' => 5 ) ) );
			foreach ( $query->posts as $post ) {
				$result['documents'][] = array(
					'id' => (string) $post->ID,
					'title' => wp_strip_all_tags( $post->post_title ),
					'url' => get_permalink( $post ),
					'content' => wp_html_excerpt( wp_strip_all_tags( strip_shortcodes( $post->post_content ) ), 3000, '' ),
				);
			}
		}
		$response = new WP_REST_Response( $result, 200 );
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
