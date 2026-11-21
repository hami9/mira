import { describe, expect, it } from 'vitest';
import { containsHumanRequestKeywords } from '@mira/shared-types';
import {
  catalogQueries,
  fallbackPlan,
  parseSearchPlan,
  rankProducts,
  type SearchPlan,
} from '../../apps/worker/src/ai/catalog';

const product = (id: string, name: string, inStock = true) => ({
  id: `product:${id}`,
  name,
  url: `https://shop.test/p/${id}`,
  imageUrl: null,
  price: '1000',
  currency: 'IRT',
  inStock,
});
const plan = (patch: Partial<SearchPlan>): SearchPlan => ({
  intent: 'product',
  standalone: 'x',
  productType: null,
  device: null,
  queries: [],
  ...patch,
});

describe('catalog ranking', () => {
  it('treats Persian and Latin device names and case synonyms as the same product', () => {
    const { products, matches } = rankProducts(
      [
        product('1', 'قاب آیفون 17 پرو مکس BMW'),
        product('2', 'کاور LINEX مناسب iPhone 17 Pro Max'),
        product('3', 'گلس KingPower مناسب iPhone 17 Pro Max'),
      ],
      plan({ productType: 'case', device: 'iPhone 17 Pro Max' }),
      3,
    );
    expect(products.map((item) => item.id)).toEqual(['product:1', 'product:2']);
    expect(Object.values(matches)).toEqual(['exact', 'exact']);
  });
  it('does not present another device variant as an exact match', () => {
    const { products, matches } = rankProducts(
      [
        product('1', 'کاور سیلیکونی مناسب گوشی سامسونگ S25 Ultra'),
        product('2', 'کاور سیلیکونی مناسب گوشی سامسونگ S25 FE'),
        product('3', 'کاور سیلیکونی مناسب گوشی سامسونگ Galaxy A35'),
      ],
      plan({ productType: 'case', device: 'Galaxy S25' }),
      3,
    );
    expect(products.map((item) => item.id)).toEqual(['product:1', 'product:2']);
    expect(matches['product:1']).toBe('other_variant');
  });
  it('prefers exact stocked products and hides near matches when an exact one exists', () => {
    const { products } = rankProducts(
      [
        product('1', 'قاب iPhone 17 Pro Max'),
        product('2', 'قاب iPhone 17 Pro', false),
        product('3', 'قاب iPhone 17 Pro'),
      ],
      plan({ productType: 'case', device: 'iPhone 17 Pro' }),
      3,
    );
    expect(products.map((item) => item.id)).toEqual(['product:3', 'product:2']);
  });
  it('does not confuse a case with words that merely contain its name', () => {
    expect(
      rankProducts([product('1', 'شارژر با قابلیت شارژ سریع')], plan({ productType: 'case' }), 3)
        .products,
    ).toEqual([]);
  });
  it('builds store searches for both spellings and synonyms', () => {
    const queries = catalogQueries(
      plan({ productType: 'case', device: 'iPhone 17 Pro Max', queries: ['قاب کاجسا'] }),
      'برای 17 پرو مکس',
    );
    expect(queries).toEqual([
      'قاب کاجسا',
      'قاب iPhone 17 Pro Max',
      'قاب آیفون 17 پرو مکس',
      'کاور iPhone 17 Pro Max',
    ]);
    expect(catalogQueries(plan({ productType: 'case', device: 'Galaxy S25' }), 'x')).toEqual(
      expect.arrayContaining(['قاب S25', 'کاور S25', 'S25']),
    );
  });
  it('keeps a brand-only request inside that brand', () => {
    const request = plan({ productType: 'case', device: 'Samsung' });
    expect(catalogQueries(request, 'x')).toEqual(
      expect.arrayContaining(['قاب سامسونگ', 'کاور سامسونگ']),
    );
    expect(
      rankProducts(
        [
          product('1', 'قاب کاجسا مناسب iPhone 17 Pro Max'),
          product('2', 'کاور سیلیکونی مناسب گوشی سامسونگ Galaxy A35'),
        ],
        request,
        3,
      ).products.map((item) => item.id),
    ).toEqual(['product:2']);
  });
});

describe('search plan boundary', () => {
  it('falls back to the original question on invalid planner output', () => {
    expect(parseSearchPlan('not json', 'سؤال')).toEqual(fallbackPlan('سؤال'));
    expect(parseSearchPlan('{"intent":"delete"}', 'سؤال')).toEqual(fallbackPlan('سؤال'));
  });
  it('drops unsafe search terms and unknown product types', () => {
    const parsed = parseSearchPlan(
      JSON.stringify({
        intent: 'product',
        standalone: '<b>قاب</b>',
        productType: 'constructor',
        device: 'https://evil.test/x',
        queries: ['قاب', 'https://evil.test/x', 7, 'a', 'b1', 'c2', 'd3'],
      }),
      'سؤال',
    );
    expect(parsed.standalone).toBe('قاب');
    expect(parsed.productType).toBeNull();
    expect(parsed.device).toBeNull();
    expect(parsed.queries).toEqual(['قاب', 'b1', 'c2']);
  });
});

describe('human request detection', () => {
  it.each(['میخوام با یک اپراتور صحبت کنم', 'لطفا وصل کنید به کارشناس', 'با پشتیبان حرف بزنم'])(
    'detects %s',
    (text) => expect(containsHumanRequestKeywords(text)).toBe(true),
  );
  it.each(['قاب با پشتیبانی مگ سیف دارید؟', 'گارانتی پشتیبانی دارد؟', 'قیمت قاب چنده؟'])(
    'does not hand off on %s',
    (text) => expect(containsHumanRequestKeywords(text)).toBe(false),
  );
});
