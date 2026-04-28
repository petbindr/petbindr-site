# PetBindr Brand Guide

## Colors

| Variable | Hex | Usage |
|---|---|---|
| `--bindr-navy` | `#1F3C5F` | Primary text, headlines, nav |
| `--bindr-teal` | `#74C4CD` | Secondary accents, icon strokes |
| `--soft-teal` | `#B5DDDF` | Section backgrounds, illustration fills, icon backgrounds |
| `--warm-cream` | `#FBF8F3` | Page background |
| `--pure-white` | `#FFFFFF` | Cards, lifted sections |
| `--coral-cta` | `#FF6B5B` | Primary CTA buttons ONLY |
| `--charcoal` | `#1A1F2E` | Body text |
| `--slate-gray` | `#6B7785` | Secondary text, captions, footer |
| `--mist-gray` | `#E8ECEF` | Borders, dividers |
| `--success-green` | `#4FAE7C` | Confirmations |
| `--alert-amber` | `#E5A547` | Warnings |
| `--error-red` | `#D14545` | Errors |

### Color rules
- **Page background**: Warm Cream — never pure white
- **Cards / lifted sections**: Pure White
- **All headlines**: Bindr Navy
- **CTA buttons**: Coral background + white text
- **Teal as text**: Never use Bindr Teal as text on a cream background (insufficient contrast)
- **Soft Teal**: Works well for section backgrounds, illustration fills, icon halos
- **Body copy**: Charcoal (slightly warmer than black, better on cream)

## Typography

### Fonts
- **Headlines**: [Fraunces](https://fonts.google.com/specimen/Fraunces) — weight 600
- **Body / UI**: [Inter](https://fonts.google.com/specimen/Inter) — weights 400, 500, 600

### Scale
| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Hero headline | Fraunces | 56–72px (clamp 36–72) | 600 | −0.03em letter-spacing |
| Section heading | Fraunces | 36–48px (clamp 28–48) | 600 | −0.02em letter-spacing |
| Subhead | Inter | 18–22px | 400 | 1.6 line-height |
| Body | Inter | 16–18px | 400 | 1.6 line-height |
| Caption | Inter | 13–14px | 500 | |
| Button label | Inter | 16px | 600 | |

## Logo

- File: `public/logo.svg`
- Display width: 160px desktop / 120px mobile
- Do not recolor — use as-is on cream or white backgrounds
- Minimum clear space: 16px on all sides

## Components

### CTA Button (`.btn-coral`)
- Background: `--coral-cta` (#FF6B5B)
- Hover: `--coral-cta-hover` (#e55a4a) — 10% darker
- Text: white, Inter 16px weight 600
- Padding: 14px 28px
- Border-radius: 10px
- Min height: 44px (tappable)
- Transition: background-color 0.2s ease

### Ghost Button (`.btn-ghost`)
- Background: transparent
- Border: 2px solid `--bindr-navy`
- Text: `--bindr-navy`, Inter 15px weight 600
- Hover: `rgba(31, 60, 95, 0.06)` background fill
- Border-radius: 10px
- Min height: 44px

### Email Input (`.email-input`)
- Background: pure white
- Border: 1.5px solid `--mist-gray`
- Focus border: `--bindr-teal`
- Font: Inter 16px charcoal
- Padding: 14px 18px
- Border-radius: 10px
- Min height: 44px

## Voice & Tone

- Direct and slightly wry ("Our pet binder was 13 pages.")
- Respects the reader's intelligence — no exclamation marks on every sentence
- Specific over vague ("13-page Google Doc" not "lots of pet info")
- Empathetic — acknowledges real anxiety (late-night texts, flights home)

## Screenshot placeholders

Replace `<div class="screenshot-placeholder">` elements in `SolutionSection.tsx`
with real `<Image>` components. Drop screenshots in `public/screenshots/`:

```
public/screenshots/
  sharing-permissions.png
  task-tracking.png
  quick-reference.png
```

Then in `SolutionSection.tsx`, replace each placeholder div with:
```tsx
<Image
  src="/screenshots/sharing-permissions.png"
  alt="Sharing & permissions screen"
  width={260}
  height={463}
  className="rounded-2xl shadow-xl"
/>
```

## OG Image

`public/og-image.png` — 1200×630px
- Background: Warm Cream (#FBF8F3)
- Headline: "Our pet binder was 13 pages. So we built this instead." in Fraunces navy
- Logo in upper-left corner
- TODO: Generate with Figma, Canva, or a script before launch
