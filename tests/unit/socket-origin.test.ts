import { describe, expect, it } from 'vitest';
import { socketOrigin } from '../../apps/api/src/common/security/socket-origin';

describe('visitor socket origin', () => {
  const headers = {
    referer: 'https://chat.example.com/chat.html?key=public',
    'sec-fetch-site': 'same-origin',
  };
  it('recovers a same-origin polling handshake without an Origin header', () => {
    expect(socketOrigin(headers, 'polling')).toBe('https://chat.example.com');
  });
  it('keeps an explicit foreign or null origin instead of replacing it', () => {
    for (const origin of ['https://other.example.com', 'null', ''])
      expect(socketOrigin({ ...headers, origin }, 'polling')).toBe(origin);
  });
  it('does not recover missing origins for cross-site requests or WebSockets', () => {
    expect(socketOrigin({ ...headers, 'sec-fetch-site': 'cross-site' }, 'polling')).toBeUndefined();
    expect(socketOrigin(headers, 'websocket')).toBeUndefined();
    expect(socketOrigin({ referer: headers.referer }, 'polling')).toBeUndefined();
    expect(socketOrigin({ ...headers, referer: 'data:text/plain,bad' }, 'polling')).toBeUndefined();
    expect(socketOrigin({ ...headers, referer: '/bad' }, 'polling')).toBeUndefined();
  });
});
