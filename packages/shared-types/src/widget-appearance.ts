export const WIDGET_ICONS = ['box', 'compare', 'truck', 'headset', 'spark', 'external'] as const;
export type WidgetIcon = (typeof WIDGET_ICONS)[number];
export interface WidgetAction {
  id: string;
  enabled: boolean;
  label: string;
  hint: string;
  icon: WidgetIcon;
  type: 'prompt' | 'link' | 'human';
  value?: string;
}
export interface WidgetAppearance {
  version: 1;
  color: string;
  accentColor: string;
  surfaceColor: string;
  position: 'bottom-left' | 'bottom-right';
  panelWidth: 'compact' | 'comfortable' | 'wide';
  radius: 'soft' | 'rounded' | 'square';
  density: 'comfortable' | 'compact';
  launcher: { label: string; style: 'pill' | 'icon' };
  welcome: { eyebrow: string; title: string; description: string; cards: WidgetAction[] };
  actions: WidgetAction[];
  features: {
    products: boolean;
    sources: boolean;
    copy: boolean;
    fullscreen: boolean;
    quickReplies: boolean;
    human: boolean;
  };
  motion: {
    launcher: 'none' | 'breathe' | 'float' | 'ripple';
    panel: 'none' | 'rise' | 'scale' | 'reveal';
  };
}

const action = (
  id: string,
  label: string,
  hint: string,
  icon: WidgetIcon,
  type: WidgetAction['type'],
  value?: string,
): WidgetAction => ({
  id,
  enabled: true,
  label,
  hint,
  icon,
  type,
  ...(value === undefined ? {} : { value }),
});
export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  version: 1,
  color: '#2E6BE6',
  accentColor: '#168B6A',
  surfaceColor: '#ffffff',
  position: 'bottom-right',
  panelWidth: 'comfortable',
  radius: 'rounded',
  density: 'comfortable',
  launcher: { label: 'دستیار خرید', style: 'pill' },
  welcome: {
    eyebrow: 'همراه انتخاب شما',
    title: 'انتخاب خوب،\nاز یک گفتگو شروع می‌شود.',
    description: '',
    cards: [
      action(
        'product',
        'محصول مناسب من',
        'از نیاز شما تا گزینه مناسب، با هم پیش می‌رویم',
        'box',
        'prompt',
        'برای انتخاب محصول مناسب با نیاز و بودجه‌ام راهنمایی‌ام کن.',
      ),
      action(
        'compare',
        'مقایسه محصولات',
        'تفاوت‌ها، روشن و کنار هم',
        'compare',
        'prompt',
        'می‌خواهم چند محصول را مقایسه کنم. برای شروع راهنمایی‌ام کن.',
      ),
      action(
        'shipping',
        'خرید و ارسال',
        'پاسخ سوال‌های پیش از خرید',
        'truck',
        'prompt',
        'شرایط و زمان ارسال سفارش چیست؟',
      ),
    ],
  },
  actions: [
    action(
      'shopping',
      'مشاوره خرید',
      '',
      'spark',
      'prompt',
      'برای انتخاب محصول مناسب با نیاز و بودجه‌ام راهنمایی‌ام کن.',
    ),
    action('shipping', 'شرایط ارسال', '', 'truck', 'prompt', 'شرایط و زمان ارسال سفارش چیست؟'),
    action('human', 'گفتگو با پشتیبان', '', 'headset', 'human'),
  ],
  features: {
    products: true,
    sources: true,
    copy: true,
    fullscreen: true,
    quickReplies: true,
    human: true,
  },
  motion: { launcher: 'breathe', panel: 'rise' },
};

type Obj = Record<string, unknown>;
const record = (value: unknown): value is Obj =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const cloneDefault = (): WidgetAppearance => JSON.parse(JSON.stringify(DEFAULT_WIDGET_APPEARANCE));
const hex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const own = (obj: Obj, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const url = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};
const text = (value: unknown, max: number, empty = true): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  (empty || !!value.trim()) &&
  !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  });

function normalizeAction(value: unknown): WidgetAction | null {
  if (
    !record(value) ||
    !text(value.id, 64, false) ||
    !/^[a-zA-Z0-9_-]+$/.test(value.id) ||
    typeof value.enabled !== 'boolean' ||
    !text(value.label, 48, false) ||
    !text(value.hint, 240) ||
    !WIDGET_ICONS.includes(value.icon as WidgetIcon) ||
    !['prompt', 'link', 'human'].includes(String(value.type))
  )
    return null;
  const type = value.type as WidgetAction['type'];
  if (
    type !== 'human' &&
    (!text(value.value, 2000, false) || (type === 'link' && !url(value.value)))
  )
    return null;
  return {
    id: value.id,
    enabled: value.enabled,
    label: value.label,
    hint: value.hint,
    icon: value.icon as WidgetIcon,
    type,
    ...(type === 'human' ? {} : { value: value.value as string }),
  };
}

// خواندن رکورد قدیمی یا ناقص همیشه به یک تنظیم امن و کامل منتهی می‌شود.
export function normalizeWidgetAppearance(value: unknown): WidgetAppearance {
  const result = cloneDefault();
  if (!record(value)) return result;
  for (const key of ['color', 'accentColor', 'surfaceColor'] as const)
    if (hex(value[key])) result[key] = value[key];
  const enums = {
    position: ['bottom-left', 'bottom-right'],
    panelWidth: ['compact', 'comfortable', 'wide'],
    radius: ['soft', 'rounded', 'square'],
    density: ['comfortable', 'compact'],
  };
  for (const [key, choices] of Object.entries(enums))
    if (choices.includes(value[key] as string)) Object.assign(result, { [key]: value[key] });
  if (record(value.launcher)) {
    if (text(value.launcher.label, 48)) result.launcher.label = value.launcher.label;
    if (['pill', 'icon'].includes(String(value.launcher.style)))
      result.launcher.style = value.launcher.style as 'pill' | 'icon';
  }
  const actions = (input: unknown, limit: number, fallback: WidgetAction[]) => {
    if (!Array.isArray(input)) return fallback;
    const ids = new Set<string>();
    return input
      .slice(0, limit)
      .map(normalizeAction)
      .filter((item): item is WidgetAction => {
        if (!item || ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      });
  };
  if (record(value.welcome)) {
    for (const [key, max] of [
      ['eyebrow', 80],
      ['title', 160],
      ['description', 1000],
    ] as const)
      if (text(value.welcome[key], max)) result.welcome[key] = value.welcome[key];
    result.welcome.cards = actions(value.welcome.cards, 6, result.welcome.cards);
  }
  result.actions = actions(value.actions, 8, result.actions);
  if (record(value.features))
    for (const key of Object.keys(result.features) as (keyof WidgetAppearance['features'])[])
      if (typeof value.features[key] === 'boolean') result.features[key] = value.features[key];
  if (record(value.motion)) {
    if (['none', 'breathe', 'float', 'ripple'].includes(String(value.motion.launcher)))
      result.motion.launcher = value.motion.launcher as WidgetAppearance['motion']['launcher'];
    if (['none', 'rise', 'scale', 'reveal'].includes(String(value.motion.panel)))
      result.motion.panel = value.motion.panel as WidgetAppearance['motion']['panel'];
  }
  return result;
}

// ورودی تنظیمات و فایل قالب، پیش از ذخیره یا نمایش، به‌صورت سخت‌گیرانه بررسی می‌شود.
export function parseWidgetAppearance(input: unknown): WidgetAppearance {
  const fail = (field: string): never => {
    throw new Error(`تنظیم «${field}» معتبر نیست.`);
  };
  if (!record(input)) return fail('ظاهر');
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return fail('ظاهر');
  }
  if (new TextEncoder().encode(serialized).byteLength > 48000) return fail('حجم تنظیمات');
  const result = normalizeWidgetAppearance(input);
  const allowed = Object.keys(result);
  for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(key);
  if (own(input, 'version') && input.version !== 1) fail('نسخه قالب');
  for (const key of ['color', 'accentColor', 'surfaceColor'] as const)
    if (own(input, key) && !hex(input[key])) fail(key);
  for (const key of ['position', 'panelWidth', 'radius', 'density'] as const)
    if (own(input, key) && input[key] !== result[key]) fail(key);
  const object = (key: string, keys: string[]) => {
    if (!record(input[key])) fail(key);
    const item = input[key] as Obj;
    for (const name of Object.keys(item)) if (!keys.includes(name)) fail(`${key}.${name}`);
    return item;
  };
  if (own(input, 'launcher')) {
    const item = object('launcher', ['label', 'style']);
    if (own(item, 'label') && !text(item.label, 48)) fail('عنوان دکمه');
    if (own(item, 'style') && !['pill', 'icon'].includes(String(item.style))) fail('نوع دکمه');
  }
  const validateActions = (items: unknown, limit: number, field: string) => {
    if (!Array.isArray(items) || items.length > limit) return fail(field);
    const ids = new Set<string>();
    for (const raw of items) {
      const item = normalizeAction(raw);
      if (!item) return fail(field);
      if (
        !record(raw) ||
        Object.keys(raw).some(
          (k) => !['id', 'enabled', 'label', 'hint', 'icon', 'type', 'value'].includes(k),
        ) ||
        ids.has(item.id)
      )
        fail(field);
      if (item.type === 'human' && raw.value !== undefined && raw.value !== '') fail(field);
      ids.add(item.id);
    }
  };
  if (own(input, 'welcome')) {
    const item = object('welcome', ['eyebrow', 'title', 'description', 'cards']);
    for (const [key, max] of [
      ['eyebrow', 80],
      ['title', 160],
      ['description', 1000],
    ] as const)
      if (own(item, key) && !text(item[key], max)) fail(`welcome.${key}`);
    if (own(item, 'cards')) validateActions(item.cards, 6, 'کارت‌های شروع');
  }
  if (own(input, 'actions')) validateActions(input.actions, 8, 'میان‌برها');
  if (own(input, 'features')) {
    const item = object('features', Object.keys(result.features));
    for (const flag of Object.values(item)) if (typeof flag !== 'boolean') fail('امکانات');
  }
  if (own(input, 'motion')) {
    const item = object('motion', ['launcher', 'panel']);
    if (
      own(item, 'launcher') &&
      !['none', 'breathe', 'float', 'ripple'].includes(String(item.launcher))
    )
      fail('انیمیشن دکمه');
    if (own(item, 'panel') && !['none', 'rise', 'scale', 'reveal'].includes(String(item.panel)))
      fail('انیمیشن پنجره');
  }
  return result;
}

export const WIDGET_PRESETS: { id: string; label: string; appearance: WidgetAppearance }[] = [
  { id: 'mira', label: 'میرا', appearance: cloneDefault() },
  {
    id: 'forest',
    label: 'سبز جنگلی',
    appearance: {
      ...cloneDefault(),
      color: '#145C47',
      accentColor: '#299C83',
      radius: 'soft',
      motion: { launcher: 'float', panel: 'reveal' },
    },
  },
  {
    id: 'minimal',
    label: 'ساده و آرام',
    appearance: {
      ...cloneDefault(),
      color: '#334155',
      accentColor: '#64748B',
      radius: 'square',
      density: 'compact',
      motion: { launcher: 'none', panel: 'rise' },
    },
  },
];
export function exportWidgetTemplate(appearance: WidgetAppearance): string {
  return JSON.stringify(
    { format: 'mira-widget', version: '1.0.0', appearance: parseWidgetAppearance(appearance) },
    null,
    2,
  );
}
export function importWidgetTemplate(source: string): WidgetAppearance {
  if (new TextEncoder().encode(source).byteLength > 65536)
    throw new Error('حداکثر اندازه قالب ۶۴ کیلوبایت است.');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('فایل JSON قابل خواندن نیست.');
  }
  if (
    !record(value) ||
    value.format !== 'mira-widget' ||
    value.version !== '1.0.0' ||
    Object.keys(value).some((key) => !['format', 'version', 'appearance'].includes(key))
  )
    throw new Error('نوع یا نسخه قالب پشتیبانی نمی‌شود.');
  return parseWidgetAppearance(value.appearance);
}
