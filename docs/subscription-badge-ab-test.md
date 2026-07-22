# Subscription Badge A/B Test Options

Plan badge displayed next to the Neyya logo in the dashboard sidebar when a user is on Pro or Premium.

---

## Option A — Gradient Pill (currently implemented)

**Style:** Solid rounded pill with gradient background
**Pro:** `bg-gradient-to-r from-blue-400 to-indigo-500`, white text, uppercase
**Premium:** `bg-gradient-to-r from-amber-400 to-yellow-500`, dark amber text, uppercase

```
[ Neyya ] PRO        ← blue-indigo gradient, white text
[ Neyya ] PREMIUM    ← amber-gold gradient, dark text
```

**CSS:**
```css
/* Pro */
background: linear-gradient(to right, #60a5fa, #6366f1);
color: white;
font-size: 10px;
font-weight: 700;
padding: 2px 6px;
border-radius: 9999px;
text-transform: uppercase;
letter-spacing: 0.05em;

/* Premium */
background: linear-gradient(to right, #fbbf24, #eab308);
color: #92400e;
```

---

## Option B — Outlined Badge with Icon

**Style:** No fill, colored border with star/crown icon
**Pro:** Blue border, blue text, star icon
**Premium:** Gold border, gold text, crown icon

```
[ Neyya ] ⭐ Pro     ← blue border, blue text
[ Neyya ] 👑 Premium ← gold border, gold text
```

**CSS:**
```css
/* Pro */
border: 1.5px solid #3b82f6;
color: #3b82f6;
background: transparent;
font-size: 10px;
font-weight: 600;
padding: 2px 6px;
border-radius: 9999px;

/* Premium */
border: 1.5px solid #d97706;
color: #d97706;
```

---

## Option C — Shimmer/Glow Effect

**Style:** Gradient pill with animated shimmer sweep
**Pro:** Blue base with white shimmer moving left-to-right
**Premium:** Gold base with white shimmer moving left-to-right

```
[ Neyya ] ✨ PRO     ← blue with animated shimmer
[ Neyya ] ✨ PREMIUM ← gold with animated shimmer
```

**CSS:**
```css
/* Shared shimmer animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Pro */
background: linear-gradient(90deg, #3b82f6 0%, #93c5fd 50%, #3b82f6 100%);
background-size: 200% 100%;
animation: shimmer 3s infinite linear;
color: white;
font-size: 10px;
font-weight: 700;
padding: 2px 6px;
border-radius: 9999px;
text-transform: uppercase;

/* Premium */
background: linear-gradient(90deg, #d97706 0%, #fde68a 50%, #d97706 100%);
background-size: 200% 100%;
animation: shimmer 3s infinite linear;
color: #451a03;
```

---

## Option E — Icon-Only (compact)

**Style:** Single icon, no text — smallest footprint
**Pro:** Diamond/gem emoji
**Premium:** Crown emoji

```
[ Neyya ] 💎         ← just a gem icon
[ Neyya ] 👑         ← just a crown icon
```

**CSS:**
```css
/* Shared */
font-size: 14px;
line-height: 1;
/* No background, border, or padding needed */
```

---

## Option F — Tag with Energy Icon

**Style:** Compact colored tag with lightning/rocket icon
**Pro:** Blue background, lightning bolt icon
**Premium:** Purple-to-gold gradient, rocket icon

```
[ Neyya ] ⚡Pro      ← blue bg, lightning bolt
[ Neyya ] 🚀Premium  ← purple-gold bg, rocket
```

**CSS:**
```css
/* Pro */
background: #2563eb;
color: white;
font-size: 10px;
font-weight: 700;
padding: 2px 6px;
border-radius: 4px;

/* Premium */
background: linear-gradient(to right, #7c3aed, #d97706);
color: white;
font-size: 10px;
font-weight: 700;
padding: 2px 6px;
border-radius: 4px;
```

---

## A/B Test Notes

- **Current implementation:** Option A (Gradient Pill)
- **Excluded:** Option D (Dark Badge) — not preferred
- **Metrics to track:** Click-through to subscription page, perceived value survey, visual appeal rating
- **Implementation:** Swap CSS classes in `packages/web/src/app/(dashboard)/layout.tsx` — the badge renders inline next to `<img src="/logo-header.svg" />`
- **Location in code:** Lines ~108-114 (sidebar) and ~158-164 (mobile header)
