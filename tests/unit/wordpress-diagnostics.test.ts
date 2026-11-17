import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPublicAddress,
  readSiteJson,
  WordPressReadError,
} from '../../apps/api/src/modules/wordpress/wordpress-reader';
import { WordPressService } from '../../apps/api/src/modules/wordpress/wordpress.service';

vi.mock('../../apps/api/src/modules/wordpress/wordpress-reader', async (original) => {
  const actual =
    await original<typeof import('../../apps/api/src/modules/wordpress/wordpress-reader')>();
  return { ...actual, readSiteJson: vi.fn(actual.readSiteJson) };
});
const read = vi.mocked(readSiteJson);
const site = {
  wordpressSiteUrl: 'https://store.example/shop',
  wordpressApiKey: 'fixture-key',
} as never;
const service = new WordPressService();

describe('WooCommerce diagnostics', () => {
  beforeEach(() => {
    read.mockReset();
  });
  it('does not call WordPress without saved configuration', async () => {
    expect(await service.connectionStatus({} as never)).toEqual({ status: 'not-configured' });
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects credentials in configured URLs before requesting WordPress', async () => {
    expect(
      await service.connectionStatus({
        wordpressSiteUrl: 'https://user:pass@store.example/',
        wordpressApiKey: 'fixture-key',
      } as never),
    ).toEqual({ status: 'unavailable' });
    expect(read).not.toHaveBeenCalled();
  });
  it('uses the configured subdirectory and exposes only validated capabilities', async () => {
    const payload = {
      pluginVersion: '1.5.4',
      woocommerceAvailable: true,
      signedIdentity: true,
      capabilities: { products: true, pages: true, customerContext: true },
      secret: 'must-not-return',
    };
    read.mockResolvedValue(payload);
    const result = await service.connectionStatus(site);
    expect(read.mock.calls[0][0].toString()).toBe(
      'https://store.example/shop/wp-json/mira/v1/status',
    );
    expect(result).toEqual({
      status: 'connected',
      pluginVersion: '1.5.4',
      woocommerceAvailable: true,
      signedIdentity: true,
      capabilities: payload.capabilities,
    });
  });
  it.each([401, 403])('reports rejected API keys (%i)', async (code) => {
    read.mockRejectedValue(new WordPressReadError(code));
    expect(await service.connectionStatus(site)).toEqual({ status: 'auth-failed' });
  });
  it('reports old plugin without claiming WooCommerce capability', async () => {
    read
      .mockRejectedValueOnce(new WordPressReadError(404))
      .mockResolvedValueOnce({ products: [], documents: [] });
    expect(await service.connectionStatus(site)).toEqual({ status: 'plugin-update' });
    expect(read.mock.calls[1][0].pathname).toBe('/shop/wp-json/mira/v1/ai-context');
  });
  it('rejects malformed responses', async () => {
    read.mockResolvedValue({ pluginVersion: '1.5.4', woocommerceAvailable: 'yes' });
    expect(await service.connectionStatus(site)).toEqual({ status: 'unavailable' });
  });
});

describe('diagnostics network boundary', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '2001:db8::1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(['1.1.1.1', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it.each(['http://example.com/', 'https://example.com:8443/', 'https://user:pass@example.com/'])(
    'rejects unsafe URL %s before DNS',
    async (url) => {
      const actual = await vi.importActual<
        typeof import('../../apps/api/src/modules/wordpress/wordpress-reader')
      >('../../apps/api/src/modules/wordpress/wordpress-reader');
      await expect(actual.readSiteJson(new URL(url), 'fixture-key')).rejects.toThrow('HTTPS');
    },
  );
});
