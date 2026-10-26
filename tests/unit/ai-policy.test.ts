import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_POLICY } from '@mira/shared-types';
import { UpdateSiteSettingsRequestDto } from '../../apps/api/src/modules/sites/dto/update-site-settings.dto';

describe('public phone settings', () => {
  const errors = (publicPhoneNumbers: unknown) =>
    validate(
      plainToInstance(UpdateSiteSettingsRequestDto, {
        aiPolicy: { ...DEFAULT_AI_POLICY, publicPhoneNumbers },
      }),
    );
  it('accepts digit-only public numbers and clearing the allowlist', async () => {
    expect(await errors(['02111112222', '+989110002222', '۰۲۱۱۱۱۱۲۲۲۲'])).toHaveLength(0);
    expect(await errors([])).toHaveLength(0);
  });
  it.each(
    [
      ['6037991234567890'],
      ['password=secret'],
      ['021-11112222'],
      Array(11).fill('02111112222'),
      '02111112222',
    ].map((publicPhoneNumbers) => ({ publicPhoneNumbers })),
  )('rejects invalid public phone settings $publicPhoneNumbers', async ({ publicPhoneNumbers }) => {
    expect((await errors(publicPhoneNumbers)).length).toBeGreaterThan(0);
  });
});
