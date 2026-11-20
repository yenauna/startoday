# Technical Spec

## Hard constraints

- **Single file**: one `.html` file containing all CSS and JS inline (`<style>` / `<script>` tags). No separate `.css`/`.js` files, no build step, no package manager.
- **No frameworks**: no React, no Tailwind CDN, no Bootstrap. Plain HTML/CSS/vanilla JS only.
- **Fonts**: use the exact font names from the brief. Prefer supplied/licensed local font files when available; if an external font service is approved, include a system fallback and make the page readable without network access. Do not silently choose a font that changes the brand.
- **Images**: reference the logo/mockup image files by relative path from `/assets/` (e.g. `../assets/logo/logo.png`), so the HTML stays small and the images stay editable/replaceable independently.
- **Responsive**: must work on mobile and desktop — this is a page a client might open on their phone.
- **Opens by double-click**: no local server required to view it correctly.

## Code quality

- Keep CSS organized by section with simple comments marking each one, so a later edit (e.g. "change the color section's background") is easy to locate.
- Prefer CSS custom properties (`:root { --primary: #...; }`) for the brand's locked colors, used consistently through the file — this also makes a later color tweak a one-line change instead of a find-and-replace across the file.
- Avoid inline `style=""` attributes for anything beyond one-off positioning; keep the bulk of styling in the `<style>` block.
- Add `lang` and, when needed, `dir` attributes that match the page's primary language; handle bilingual sections with explicit reading direction and text alignment.
- Use semantic section landmarks, descriptive image alt text, visible keyboard focus, and contrast that can be read over each background. Do not rely on color alone to communicate a role.
- Use responsive `max-width`, fluid type where appropriate, `height: auto`, and carefully chosen `object-fit` behavior. Keep source images at their natural proportions unless a deliberate crop is part of the art direction.
- If motion is used, keep it subtle, optional, and subject to `prefers-reduced-motion`; the page must remain complete without animation.
- Keep JavaScript optional and small. Use it only for a clear interaction; the entire identity story must still work if it is disabled.

## What NOT to do

- Don't split the presentation into multiple linked HTML pages ("page 1, page 2...") — it must be one scrollable file.
- Don't hardcode a mockup image at a size/aspect ratio that breaks if the actual generated image has different proportions — use `max-width: 100%; height: auto;` patterns and verify after inserting real assets.
- Don't leave placeholder lorem-ipsum text or a filler color if the real value is known — pull every value from the locked brief.
- Don't display guessed minimum logo size, clear space, color contrast ratios, or print specifications as approved rules. Include only values supplied or measured and confirmed.
- Don't rely on network-only imagery or fonts when the page is expected to open locally; identify optional network dependencies in the handoff.
- Don't use a visual preview to imply that an AI-generated application image is a production-ready print file.
