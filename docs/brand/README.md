# Mira brand guide

**English** · [فارسی](README.fa.md)

Mira's visual identity comes from its logo: **two interlocking speech bubbles** (blue and
teal) that form a **heart** where they meet — a conversation that turns into a warm
relationship with the customer. The orange touch on the heart is the brand's point of
difference, its "human" note.

## Logo files

| File                                      | Use                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `mira-logo.jpg`                           | The primary logo (mark + MIRA wordmark) — for social media and documents                    |
| `mira-logo.svg`                           | The vector mark — for the web, at any size                                                  |
| `mira-logo-animated.svg`                  | The animated mark (rings drawing in, the heart popping and beating) — READMEs and web pages |
| `../../apps/dashboard/public/favicon.svg` | The dashboard's browser tab icon                                                            |

> The React version of the mark lives in `apps/dashboard/src/components/MiraLogo.tsx` and the
> widget's inline version in `apps/widget/src/ui.ts` — all three follow the same geometry.

## Colour palette

| Role                      | Token         | Hex       | Notes                                         |
| ------------------------- | ------------- | --------- | --------------------------------------------- |
| Primary (the logo's blue) | `primary-600` | `#2E6BE6` | Buttons, links, the operator's message bubble |
| Dark blue of the wordmark | `primary-800` | `#23479C` | Brand headings, text on a light background    |
| Teal (the second bubble)  | `teal-500`    | `#17B8A6` | AI, Copilot, bot replies                      |
| Heart orange              | `accent-500`  | `#F5A623` | Unread badge, CSAT stars, emphasis            |
| Error                     | `red-600`     | `#DC2626` | Error messages                                |
| Success/online            | `green-600`   | `#16A34A` | Online status, successful operations          |

The full `primary` / `teal` / `accent` scales (shades 50 through 950) are defined in
`apps/dashboard/tailwind.config.js` — always use the tokens, never a raw hex value.

### Brand gradient

```css
background: linear-gradient(135deg, #2e6be6 0%, #17b8a6 100%);
```

Allowed places: the widget header, the widget's floating bubble, the login page background,
the header of the WordPress plugin settings page. Do not use the gradient behind large
bodies of text (cards, tables).

## Typography

- **Dashboard:** the [Vazirmatn](https://github.com/rastikerdar/vazirmatn) font — self-hosted
  from an npm package, no CDN (so it works offline and on restricted networks).
  Fallback: Tahoma.
- **Widget:** deliberately a system font stack (`Tahoma, Arial, sans-serif`) — the widget is
  injected into the customer's website and must not load an extra font.
- Persian digits in the UI come from `toLocaleString('fa-IR')`.

## Motion

- Animations are **subtle and short**: 150–400 ms for interactions; only the logo and the
  widget bubble have a slow, repeating animation.
- Every animation must respect `prefers-reduced-motion: reduce` (honoured in the widget and
  in the animated logo).
- Curves: entrance `cubic-bezier(0.34, 1.56, 0.64, 1)` (a small overshoot), everything else
  `ease-out`.

## Logo usage rules

- Do not rotate the mark, change its colours, or stretch/squash it.
- Minimum clear space around the mark: a quarter of its own width.
- Use the same mark on a dark background (it has enough contrast); a single-colour version
  is not defined yet.

## Preview

[`preview.html`](preview.html) shows every token and base component in one place — open it
in a browser.
