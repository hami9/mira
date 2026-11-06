import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyWordPressIdentity,
  wordPressUserId,
} from '../../apps/api/src/modules/wordpress/wordpress-identity';
describe('signed WordPress identity', () => {
  const key = 'identity-fixture-only';
  const now = 1800000000;
  const sign = (expiry: number, site = 'widget') =>
    `wp1.42.${expiry}.${createHmac('sha256', key).update(`${site}:42:${expiry}`).digest('hex')}`;
  it('binds a signed user to the correct site until expiry', () => {
    expect(verifyWordPressIdentity(sign(now + 900), key, 'widget', now)).toBe(`wp:42:${now + 900}`);
    expect(wordPressUserId(`wp:42:${now + 900}`, now)).toBe('42');
    expect(wordPressUserId(`wp:42:${now}`, now)).toBeNull();
  });
  it('rejects forged, absent, cross-site, expired and excessive-lifetime proofs', () => {
    for (const proof of [
      undefined,
      'wp1.42.1800000900.' + '0'.repeat(64),
      sign(now),
      sign(now + 901),
      sign(now + 900, 'other'),
    ])
      expect(verifyWordPressIdentity(proof, key, 'widget', now)).toBeNull();
  });
});
