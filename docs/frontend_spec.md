# Frontend Specification: MatchDay AI

## 1. UI Library & Tooling

- **Component library:** shadcn/ui (built on Radix UI primitives) — used for Button, Dialog, Card, Toast, Select, Tabs, Badge, Skeleton.
- **Styling:** Tailwind CSS 3.4.10, utility-first, no custom CSS files except `globals.css` for token definitions and font imports.
- **Icons:** lucide-react 0.383.0.
- **Charts (staff dashboard density graphs):** Recharts.
- **Maps/route overlay:** custom SVG venue map (no external map SDK dependency for v1, to keep offline resilience).
- **Fonts:** loaded via `@font-face` self-hosted (not Google Fonts CDN) to reduce dependency on external network calls in poor-connectivity stadium environments.

## 2. Design Tokens

### Color Palette (WCAG AA/AAA-compliant contrast pairs)

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#0B3D91` | Primary actions, headers (FIFA-style deep blue) |
| `--color-primary-foreground` | `#FFFFFF` | Text on primary — contrast ratio 8.6:1 |
| `--color-secondary` | `#00A651` | Success states, "low density" indicator |
| `--color-secondary-foreground` | `#04210F` | Text on secondary — contrast ratio 7.1:1 |
| `--color-warning` | `#F5A623` | "medium density" alerts |
| `--color-warning-foreground` | `#1A1200` | Text on warning — contrast ratio 8.9:1 |
| `--color-critical` | `#D62839` | "high density / critical" alerts |
| `--color-critical-foreground` | `#FFFFFF` | Text on critical — contrast ratio 5.9:1 |
| `--color-background` | `#0F1115` | App background (dark mode default, for outdoor glare reduction) |
| `--color-surface` | `#1A1D24` | Card/panel background |
| `--color-border` | `#2E323C` | Dividers, input borders |
| `--color-text-primary` | `#F5F6F7` | Primary text on dark background — contrast ratio 14.8:1 |
| `--color-text-secondary` | `#B8BCC4` | Secondary/muted text — contrast ratio 7.8:1 |
| `--color-focus-ring` | `#4DA3FF` | Keyboard focus outline, 3px, always visible |

All pairings above meet or exceed **WCAG 2.1 AA (4.5:1)** for body text and **AAA (7:1)** where noted, chosen specifically for outdoor/high-glare stadium lighting conditions.

### Typography

| Token | Font | Weight | Size | Usage |
|---|---|---|---|---|
| `--font-family-base` | Inter | 400/500/600/700 | — | Body, UI text |
| `--font-family-display` | "Space Grotesk" | 600/700 | — | Headlines, zone names on dashboard |
| `--text-xs` | Inter | 400 | 12px / 16px line-height | Captions, timestamps |
| `--text-sm` | Inter | 400 | 14px / 20px | Secondary body text |
| `--text-base` | Inter | 400 | 16px / 24px | Default body |
| `--text-lg` | Inter | 500 | 18px / 28px | Emphasized body / chat responses |
| `--text-xl` | Space Grotesk | 600 | 24px / 32px | Section headers |
| `--text-2xl` | Space Grotesk | 700 | 32px / 40px | Page titles |

### Spacing & Radius

| Token | Value |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 16px |
| `--space-unit` | 4px (all spacing in multiples of 4) |

## 3. Interaction Rules

1. **Loading states are mandatory on every async action.** All forms, buttons triggering API calls, and data fetches must show a `Skeleton` or spinner state; buttons must disable and show an inline spinner during submission (no double-submit possible).
2. **Every interactive element has an `aria-label` or accessible name.** Icon-only buttons (e.g., map zoom controls) require explicit `aria-label` text, not just a `title` attribute.
3. **Keyboard navigation is fully supported.** All interactive elements are reachable via Tab in logical DOM order; `--color-focus-ring` must be visibly applied on `:focus-visible` for every focusable element; no keyboard traps in modals (focus trapped only within the open Dialog, returned to trigger element on close).
4. **Live regions for real-time updates.** Crowd-density changes and new alerts pushed via Socket.IO must update an `aria-live="polite"` region (or `"assertive"` for critical alerts) so screen reader users are notified without manual refresh.
5. **Color is never the only signal.** Density levels (low/medium/high) are shown with color **and** an icon **and** a text label (e.g., "Critical — 92%"), never color alone.
6. **Chat responses render progressively** (streamed) with a typing-indicator state, and always display the detected source language and translated-to language above the response bubble.
7. **Error states are explicit and actionable.** Any failed API call surfaces a `Toast` with plain-language error text and a retry action — never a silent failure.
8. **Touch targets minimum 44x44px** on all interactive elements, for use on shared kiosks and mobile devices in crowded conditions.
9. **Text must remain legible at 200% browser zoom** without horizontal scrolling or content loss (reflow requirement per WCAG 1.4.10).
10. **Language switcher is always visible** in the top navigation, persists selection in local state, and updates all static UI copy immediately (not just chat responses).
