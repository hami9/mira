const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  mark: svg(
    '<path d="M12 3C6.9 3 3 6.4 3 10.6c0 2.4 1.2 4.5 3.1 5.9L5.2 20.5l4.2-1.6c.8.2 1.7.3 2.6.3 5.1 0 9-3.4 9-7.6S17.1 3 12 3Z"/><path d="M12 14.1c-2.3-1.7-3.5-3-3.5-4.4 0-1.1.9-1.8 1.8-1.7.6.1 1.2.5 1.7 1.1.5-.6 1.1-1 1.7-1.1.9-.1 1.8.6 1.8 1.7 0 1.4-1.2 2.7-3.5 4.4Z" fill="currentColor" stroke="none"/>',
  ),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  expand: svg(
    '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/>',
  ),
  restore: svg('<path d="M3 9h6V3m12 6h-6V3M3 15h6v6m12-6h-6v6"/>'),
  arrow: svg('<path d="M19 12H5m6-6-6 6 6 6"/>'),
  send: svg('<path d="M12 20V4m-7 7 7-7 7 7"/>'),
  spark: svg(
    '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z"/><path d="M20 2v4m-2-2h4"/>',
  ),
  box: svg('<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>'),
  compare: svg(
    '<path d="M8 3H5a2 2 0 0 0-2 2v3m0-5 5 5m8 13h3a2 2 0 0 0 2-2v-3m0 5-5-5M7 12v7m-3-3 3 3 3-3M17 12V5m-3 3 3-3 3 3"/>',
  ),
  headset: svg(
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Zm0 7a3 3 0 0 1-3 3h-3"/>',
  ),
  truck: svg(
    '<path d="M3 5h11v12H3V5Zm11 5h4l3 4v3h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  ),
  external: svg('<path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>'),
};
