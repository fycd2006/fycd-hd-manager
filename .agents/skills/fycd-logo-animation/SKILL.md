---
name: fycd-logo-animation
description: Builds and refines the FYCD HD 北科伙食團 website intro/loading animation using SVG-first motion design, green/orange branding, accessibility, responsive behavior, and browser verification. Use when implementing or iterating the FYCD HD logo animation.
---

# FYCD HD Logo Animation Skill

## Goal
Create a premium, minimal, lively technology-campus food brand intro for 北科伙食團 (FYCD HD).

## Brand direction
- Primary: fresh grass green and orange.
- Supporting: dark neutral and white.
- Visual keywords: technology, food, campus, energy, clean, playful, premium.
- Do NOT use the phrase "Fuel Your Campus Day".
- Avoid neon cyberpunk, excessive particles, heavy blur, or game-like effects.

## Preferred implementation
1. Inspect the existing project's framework and animation stack before changing anything.
2. Reuse the project's existing dependencies when practical.
3. Prefer SVG/HTML/CSS motion over animating a single raster PNG.
4. If only a PNG exists, preserve it as a fallback while creating an SVG/component-based animated mark when feasible.
5. Keep the loading overlay isolated in a dedicated component/module.
6. Avoid global CSS pollution and layout shift.

## Animation story
The visual story is:
technology circuit -> energy -> food -> FYCD HD identity.

Recommended timeline:
- 0.00–0.40s: green/orange circuit arcs draw in.
- 0.25–0.80s: circuit nodes and food elements appear.
- 0.55–1.10s: bowl scales from ~0.90 to 1.00 with subtle ease-out.
- 1.00–1.50s: 北科伙食團 rises ~15px and fades in.
- 1.35–1.80s: FYCD HD fades in with subtle letter-spacing.
- 1.80–2.20s: tiny 1.00 -> 1.03 -> 1.00 brand pulse, then overlay fades out.

Keep motion smooth and restrained. The animation should feel like a real brand ident, not a generic spinner.

## UX requirements
- First visit in a browser session: full ~2.0–2.3s intro.
- Subsequent navigation in the same session: skip or use a short ~0.5s transition.
- Use sessionStorage unless the existing application has a better state mechanism.
- Support `prefers-reduced-motion`; show the completed logo immediately and do not play decorative motion.
- Never block the app's essential content or network loading.
- Ensure the overlay is removed/hidden after completion so it cannot intercept clicks.
- Responsive on desktop, tablet, and mobile.

## Technical requirements
- Prefer transform and opacity for smooth animation.
- For SVG line drawing, use stroke-dasharray/stroke-dashoffset where appropriate.
- Avoid animating width/height/top/left when transform can do the job.
- Respect the project's existing router and app entry point.
- Add cleanup for timers/listeners.
- Prevent hydration issues in SSR applications.
- Keep accessibility sensible: decorative SVGs should generally be aria-hidden; do not trap focus in the intro.
- Do not add a third strong brand color.

## Browser verification
After implementation:
1. Run the project's normal development server.
2. Open the site in the Antigravity browser.
3. Verify the first-load animation.
4. Verify a second navigation in the same session skips/shortens the intro.
5. Verify mobile viewport behavior.
6. Verify reduced-motion behavior.
7. Check that no console errors occur.
8. Check that the overlay no longer intercepts clicks after completion.
9. If the result looks too slow, too busy, or too flashy, iterate once toward simpler motion.

## Deliverable
Report:
- files changed,
- whether SVG assets were created,
- animation duration,
- how session skipping works,
- reduced-motion behavior,
- browser verification results,
- any remaining limitations.
