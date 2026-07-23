<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * صفحه تنظیمات افزونه در پیشخوان — با Settings API وردپرس (نانس/CSRF و sanitize خودکار)
 */
class Mira_Settings {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function add_settings_page() {
		add_options_page(
			__( 'تنظیمات میرا', 'mira' ),
			'میرا',
			'manage_options',
			'mira-settings',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting(
			'mira_settings_group',
			'mira_api_url',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_widget_key',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_api_key',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_widget_color',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_color' ),
				'default'           => '#2563eb',
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_widget_position',
			array(
				'type'              => 'string',
				'sanitize_callback' => array( $this, 'sanitize_position' ),
				'default'           => 'bottom-right',
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_abandoned_cart_enabled',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'default'           => false,
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_abandoned_cart_delay',
			array(
				'type'              => 'integer',
				'sanitize_callback' => 'absint',
				'default'           => 120,
			)
		);
		register_setting(
			'mira_settings_group',
			'mira_abandoned_cart_message',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
				'default'           => '',
			)
		);
	}

	public function sanitize_color( $value ) {
		$sanitized = sanitize_hex_color( $value );
		return $sanitized ? $sanitized : '#2563eb';
	}

	public function sanitize_position( $value ) {
		return in_array( $value, array( 'bottom-right', 'bottom-left' ), true ) ? $value : 'bottom-right';
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'تنظیمات میرا', 'mira' ); ?></h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'mira_settings_group' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mira_api_url"><?php esc_html_e( 'آدرس بک‌اند میرا', 'mira' ); ?></label></th>
						<td>
							<input type="url" id="mira_api_url" name="mira_api_url"
								value="<?php echo esc_attr( get_option( 'mira_api_url', '' ) ); ?>"
								class="regular-text" placeholder="https://chat.example.com" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mira_widget_key"><?php esc_html_e( 'کلید ویجت (Widget Key)', 'mira' ); ?></label></th>
						<td>
							<input type="text" id="mira_widget_key" name="mira_widget_key"
								value="<?php echo esc_attr( get_option( 'mira_widget_key', '' ) ); ?>" class="regular-text" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mira_api_key"><?php esc_html_e( 'کلید API', 'mira' ); ?></label></th>
						<td>
							<input type="text" id="mira_api_key" name="mira_api_key"
								value="<?php echo esc_attr( get_option( 'mira_api_key', '' ) ); ?>" class="regular-text" />
							<p class="description">
								<?php esc_html_e( 'همین مقدار را در تنظیمات داشبورد میرا («اتصال وردپرس/ووکامرس») هم وارد کن تا درخواست‌های سرور-به-سرور احراز هویت بشن.', 'mira' ); ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mira_widget_color"><?php esc_html_e( 'رنگ ویجت', 'mira' ); ?></label></th>
						<td>
							<input type="text" id="mira_widget_color" name="mira_widget_color"
								value="<?php echo esc_attr( get_option( 'mira_widget_color', '#2563eb' ) ); ?>" class="regular-text" placeholder="#2563eb" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="mira_widget_position"><?php esc_html_e( 'موقعیت ویجت', 'mira' ); ?></label></th>
						<td>
							<?php $current_position = get_option( 'mira_widget_position', 'bottom-right' ); ?>
							<select id="mira_widget_position" name="mira_widget_position">
								<option value="bottom-right" <?php selected( $current_position, 'bottom-right' ); ?>><?php esc_html_e( 'پایین راست', 'mira' ); ?></option>
								<option value="bottom-left" <?php selected( $current_position, 'bottom-left' ); ?>><?php esc_html_e( 'پایین چپ', 'mira' ); ?></option>
							</select>
						</td>
					</tr>
				</table>

				<?php if ( class_exists( 'WooCommerce' ) ) : ?>
					<h2><?php esc_html_e( 'پیام محرک سبد خرید رهاشده', 'mira' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="mira_abandoned_cart_enabled"><?php esc_html_e( 'فعال باشد', 'mira' ); ?></label></th>
							<td>
								<input type="checkbox" id="mira_abandoned_cart_enabled" name="mira_abandoned_cart_enabled"
									value="1" <?php checked( get_option( 'mira_abandoned_cart_enabled' ) ); ?> />
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="mira_abandoned_cart_delay"><?php esc_html_e( 'تاخیر نمایش (ثانیه)', 'mira' ); ?></label></th>
							<td>
								<input type="number" min="10" max="3600" id="mira_abandoned_cart_delay" name="mira_abandoned_cart_delay"
									value="<?php echo esc_attr( get_option( 'mira_abandoned_cart_delay', 120 ) ); ?>" />
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="mira_abandoned_cart_message"><?php esc_html_e( 'متن پیام', 'mira' ); ?></label></th>
							<td>
								<textarea id="mira_abandoned_cart_message" name="mira_abandoned_cart_message" class="large-text" rows="2"><?php echo esc_textarea( get_option( 'mira_abandoned_cart_message', '' ) ); ?></textarea>
								<p class="description"><?php esc_html_e( 'فقط وقتی نشون داده می‌شه که بازدیدکننده‌ی فعلی سبد خرید غیرخالی داشته باشه.', 'mira' ); ?></p>
							</td>
						</tr>
					</table>
				<?php endif; ?>

				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
