import { safeHttpUrl, type ChatToolMetadata } from '@mira/shared-types';

export function renderChatTool(
  doc: Document,
  metadata: ChatToolMetadata,
  submit?: (answers: Record<string, string | boolean>) => Promise<void>,
): HTMLElement {
  const card = doc.createElement('section');
  card.className = 'mira-tool';
  const title = doc.createElement('strong');
  title.textContent = metadata.title;
  card.append(title);
  if (metadata.kind === 'link') {
    const url = safeHttpUrl(metadata.url);
    if (!url) return card;
    card.classList.add('mira-link-card');
    const host = doc.createElement('span');
    host.className = 'mira-link-host';
    host.dir = 'ltr';
    host.textContent = new URL(url).host;
    const description = doc.createElement('p');
    description.textContent = metadata.description;
    const link = doc.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'باز کردن صفحه ↗';
    card.prepend(host);
    card.append(description, link);
    return card;
  }
  if (metadata.kind === 'form-response') {
    const receipt = doc.createElement('p');
    receipt.textContent = 'پاسخ فرم ثبت شد و برای پشتیبان ارسال شد.';
    card.append(receipt);
    return card;
  }
  const description = doc.createElement('p');
  description.textContent = metadata.description;
  card.append(description);
  if (metadata.submittedAt) {
    const receipt = doc.createElement('p');
    receipt.className = 'mira-form-success';
    receipt.textContent = '✓ پاسخ شما ثبت شده است';
    card.append(receipt);
    return card;
  }
  const form = doc.createElement('form');
  form.className = 'mira-chat-form';
  const fields = doc.createElement('fieldset');
  const controls = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
  for (const field of metadata.fields) {
    const label = doc.createElement('label');
    const caption = doc.createElement('span');
    caption.textContent = field.label + (field.required ? ' *' : '');
    let control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (field.type === 'select') {
      control = doc.createElement('select');
      for (const value of ['', ...(field.options ?? [])]) {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = value || 'انتخاب کنید';
        control.append(option);
      }
    } else if (field.type === 'textarea') {
      control = doc.createElement('textarea');
      control.rows = 3;
      control.maxLength = 2000;
    } else {
      control = doc.createElement('input');
      control.type = field.type === 'text' ? 'text' : field.type;
      if (field.type !== 'checkbox') control.maxLength = 2000;
    }
    control.required = field.required;
    control.setAttribute('aria-label', field.label);
    control.name = field.id;
    if (field.type === 'email' || field.type === 'tel') control.dir = 'ltr';
    label.append(caption, control);
    fields.append(label);
    controls.set(field.id, control);
  }
  const button = doc.createElement('button');
  button.type = 'submit';
  button.textContent = 'ارسال پاسخ فرم';
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  fields.append(button);
  form.append(fields, status);
  card.append(form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || fields.disabled) return;
    if (!submit) {
      status.textContent = 'ارسال در این پیش‌نمایش فعال نیست.';
      return;
    }
    const answers: Record<string, string | boolean> = {};
    for (const [id, control] of controls)
      answers[id] =
        control instanceof doc.defaultView!.HTMLInputElement && control.type === 'checkbox'
          ? control.checked
          : control.value.trim();
    fields.disabled = true;
    status.textContent = 'در حال ثبت پاسخ…';
    try {
      await submit(answers);
      status.textContent = '✓ پاسخ شما ثبت شد';
      button.textContent = 'ثبت شد';
    } catch (error) {
      fields.disabled = false;
      status.textContent =
        error instanceof Error ? error.message : 'ثبت انجام نشد؛ پاسخ‌ها حفظ شده‌اند.';
    }
  };
  return card;
}
