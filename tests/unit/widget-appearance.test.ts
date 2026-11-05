import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_APPEARANCE,
  normalizeWidgetAppearance,
  parseWidgetAppearance,
  exportWidgetTemplate,
  importWidgetTemplate,
} from '@mira/shared-types';

describe('widget configuration boundaries', () => {
  it('keeps legacy colors while filling independent defaults and cloning nested state', () => {
    const first = normalizeWidgetAppearance({
      color: '#123456',
      position: 'bottom-left',
      privateKey: 'secret',
    });
    expect(first.color).toBe('#123456');
    expect(first.position).toBe('bottom-left');
    expect(first.motion).toEqual({ launcher: 'breathe', panel: 'rise' });
    expect(first).not.toHaveProperty('privateKey');
    first.welcome.cards[0].label = 'changed';
    expect(normalizeWidgetAppearance({}).welcome.cards[0].label).toBe(
      DEFAULT_WIDGET_APPEARANCE.welcome.cards[0].label,
    );
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:password@example.test/path',
    'file:///etc/passwd',
  ])('rejects unsafe action links: %s', (value) => {
    const appearance = normalizeWidgetAppearance({});
    appearance.actions = [{ ...appearance.actions[0], type: 'link', value }];
    expect(() => parseWidgetAppearance(appearance)).toThrow();
    expect(normalizeWidgetAppearance(appearance).actions).toEqual([]);
  });
  it.each([
    { version: 2 },
    { color: 'red;display:none' },
    { motion: { panel: 'unknown' } },
    { features: { human: 'false' } },
    { css: 'body{}' },
    { launcher: { script: 'alert(1)' } },
  ])('rejects invalid typed input %j', (value) => {
    expect(() => parseWidgetAppearance(value)).toThrow();
  });
  it('rejects duplicate action identifiers and excessive action counts', () => {
    const item = DEFAULT_WIDGET_APPEARANCE.actions[0];
    expect(() => parseWidgetAppearance({ actions: [item, item] })).toThrow();
    expect(() =>
      parseWidgetAppearance({
        actions: Array.from({ length: 9 }, (_, i) => ({ ...item, id: `action-${i}` })),
      }),
    ).toThrow();
  });
  it('roundtrips a bounded theme including both motion selections without tenant identity', () => {
    const appearance = parseWidgetAppearance({
      motion: { launcher: 'float', panel: 'scale' },
      welcome: { title: '<b>عنوان متنی</b>', cards: [] },
    });
    const saved = exportWidgetTemplate(appearance);
    expect(importWidgetTemplate(saved)).toEqual(appearance);
    expect(saved).not.toMatch(/visitorToken|widgetKey|siteId|avatarUrl/);
    expect(importWidgetTemplate(saved).welcome.title).toBe('<b>عنوان متنی</b>');
  });
  it('rejects unsupported file versions and hidden fields', () => {
    for (const data of [
      { format: 'mira-widget', version: '2.0.0', appearance: {} },
      { format: 'mira-widget', version: '1.0.0', appearance: {}, token: 'secret' },
    ])
      expect(() => importWidgetTemplate(JSON.stringify(data))).toThrow();
    expect(() => importWidgetTemplate('آ'.repeat(33000))).toThrow();
  });
});
