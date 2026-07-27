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
				'default'           => '#2E6BE6',
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
		return $sanitized ? $sanitized : '#2E6BE6';
	}

	public function sanitize_position( $value ) {
		return in_array( $value, array( 'bottom-right', 'bottom-left' ), true ) ? $value : 'bottom-right';
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<style>
			/* استایل اختصاصی صفحه تنظیمات میرا — scoped با .mira-admin تا با بقیه پیشخوان تداخل نکند */
			.mira-admin { max-width: 860px; }
			.mira-admin-hero {
				display: flex; align-items: center; gap: 16px;
				background: linear-gradient(135deg, #2E6BE6 0%, #17B8A6 100%);
				border-radius: 14px; padding: 20px 24px; margin: 16px 0 20px; color: #fff;
			}
			.mira-admin-hero svg { flex-shrink: 0; }
			.mira-admin-hero h1 { margin: 0; color: #fff; font-size: 22px; padding: 0; }
			.mira-admin-hero p { margin: 4px 0 0; opacity: .92; font-size: 13px; }
			.mira-admin-card {
				background: #fff; border: 1px solid #dcdcde; border-radius: 12px;
				padding: 8px 20px 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04);
			}
			.mira-admin-card h2 { font-size: 15px; color: #23479C; }
			.mira-admin input[type="color"] {
				inline-size: 56px; block-size: 36px; padding: 2px; border-radius: 8px; cursor: pointer;
			}
			.mira-admin .mira-color-row { display: flex; align-items: center; gap: 10px; }
		</style>
		<div class="wrap mira-admin">
			<div class="mira-admin-hero">
				<svg viewBox="0 0 256 200" width="72" height="56" role="img" aria-hidden="true">
					<path d="M200 141 C 208 156, 214 166, 224 175 C 206 173, 190 166, 178 155 Z" fill="#ffffff" opacity=".9" />
					<circle cx="164" cy="94" r="56" fill="none" stroke="#ffffff" stroke-width="26" opacity=".9" />
					<path d="M56 141 C 48 156, 42 166, 32 175 C 50 173, 66 166, 78 155 Z" fill="#ffffff" />
					<circle cx="92" cy="94" r="56" fill="none" stroke="#ffffff" stroke-width="26" />
					<path d="M128 142 C 105 124, 91 108, 91 89 C 91 74, 103 65, 115 67 C 121 68, 126 72, 128 78 C 130 72, 135 68, 141 67 C 153 65, 165 74, 165 89 C 165 108, 151 124, 128 142 Z" fill="#F5A623" stroke="#ffffff" stroke-width="11" stroke-linejoin="round" />
				</svg>
				<div>
					<h1><?php esc_html_e( 'تنظیمات میرا', 'mira' ); ?></h1>
					<p><?php esc_html_e( 'اتصال فروشگاه شما به پلتفرم چت پشتیبانی هوشمند میرا', 'mira' ); ?></p>
				</div>
			</div>
			<form method="post" action="options.php">
				<?php settings_fields( 'mira_settings_group' ); ?>
				<div class="mira-admin-card">
				<h2><?php esc_html_e( 'اتصال به بک‌اند', 'mira' ); ?></h2>
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
				</table>
				</div>

				<div class="mira-admin-card">
				<h2><?php esc_html_e( 'ظاهر ویجت', 'mira' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="mira_widget_color"><?php esc_html_e( 'رنگ ویجت', 'mira' ); ?></label></th>
						<td>
							<div class="mira-color-row">
								<input type="color" id="mira_widget_color" name="mira_widget_color"
									value="<?php echo esc_attr( get_option( 'mira_widget_color', '#2E6BE6' ) ); ?>" />
								<p class="description" style="margin:0">
									<?php esc_html_e( 'پیش‌فرض: آبی برند میرا (#2E6BE6). بدون تغییر، حباب و هدر ویجت با گرادیان برند نمایش داده می‌شوند.', 'mira' ); ?>
								</p>
							</div>
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
				</div>

				<?php if ( class_exists( 'WooCommerce' ) ) : ?>
					<div class="mira-admin-card">
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
					</div>
				<?php endif; ?>

				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
