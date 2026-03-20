# Lessons — GetSignalHooks

Patterns learned from audits, critiques, and fixes. Read before starting new sessions.

---

## Session: Site Audit + Critique + Onboard (March 2026)

### Audit/Accessibility

**A1. Focus rings must be explicit on every interactive element.**
`button.tsx` had excellent `focus-visible` coverage but nav links, sidebar items, and all toggle controls (currency switcher, collapsible cards) did not. The pattern exists — it just wasn't applied uniformly. When adding any new interactive element, immediately add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]`.

**A2. aria-expanded and aria-pressed are missing by default — always add them to toggles.**
Currency switcher, mobile menu toggle, collapsible hook-card button — all managed open/closed state visually but communicated nothing to screen readers. Rule: any `<button>` that toggles something open/closed needs `aria-expanded`. Any `<button>` that represents an on/off state needs `aria-pressed`.

**A3. Mobile menus need a keyboard trap.**
Open menu → Tab cycles through the page behind it. Pattern to always use: `role="menu"` on container, `role="menuitem"` on links, `useEffect` to close on Escape and return focus to toggle, `useEffect` to auto-focus first item on open.

**A4. Purely visual indicators need sr-only equivalents.**
The confidence dot (emerald/amber/rose) communicated quality level only through colour. Add `<span className="sr-only">High confidence</span>` adjacent to any colour-only indicator. This also satisfies WCAG 1.4.1 (use of colour).

**A5. `aria-required="true"` is not redundant next to HTML `required`.**
Some assistive technologies require the explicit ARIA attribute. Always add both on required form inputs.

**A6. Touch targets: sidebar links with `py-1.5` (6px) fail WCAG 2.5.5.**
App shell sidebar nav links had only 6px of clickable vertical space. Minimum is `py-2.5` to approach 44px. Check all sidebar/secondary nav items in app layouts, not just primary CTAs.

**A7. `animate-pulse` on continuous decorative elements needs `motion-safe:` prefix.**
`animate-pulse` on the hero badge dot runs continuously regardless of OS accessibility settings. Always wrap persistent animations in `motion-safe:animate-pulse` or `motion-safe:animate-spin`.

---

### Performance

**P1. `blur-[150px]` on large absolute elements is a GPU paint bottleneck on mobile.**
Two overlapping hero orbs with `blur-[150px]` on an 800×1100px element cause full paint layer recalculations. Rule: blur orbs should not exceed `blur-[80px]`, and element sizes should be constrained. Add `style={{ willChange: 'transform' }}` to promote to compositor layer.

**P2. Framer Motion for a single height animation is an expensive import (~30KB gzipped).**
`AnimatePresence` was used once for an expand/collapse. Replace with CSS `grid-template-rows: 0fr → 1fr` transition — zero JS cost, same visual result, works with `prefers-reduced-motion`. Only import Framer Motion when you need complex gesture-based or cross-component animations.

---

### Design / Visual Identity

**D1. Dark theme + violet glows + Geist = "recognisable Next.js SaaS" immediately.**
The combination is technically competent but visually generic. Future projects should either commit to a genuinely distinctive aesthetic direction or actively break 2-3 of these patterns. The site passes function but fails memorability.

**D2. Eyebrow labels above headings must add information, not repeat it.**
"Pricing" above an h2 that says "Pricing that fits how you already do outbound" is redundant. An eyebrow label earns its place by providing genuinely additive context: "7-day free trial · no card required" above the pricing heading is useful. If the label just names the section, remove it or upgrade it.

**D3. Integration badges need contrast to serve as trust signals.**
`text-zinc-500` on `bg-zinc-800/30` is almost unreadable. Integration names positioned as social proof need to be actually read. Use `text-zinc-300` minimum. Framing matters too: "Works with your existing stack" is more powerful than "Export via CSV to".

**D4. Token discipline breaks down when hardcoded hex values are the default.**
Seven distinct near-black backgrounds (`#080808`, `#0b0b10`, `#0a0a0b`, `#131320`, etc.) appeared across 15+ components. `globals.css` defines `--color-canvas` and `--color-surface` but components ignore them. Always use the canonical design tokens; add new tokens for new semantic colours rather than new hex values.

**D5. Both CTAs with identical icons weakens hierarchy.**
When primary and secondary actions share the same directional icon, the visual hierarchy between them collapses. Primary button: icon reinforces the action. Secondary button: let variant styling (filled vs ghost) carry the hierarchy weight alone.

---

### Copy & Microcopy

**C1. Generic contact page copy ("Get started") is a conversion dead-end.**
"Get started with GetSignalHooks" tells the visitor nothing about what happens next. Sales-assisted contact pages should: name what the visitor gets ("example hooks for your exact market"), set expectations ("we reply within one business day"), and match the intent of the visitor (sales conversation, not self-serve signup).

**C2. Skip button copy should make the trade-off concrete.**
"Skip (generic output)" is accurate but undersells the cost. "Generate a demo hook instead — won't mention your product" makes the consequence concrete and gives the user an accurate mental model of what they'll get.

**C3. Dashboard welcome cards should have one job: one action.**
"Two steps to your first outbound hook" with Step 1 and Step 2 implies sequential prerequisites. Importing leads is NOT a prerequisite for generating a hook. One card = one action = one CTA. Everything else is a secondary action discoverable from the sidebar.

---

### Onboarding

**O1. JIT gates should fire on arrival, not on action.**
The context wallet modal firing on "generate click" reads as a barrier (user has high intent, hits a form). Firing on page arrival ("Before we generate — 60 seconds to personalise your hooks") sets the expectation correctly as setup, not interruption.

**O2. Zero-state dashboards with all-zeros communicate no product value.**
A user who sees 0 hooks, 0 leads, 0 emails before generating anything has no evidence the product works. Showing a clearly-labelled example output ("Example output" card) on the zero-state proves the product works before the user invests in setup.

**O3. The aha moment needs to be acknowledged.**
After a user's first generation, a quiet inline nudge ("Your first hook. Copy it, paste it into your next email") provides a concrete next step without being patronising. Store dismissal in `localStorage` under `'first-hook-seen'` — never show it again after dismissal.

**O4. Persistent sticky banners interrupt core task flows.**
The email verification banner rendered while users were trying to generate their first hook. Account admin notifications should be demoted to settings pages or compact inline notices. The core task flow (generate → copy → send) should be uninterrupted.

---

### Process

**PR1. Parallel agent dispatch is highly effective for independent file groups.**
7 agents working across 7 non-overlapping file groups completed ~25 changes faster than sequential execution. Key discipline: group by file ownership, not by task type. Each agent touches only its assigned files.

**PR2. Agents that plan before acting may pause for approval — always add "proceed without approval" to prompts or respond with SendMessage.**
One navbar agent returned a plan and waited. Future prompts should include explicit "implement all changes, do not pause for approval."
