import { Injectable, Logger } from '@nestjs/common';
import { CustomerContextDto } from '@mira/shared-types';
import { SiteEntity, VisitorEntity } from '../../database/entities';
import { wordPressUserId } from './wordpress-identity';

function emptyContext(status: CustomerContextDto['status']): CustomerContextDto {
  return {
    status,
    found: false,
    customerName: null,
    totalSpent: 0,
    currency: 'IRR',
    lastOrderStatus: null,
    lastOrderDate: null,
    recentOrders: [],
    currentCart: null,
  };
}

// وردپرس/ووکامرس روی هاست‌های معمولی (به‌خصوص بدون کش آبجکت، یا در حالت cold-start) می‌تونه
// چند ثانیه طول بکشه؛ چون این فقط برای نمایش اطلاعات کنار گفتگوست (نه مسیر بلادرنگ چت)، سخت‌گیری زیاد روی timeout لازم نیست
const REQUEST_TIMEOUT_MS = 15_000;

// این سرویس REST endpoint سفارشی افزونه‌ی وردپرس (mira/v1/customer-context) رو صدا می‌زنه
// تا سبد/تاریخچه سفارش/مجموع خرید مشتری ووکامرس کنار گفتگو نشون داده بشه (فاز ۳)
@Injectable()
export class WordPressService {
  private readonly logger = new Logger(WordPressService.name);

  async fetchCustomerContext(
    site: SiteEntity,
    visitor: VisitorEntity,
  ): Promise<CustomerContextDto | null> {
    if (!site.wordpressSiteUrl || !site.wordpressApiKey) {
      return emptyContext('not-configured');
    }
    const userId = wordPressUserId(visitor.externalId);
    if (!userId) return emptyContext('unverified');

    let url: URL;
    try {
      url = new URL('/wp-json/mira/v1/customer-context', site.wordpressSiteUrl);
    } catch {
      this.logger.warn(`آدرس وردپرس سایت ${site.id} نامعتبر است`);
      return null;
    }
    url.searchParams.set('user_id', userId);
    // نسخه‌های قدیمی افزونه برای شناسایی حساب به‌روزرسانی می‌خواهند؛ ایمیل تأییدنشده نمی‌فرستیم.

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        // نام هدر باید ASCII خالص باشد — با کاراکتر فارسی، fetch اصلاً درخواست را نمی‌فرستد
        // و TypeError می‌دهد که catch پایین بی‌صدا می‌بلعیدش (بخش ۶ AGENTS.md)
        headers: { 'X-Mira-Api-Key': site.wordpressApiKey },
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok) {
        this.logger.warn(`وردپرس با کد ${response.status} پاسخ داد (سایت ${site.id})`);
        return emptyContext('unavailable');
      }
      const context = (await response.json()) as CustomerContextDto;
      return {
        ...emptyContext('not-found'),
        ...context,
        status: context.found ? 'connected' : 'not-found',
      };
    } catch (error) {
      this.logger.warn(`اتصال به REST سفارشی وردپرس ناموفق بود: ${(error as Error).message}`);
      return emptyContext('unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
