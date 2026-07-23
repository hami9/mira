<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * توابع کمکی ووکامرس — همه از API رسمی WooCommerce (wc_get_orders و ...) استفاده می‌کنن،
 * هیچ کوئری مستقیم SQL نوشته نشده (طبق الزام امنیتی پرامپت پروژه)
 */
class Mira_WooCommerce {

	/**
	 * سبد فعلی، تاریخچه سفارش، مجموع خرید و وضعیت آخرین سفارش یک مشتری بر اساس ایمیل
	 */
	public static function get_customer_context( $email ) {
		$default = array(
			'found'           => false,
			'customerName'    => null,
			'totalSpent'      => 0,
			'currency'        => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'IRR',
			'lastOrderStatus' => null,
			'lastOrderDate'   => null,
			'recentOrders'    => array(),
			'currentCart'     => null,
		);

		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_orders' ) ) {
			return $default;
		}

		$user = get_user_by( 'email', $email );

		$orders = wc_get_orders(
			array(
				'limit'    => 10,
				'orderby'  => 'date',
				'order'    => 'DESC',
				'customer' => $user ? $user->ID : $email,
			)
		);

		if ( empty( $orders ) ) {
			return $default;
		}

		$total_spent   = 0;
		$recent_orders = array();
		foreach ( $orders as $order ) {
			$total_spent    += (float) $order->get_total();
			$recent_orders[] = array(
				'id'        => $order->get_id(),
				'status'    => $order->get_status(),
				'total'     => (float) $order->get_total(),
				'currency'  => $order->get_currency(),
				'createdAt' => $order->get_date_created() ? $order->get_date_created()->format( 'c' ) : null,
			);
		}

		$last_order   = $orders[0];
		$billing_name = trim( $last_order->get_billing_first_name() . ' ' . $last_order->get_billing_last_name() );

		return array(
			'found'           => true,
			'customerName'    => '' !== $billing_name ? $billing_name : ( $user ? $user->display_name : null ),
			'totalSpent'      => $total_spent,
			'currency'        => $last_order->get_currency(),
			'lastOrderStatus' => $last_order->get_status(),
			'lastOrderDate'   => $last_order->get_date_created() ? $last_order->get_date_created()->format( 'c' ) : null,
			'recentOrders'    => $recent_orders,
			// سبد فقط برای نشست/کاربر فعلی مرورگر معنی داره، نه برای یک ایمیل دلخواه که از سرور دیگه صدا زده می‌شه
			'currentCart'     => null,
		);
	}

	/**
	 * برای پیام محرک سبد رهاشده — فقط وقتی بازدیدکننده‌ی همین نشست سبد غیرخالی دارد
	 */
	public static function get_abandoned_cart_trigger() {
		if ( ! get_option( 'mira_abandoned_cart_enabled' ) ) {
			return null;
		}
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) || null === WC()->cart ) {
			return null;
		}
		if ( WC()->cart->is_empty() ) {
			return null;
		}

		$message = get_option( 'mira_abandoned_cart_message', '' );
		if ( empty( $message ) ) {
			return null;
		}

		return array(
			'text'         => $message,
			'delaySeconds' => (int) get_option( 'mira_abandoned_cart_delay', 120 ),
		);
	}

	/**
	 * سبد فعلی نشست مرورگر — برای نمایش در پنل مشتری کنار گفتگو استفاده نمی‌شه (چون از سمت سرور
	 * دیگه صدا زده می‌شه و به نشست بازدیدکننده دسترسی نداره)؛ فقط برای front-end همین نشست کاربردیه
	 */
	public static function get_current_session_cart_summary() {
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'WC' ) || null === WC()->cart ) {
			return null;
		}
		if ( WC()->cart->is_empty() ) {
			return null;
		}
		return array(
			'itemsCount' => WC()->cart->get_cart_contents_count(),
			'total'      => (float) WC()->cart->get_total( 'edit' ),
		);
	}
}
