import { BadRequestException } from '@nestjs/common';
import type { ChatFormAnswers, ChatFormField, SaveChatFormDto } from '@mira/shared-types';
const fail = (): never => {
  throw new BadRequestException('اطلاعات فرم معتبر نیست');
};
export function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max) return fail();
  const result = value.trim();
  if (required && !result) return fail();
  return result;
}
export function formInput(raw: SaveChatFormDto): SaveChatFormDto {
  if (!raw || !Array.isArray(raw.fields) || raw.fields.length < 1 || raw.fields.length > 8)
    return fail();
  const ids = new Set<string>();
  const fields = raw.fields.map((f: ChatFormField) => {
    if (
      !f ||
      typeof f.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(f.id) ||
      ['__proto__', 'constructor', 'prototype'].includes(f.id) ||
      ids.has(f.id) ||
      typeof f.required !== 'boolean' ||
      !['text', 'textarea', 'email', 'tel', 'select', 'checkbox'].includes(f.type)
    )
      return fail();
    ids.add(f.id);
    const options =
      f.type === 'select'
        ? Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 12
          ? f.options.map((o) => text(o, 100, true))
          : fail()
        : undefined;
    if (options && new Set(options).size !== options.length) return fail();
    return {
      id: f.id,
      label: text(f.label, 100, true),
      type: f.type,
      required: f.required,
      ...(options ? { options } : {}),
    };
  });
  return {
    title: text(raw.title, 120, true),
    description: raw.description === undefined ? '' : text(raw.description, 500),
    fields,
  };
}
export function formAnswers(fields: ChatFormField[], raw: unknown): ChatFormAnswers {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).some((id) => !fields.some((f) => f.id === id))
  )
    return fail();
  const result: ChatFormAnswers = {};
  const values = raw as ChatFormAnswers;
  for (const f of fields) {
    const value = values[f.id];
    if (f.type === 'checkbox') {
      if (value !== undefined && typeof value !== 'boolean') return fail();
      if (f.required && value !== true) return fail();
      result[f.id] = value === true;
      continue;
    }
    const v = value === undefined ? '' : text(value, f.type === 'textarea' ? 2000 : 500);
    if (f.required && !v) return fail();
    if (v && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return fail();
    if (v && f.type === 'tel' && !/^[+()\d\s۰-۹٠-٩.-]{3,40}$/.test(v)) return fail();
    if (v && f.type === 'select' && !f.options?.includes(v)) return fail();
    result[f.id] = v;
  }
  return result;
}
export function clientId(raw: unknown): string {
  const id = text(raw, 64, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return fail();
  return id;
}
