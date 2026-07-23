<?php
/**
 * Plugin Name:       میرا
 * Plugin URI:        https://mira.example.com
 * Description:       اتصال ویجت لایو چت میرا (خودمیزبان) به وردپرس/ووکامرس — نمایش ویجت در فرانت‌اند و پنل مشتری ووکامرس کنار گفتگو.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            KG Kala
 * Text Domain:       mira
 * Domain Path:       /languages
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 */

// جلوگیری از دسترسی مستقیم به فایل
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MIRA_VERSION', '0.1.0' );
define( 'MIRA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'MIRA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once MIRA_PLUGIN_DIR . 'includes/class-mira-settings.php';
require_once MIRA_PLUGIN_DIR . 'includes/class-mira-woocommerce.php';
require_once MIRA_PLUGIN_DIR . 'includes/class-mira-widget-loader.php';
require_once MIRA_PLUGIN_DIR . 'includes/class-mira-rest-api.php';

/**
 * راه‌اندازی اجزای افزونه بعد از لود شدن کامل وردپرس (تا WooCommerce هم اگه فعال باشه لود شده باشه)
 */
function mira_bootstrap() {
	Mira_Settings::instance();
	Mira_Widget_Loader::instance();
	Mira_Rest_Api::instance();
}
add_action( 'plugins_loaded', 'mira_bootstrap' );

/**
 * هنگام فعال‌سازی، یک کلید API تصادفی امن پیش‌فرض می‌سازیم (نه خالی و نه هاردکد)
 */
function mira_activate() {
	if ( false === get_option( 'mira_api_key' ) ) {
		add_option( 'mira_api_key', wp_generate_password( 32, false ) );
	}
}
register_activation_hook( __FILE__, 'mira_activate' );
