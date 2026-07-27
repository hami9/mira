import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { WEBHOOK_QUEUE_NAME, WebhookDispatchJobData } from '@mira/shared-types';

// این سرویس فقط job اضافه می‌کنه (producer)؛ ارسال واقعی درخواست HTTP در apps/worker انجام می‌شه
// تا مسیر زنده‌ی چت هیچ‌وقت منتظر پاسخ یک سرور خارجی (که ممکنه کند یا از دسترس خارج باشه) نمونه.
@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  private readonly queue: Queue<WebhookDispatchJobData>;

  constructor(private readonly config: ConfigService) {
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
    const prefix = this.config.get<string>('QUEUE_PREFIX', 'mira');
    this.queue = new Queue(WEBHOOK_QUEUE_NAME, { connection, prefix });
  }

  async enqueueDispatch(data: WebhookDispatchJobData): Promise<void> {
    await this.queue.add('dispatch', data, { attempts: 1, removeOnComplete: true, removeOnFail: 100 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
