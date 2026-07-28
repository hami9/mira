import { describe, it, expect } from 'vitest';
import { hasPermission, AGENT_PERMISSIONS, PERMISSION_LABELS } from '@mira/shared-types';

// قاعده‌ی غیرقابل‌مذاکره‌ی ۷: «مدیریت اپراتورها» هرگز permission نمی‌شود، وگرنه یک اپراتور
// می‌تواند دسترسی خودش را بالا ببرد و ادمین شود (privilege escalation).
// این تست آن قاعده را ماشینی نگه می‌دارد تا با افزودن قابلیت‌های بعدی سهواً نقض نشود.
describe('AGENT_PERMISSIONS', () => {
  it('هیچ permission مربوط به مدیریت اپراتور وجود ندارد — قاعده‌ی ۷', () => {
    const forbidden = AGENT_PERMISSIONS.filter((p) => /agent|operator|manageAgents/i.test(p));
    expect(forbidden).toEqual([]);
  });

  it('هر permission یک برچسب فارسی برای نمایش دارد', () => {
    for (const permission of AGENT_PERMISSIONS) {
      expect(PERMISSION_LABELS[permission], `برچسب ${permission}`).toBeTruthy();
    }
  });

  it('فهرست دسترسی‌ها تکراری ندارد', () => {
    expect(new Set(AGENT_PERMISSIONS).size).toBe(AGENT_PERMISSIONS.length);
  });
});

describe('hasPermission', () => {
  it('ادمین همه‌ی دسترسی‌ها را دارد، حتی با نقشه‌ی خالی', () => {
    for (const permission of AGENT_PERMISSIONS) {
      expect(hasPermission('admin', {}, permission)).toBe(true);
      expect(hasPermission('admin', null, permission)).toBe(true);
      expect(hasPermission('admin', undefined, permission)).toBe(true);
    }
  });

  it('اپراتور فقط دسترسی‌های صریحاً true را دارد', () => {
    expect(hasPermission('agent', { viewReports: true }, 'viewReports')).toBe(true);
    expect(hasPermission('agent', { viewReports: true }, 'exportData')).toBe(false);
  });

  it('مقدار false یا غایب یعنی نداشتن دسترسی — پیش‌فرض بسته است', () => {
    expect(hasPermission('agent', { viewReports: false }, 'viewReports')).toBe(false);
    expect(hasPermission('agent', {}, 'viewReports')).toBe(false);
    expect(hasPermission('agent', null, 'viewReports')).toBe(false);
    expect(hasPermission('agent', undefined, 'viewReports')).toBe(false);
  });

  it('مقادیر truthy غیر از true پذیرفته نمی‌شوند (مقایسه‌ی سخت‌گیرانه)', () => {
    const sneaky = { viewReports: 'yes' } as unknown as Record<string, boolean>;
    expect(hasPermission('agent', sneaky, 'viewReports')).toBe(false);
  });

  it('نقش ناشناخته دسترسی ادمین نمی‌گیرد', () => {
    expect(hasPermission('superuser', {}, 'viewReports')).toBe(false);
    expect(hasPermission('', {}, 'viewReports')).toBe(false);
  });
});
