<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * تزریق اسکریپت ویجت میرا — فقط در فرانت‌اند سایت، هیچ‌وقت داخل wp-admin
 */
class Mira_Widget_Loader {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// wp_footer فقط در قالب‌های فرانت‌اند اجرا می‌شه؛ is_admin() هم برای اطمینان دوباره چک می‌شه
		add_action( 'wp_footer', array( $this, 'render_widget_script' ) );
	}

	public function render_widget_script() {
		if ( is_admin() ) {
			return;
		}

		$api_url    = get_option( 'mira_api_url', '' );
		$widget_key = get_option( 'mira_widget_key', '' );

		if ( empty( $api_url ) || empty( $widget_key ) ) {
			return; // افزونه هنوز تنظیم نشده
		}

		$attributes = array(
			'data-widget-key' => $widget_key,
			'data-api-url'    => untrailingslashit( $api_url ),
			'data-color'      => get_option( 'mira_widget_color', '#2E6BE6' ),
			'data-position'   => get_option( 'mira_widget_position', 'bottom-right' ),
		);

		// اگه کاربر در وردپرس وارد شده باشه، نام/ایمیلش خودکار به ویجت پاس داده می‌شه (پیش‌فرم خودکار)
		if ( is_user_logged_in() ) {
			$current_user = wp_get_current_user();
			if ( $current_user->exists() ) {
				$attributes['data-visitor-name']  = $current_user->display_name;
				$attributes['data-visitor-email'] = $current_user->user_email;
			}
		}

		// پیام محرک سبد رهاشده (فقط اگه بازدیدکننده‌ی فعلی سبد غیرخالی داشته باشه)
		$abandoned_cart_trigger = Mira_WooCommerce::get_abandoned_cart_trigger();
		if ( $abandoned_cart_trigger ) {
			$attributes['data-trigger-text']  = $abandoned_cart_trigger['text'];
			$attributes['data-trigger-delay'] = $abandoned_cart_trigger['delaySeconds'];
		}

		$attribute_html = '';
		foreach ( $attributes as $name => $value ) {
			$attribute_html .= sprintf( ' %s="%s"', esc_attr( $name ), esc_attr( (string) $value ) );
		}

		printf(
			'<script src="%s"%s></script>' . "\n",
			esc_url( untrailingslashit( $api_url ) . '/widget-dist/widget.js' ),
			$attribute_html // phpcs:ignore WordPress.Security.EscapeOutput -- هر مقدار قبلاً با esc_attr پاک‌سازی شده
		);
	}
}
