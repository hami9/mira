<?php
// اگه مستقیم (نه از طریق حذف افزونه در وردپرس) صدا زده بشه، اجرا نشه
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'mira_api_url' );
delete_option( 'mira_widget_key' );
delete_option( 'mira_api_key' );
delete_option( 'mira_widget_color' );
delete_option( 'mira_widget_position' );
delete_option( 'mira_abandoned_cart_enabled' );
delete_option( 'mira_abandoned_cart_delay' );
delete_option( 'mira_abandoned_cart_message' );
