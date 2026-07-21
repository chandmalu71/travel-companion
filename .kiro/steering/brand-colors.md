# Neyya Brand & Color Scheme

This steering file defines the official brand colors, typography, and logo usage for the Neyya application. All UI components MUST use these colors consistently.

## Brand Identity

- **Name:** Neyya
- **Tagline:** Your Complete AI Travel Companion
- **Domain:** neyya.ai
- **Logo mark:** Compass with AI, cityscape, leaves, and orange/green navigation arrows

## Color Palette

### Primary Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|---------------|-------|
| Brand Green | `#32CD32` | `primary-500` | Main buttons, active states, links, app icon background |
| Green Dark | `#2AB82A` | `primary-600` | Button hover, pressed states |
| Green Darker | `#22a022` | `primary-700` | Active sidebar items, strong emphasis |
| Green Light | `#6ee77a` | `primary-300` | Success badges, highlights |
| Green Pale | `#dcfce7` | `primary-100` | Active nav background, light badges |
| Green Lightest | `#f0fdf0` | `primary-50` | Hover backgrounds, cards |

### Accent Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|---------------|-------|
| Orange | `#FF8C00` | `accent-500` | Secondary buttons, compass accents, warnings, highlights |
| Orange Light | `#FCC980` | `accent-200` | Warm backgrounds, tagline on dark, stars, badges |
| Orange Dark | `#e67a00` | `accent-600` | Orange button hover |

### Supporting Colors

| Name | Hex | Tailwind Class | Usage |
|------|-----|---------------|-------|
| Forest Green | `#609550` | `forest-500` | Tagline text, secondary text, dietary badges |
| Terracotta | `#A96059` | `warm-500` | Alert/error accents, warm UI elements |

### Neutral Colors

| Usage | Class |
|-------|-------|
| Page background | `bg-gray-50` |
| Card background | `bg-white` |
| Primary text | `text-gray-900` |
| Secondary text | `text-gray-600` |
| Muted text | `text-gray-400` |
| Borders | `border-gray-200` |
| Dark footer bg | `bg-gray-900` |
| Footer text | `text-gray-300` / `text-gray-400` |

## Component Color Rules

### Buttons

- **Primary button:** `bg-primary-500 text-white hover:bg-primary-600`
- **Secondary button:** `border border-primary-500 text-primary-600 hover:bg-primary-50`
- **Accent/CTA button:** `bg-accent-500 text-white hover:bg-accent-600`
- **Danger button:** `bg-warm-500 text-white hover:bg-warm-600`
- **Ghost button:** `text-gray-700 hover:bg-gray-100`

### Navigation

- **Active item:** `bg-primary-50 text-primary-700`
- **Inactive item:** `text-gray-700 hover:bg-gray-100`
- **Header links:** `text-gray-600 hover:text-primary-600`

### Cards & Borders

- **Card border default:** `border-gray-200`
- **Card border hover:** `border-primary-300`
- **Card border active:** `border-primary-500`
- **Feature card hover:** `hover:border-primary-300 hover:shadow-lg`

### Badges & Tags

- **Success:** `bg-primary-100 text-primary-700`
- **Warning:** `bg-accent-200 text-accent-600`
- **Error:** `bg-warm-100 text-warm-700`
- **Info:** `bg-forest-100 text-forest-700`
- **Neutral:** `bg-gray-100 text-gray-600`

### Form Inputs

- **Border:** `border-gray-300`
- **Focus ring:** `focus:border-primary-500 focus:ring-primary-500`
- **Error border:** `border-warm-500`

### Gradients

- **Hero/testimonial section:** `bg-gradient-to-br from-primary-500 to-forest-500`
- **Orange accent gradient:** `from-accent-500 to-accent-200`

## Logo Usage

| Context | File | Sizing |
|---------|------|--------|
| Browser favicon | `/favicon.svg` | 32x32 (rounded square, green N) |
| Mobile header / small | `/logo-icon.svg` | 36-48px (green circle with N + compass dots) |
| Desktop header / sidebar | `/logo-header.svg` | h-10 to h-12 (compass mark + NEYYA + tagline) |
| Hero / marketing | `/logo-full.svg` | Full width (detailed compass + text) |
| Dark backgrounds (footer) | `/logo-white.svg` | Same as header but white text + lighter greens |

### Logo Elements

The logo mark contains these symbolic elements:
- **Compass arrows (green):** Navigation, guidance (the meaning of "Neyya")
- **Orange arrow tips:** Energy, adventure, warmth
- **AI text:** Intelligence powering the experience
- **Cityscape:** Urban travel and destinations
- **Leaf:** Nature, eco-conscious travel
- **Sparkle stars:** Magic, discovery, AI-powered delight
- **Location pin:** Places and points of interest

## Typography

- **Font family:** Inter (primary), system-ui, sans-serif (fallback)
- **Headings:** font-weight 700-800, text-gray-900
- **Body text:** font-weight 400, text-gray-600
- **Tagline:** font-weight 400, text-forest-500 or text-accent-200 (on dark)
- **Brand name "NEYYA":** font-weight 800, letter-spacing 1.5-2px

## Do's and Don'ts

### Do:
- Use `primary-500` (#32CD32) as the dominant brand color
- Use `accent-500` (#FF8C00) sparingly for emphasis and warmth
- Keep plenty of white space — the brand is clean and modern
- Use the gradient (`from-primary-500 to-forest-500`) for hero/marketing sections

### Don't:
- Don't use plain blue (`blue-600`) — we replaced it with brand green
- Don't mix warm-500 and primary-500 as adjacent elements
- Don't use the full logo mark at sizes below 40px (use logo-icon instead)
- Don't place the logo on busy backgrounds without sufficient contrast
