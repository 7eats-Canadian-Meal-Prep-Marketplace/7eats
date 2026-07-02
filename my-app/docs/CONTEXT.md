# 7eats - Marketplace for Home-Cooked Meal Prep

## Project Overview
7eats is a two-sided marketplace connecting independent home cooks in Toronto with busy consumers seeking affordable, healthy, and culturally diverse ready-to-eat meals on a weekly basis. Cooks list their weekly menus, set their prices, and manage pickups. Consumers browse by neighborhood, cuisine, and dietary preference, then order once or subscribe weekly. Here we are only building the frontend; backend will be a separate Spring Boot project and database will be Supabase.

### The Problem We Are Solving
Great home cooks in Toronto are selling through Instagram DMs and e-transfers with no infrastructure, no discoverability, and no way to grow. Consumers are paying $25+ on Uber Eats daily or eating the same centralized meal prep every week. No platform exists that connects the two — affordable, diverse, home-cooked meals from real people in your city.

### Why Toronto
Toronto is the most multicultural city in the world. Ghanaian, Filipino, Vietnamese, Jamaican, Lebanese food made by real people in their kitchens exists in every neighborhood. No American platform has meaningfully served this market. 7eats is built here, for here, from the ground up.

### Target Users
- **Cooks (supply):** Home cooks, culinary students, informal meal prep sellers already active on Instagram or Facebook, small catering operators with idle kitchen capacity
- **Consumers (demand):** Busy professionals, university students, gym-goers, new parents — anyone who wants to eat well without cooking or paying restaurant prices

---

## Claude Guidelines

### Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
- **Prioritize responsive design from the start** — design for mobile first, then add tablet and desktop breakpoints incrementally. Do not leave responsive polish for the end.

### Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below) or add a placeholder.
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

### Local Server
- **Always serve on localhost**
- If the server is already running, do not start a second instance.

### Output Defaults
- Mobile-first responsive
- All images are already in `/public/` — use them directly, no placeholders needed
- Logo files are in `/public/` — use `7eats-logo.svg` as the default wordmark

### Available Assets
All assets live in `/public/`. Use the right asset for the right context:

| File | Use |
|------|-----|
| `7eats-logo.svg` | Full wordmark with icon. Use in header and footer. |
| `7eats-icon-red.svg` | Standalone red icon. Use as favicon, app icon, and decorative mark. |
| `7eats-icon-black.svg` | Standalone black icon. Use on light backgrounds where red would clash. |
| `cook-cooking.jpg` | Real cook in kitchen, candid. Use in hero section and about page our story section. Highest trust-building image on the site. |
| `cook-cooking.jpeg` | Alternate crop of cook cooking. Use as fallback or secondary image if needed. |
| `cook-using-app.png` | Cook looking at phone. Use in how it works section (step: coordinate pickups) and features section (order coordination benefit). |
| `meal-prep1.jpg` | Food shot. Use in problem section or statistics section as background or supporting visual. |
| `meal-prep2.jpg` | Food shot. Use in special offer section or as a card image. |
| `meal-prep3.jpg` | Food shot. Use in final CTA section or as a full-bleed atmospheric image. |

### Inspiration
- Always check the `design_inspiration/` folder before designing. It may contain vague examples of what I want to achieve. Those are not for copying images or structure, but to get a sense of the tone, energy and vibe — think Airbnb, Stripe, Notion: clean, warm, trustworthy, human.

### Anti-Generic Guardrails
- **Colors:** Primary color is #D64045 (Red). Secondary color is black (#000000). All on white background (#FFFFFF). Use different grays for hierarchy.
- **Shadows:** Never use flat shadows. Use layered, color-tinted shadows with low opacity. Uber uses soft, diffused shadows — emulate that.
- **Typography:** Use system font stack for everything (clean, fast, native). Create clear hierarchy: headings bold (600-700), body regular (400), small text medium (500) for labels.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. Uber buttons scale slightly on tap, have smooth transitions. No exceptions.
- **Spacing:** Use intentional, consistent spacing tokens (4, 8, 12, 16, 24, 32, 48, 64px). Airbnb and Uber use generous white space — mimic that.
- **Depth:** Surfaces should have a layering system (base → elevated → floating). Cards should feel slightly lifted from background.
- **Icons:** Use Lucide React for all icons.
- **Warmth:** This is a food and community product. The design should feel warm and human, not cold and corporate. Photography, copy, and layout choices should reflect real people and real food, not stock imagery aesthetics.

### Hard Rules
- Do not "improve" a reference design — match it
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- No gradients, no emoji, no "AI-generated" look
- Never use food illustration clichés (cartoon forks, chef hats, etc.)
- No decorative dividers, wavy SVG section separators, or diagonal cuts between sections — use whitespace and background color shifts to separate sections instead
- No card grids with identical forced heights or perfectly symmetrical layouts that look machine-generated — embrace natural content rhythm
- No hero sections with a centered headline, centered subheadline, and two centered buttons stacked vertically — that is the default AI layout, break it
- Never rely on a single font weight for everything — establish a clear typographic scale with at least three distinct weights and sizes and use it consistently across every section
- No full-width colored banners with white bold text centered and a single CTA button — this is the most common vibe-coded pattern, avoid it entirely
- Buttons must have a defined height, specific horizontal padding, a border-radius that matches the brand, and a clear active state with a slight transform scale down on click
- Section padding must be consistent and intentional — define it as a CSS variable and never deviate
- Images must never be stretched or squeezed — always use object-fit: cover inside a container with an explicitly defined aspect ratio
- Line heights on headings must be set explicitly — never rely on browser defaults which create unintentional loose gaps between heading lines
- Never use box-shadow: 0 4px 6px rgba(0,0,0,0.1) — this is the default AI shadow and looks generic, use multi-layer shadows with warm color tinting as specified in brand guidelines
- Letter-spacing on uppercase labels and small text must be set explicitly, typically 0.05em to 0.1em — default tracking on small caps looks amateurish
- Do not use opacity reductions on #D64045 to create lighter variants — use explicit hex values for any tints
- Every section must have a clear visual hierarchy: one dominant element, one supporting element, one tertiary element. Never let everything compete at the same visual weight
- Avoid centering body text in sections longer than two lines — left-aligned body text is easier to read and looks more professional
- Interactive elements must have a visible focus-visible outline for accessibility that matches the brand color, not the browser default blue ring

---

## Brand Guidelines

| Element | Value |
|---------|-------|
| **Primary Color** | #D64045 (Red) |
| **Secondary Color** | #000000 (Black) |
| **Background** | #FFFFFF (White) |
| **Text Primary** | #111111 |
| **Text Secondary** | #666666 |
| **Text Muted** | #999999 |
| **Border** | #EEEEEE |
| **Card Background** | #FFFFFF |
| **Card Shadow** | Soft, diffused, warm-tinted |
| **Hover Shadow** | Slightly elevated |

**Typography:** System font stack (clean, fast, native)

---

## Design Philosophy
- Clean, warm, minimalist (inspired by Airbnb, Stripe, Notion)
- Ample white space
- Mobile-first responsive design (build responsive from day one)
- Use regular CSS with CSS Modules
- Every interactive element has considered states (hover, focus, active)
- Human over corporate — real names, real food, real neighborhoods

---

## Audience Targeting — Critical Context

**Both pages on this site are exclusively targeting cooks, not consumers.** This is a cook recruitment site. Every headline, every subheadline, every CTA, every image choice, and every piece of copy should speak directly to a person who already cooks and sells informally, and is considering joining 7eats as a founding cook. There is no consumer-facing content on this site yet. Do not write copy that targets someone looking to buy meals. Do not design sections that explain the platform to a consumer. The visitor is always a cook.

---

## Pages & Build Order

Build in this exact order. Each page must be mobile-first responsive from the start.

---

### Phase 1: Cook-Facing Waitlist Site

**Order:** 1 → 2

---

#### 1. Home Page (Cook Waitlist Landing)

**Purpose:** Recruit founding cooks. Build trust, communicate the opportunity, and drive two actions: joining the email waitlist and booking a call with the founder.

**Sections:**

| Section | Content | Image |
|---------|---------|-------|
| **Header** | Logo (left), navigation links: "About", "Apply" (right). Sticky on scroll. | `7eats-logo.svg` |
| **Banner Flash** | Thin full-width bar above header. Special offer: first 40 cooks get lifetime reduced commission and founding cook badge. Dismissible. | None |
| **Hero** | Mission statement headline, not a feature list. Subheadline that speaks directly to the cook's current reality: managing orders through DMs, chasing e-transfers, invisible to new clients. Two CTAs: "Join the waitlist" (email capture) and "Book a call with the founder" (Calendly popup widget, not a link, not a new tab — use Calendly's popup widget script so the calendar opens as a modal overlay on the same page). Social proof hint: X cooks have already applied. | `cook-cooking.jpg` as the hero image, full bleed or large right-side panel depending on layout |
| **Problem** | Short section summarizing the gap. Great cooks in Toronto are already selling but have no infrastructure, no discoverability, no way to grow. Consumers are overpaying on Uber Eats or eating boring centralized meal prep. 7eats connects both sides. | `meal-prep1.jpg` as a subtle background or supporting visual, low opacity if used as background |
| **Features and Benefits** | Four key benefits for cooks: order and pickup coordination, deposit security and payment processing, customizable listing with calories and dietary info, dynamic pricing and timely deals. Each benefit has a short honest description, no marketing fluff. | `cook-using-app.png` as a supporting visual for the coordination benefit card |
| **How It Works** | Four steps: onboard and set up your profile, list your weekly menu and set your price, coordinate pickups through the platform, earn and grow your subscriber base. Consider breaking away from white background here for visual contrast. | `cook-using-app.png` in the coordinate step. If going dark background use `7eats-icon-red.svg` as a decorative element |
| **Statistics** | Relevant Toronto market stats: population, cultural diversity, average spend on food delivery, meal prep market size. Ground the opportunity in real numbers. | `meal-prep2.jpg` as a subtle background panel or side image |
| **Special Offer** | Dedicated section for founding cook benefits: permanent founding cook badge, lifetime reduced commission rate, priority neighborhood placement, early access to all new features, direct line to the founder. Frame it as exclusive and time-limited, 40 spots only. | `7eats-icon-red.svg` as a badge visual or decorative mark next to the founding cook badge benefit |
| **FAQ** | Two-column grid. Common cook questions: is it free to join, what cuisine types are accepted, do I need a commercial kitchen, how does payment work, when does the platform launch, what cities are supported at launch. | None |
| **Final CTA** | Centered. Headline directed at the cook. Two actions: email input for waitlist, button linking to Calendly for founder call. | `meal-prep3.jpg` as full bleed background with dark overlay, text on top |
| **Footer** | Logo, navigation links, privacy policy link, cookie consent policy link, copyright. | `7eats-logo.svg` |

**Data:** Forms and Calendly link can be inactive placeholders for now, integration comes after.

---

#### 2. About Page

**Purpose:** Build trust with cooks who want to understand who is behind this before applying. Human, honest, and specific.

**Sections:**

| Section | Content | Image |
|---------|---------|-------|
| **Header** | Same sticky header as home page. | `7eats-logo.svg` |
| **Our Story / Who We Are** | Founder story. Where the idea came from, what was observed about the Toronto food scene, why this felt like something that needed to exist. Real and personal, not a corporate origin story. Photo of the founder. | `cook-cooking.jpg` as the section's primary image alongside the founder story text. Candid, warm, human. |
| **Why We Are Building This** | The conviction behind 7eats. Toronto has extraordinary culinary talent spread across immigrant communities with no platform to reach beyond their personal network. Consumers are paying Uber Eats prices for food that does not come close to what a home cook can make. This platform exists to fix that specific imbalance in this specific city. | `meal-prep2.jpg` or `meal-prep3.jpg` as a supporting visual, food that looks real and made with care |
| **Our Values** | Three to four short principles. Cooks keep what they earn. Cultural diversity is the product, not a feature. Your neighborhood should feed you. Transparency over extraction. Each principle is one sentence with a short honest explanation. | None, let the words carry this section |
| **Footer** | Same footer as home page. | `7eats-logo.svg` |

---

### Future Phases (Not in MVP)

- Consumer-facing marketplace with browse and ordering flow
- Cook profile pages and menu management
- Subscription and one-time order flow
- Payment processing and deposit handling
- Review and rating system
- Authentication and user profiles
- Delivery coordination layer
- Mobile app
- Internationalization (en/fr)
- Loading states, empty states, error boundaries

---

## Technical Preferences
- **Framework:** Next.js with App Router (TypeScript)
- **Styling:** CSS Modules (`.module.css`)
- **Components:** shadcn/ui (customized with #D64045 and black) when applicable
- **Icons:** Lucide React
- **Data Fetching:** Fetch from backend API as defined in `api.md` when relevant

## CSS Approach
- `app/globals.css` for reset, typography, theme variables
- CSS variables for colors, spacing, breakpoints
- Mobile-first media queries
- Component-specific styles in `Component.module.css`
