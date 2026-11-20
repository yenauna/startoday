# Logo Prompt Patterns

Use one route at a time. Choose the route from the locked brief, not from a trend list. Use the 60-project [Brand Design Reference Library](../../shared-references/brand-design-reference-library.md) and, for Arabic-market work, the [Arabic Brand Design Reference Library](../../shared-references/arabic-brand-design-reference-library.md) to study methods such as a concrete product anchor, a scalable symbol, script balance, or a repeatable identity device; never ask a generator to imitate a named logo or reference.

## Before writing any image prompt

- Confirm the locked brand name, exact script(s), industry/offer, audience, market, personality, differentiator, and approved palette.
- Select one mark route: icon, wordmark, emblem, or combination. If the client has not chosen and the brief supports more than one, explain the options and ask which route to explore.
- Turn the brand promise into one concrete visual idea. Do not stop at “abstract”, “modern”, or a mood adjective.
- Use exact approved hex codes for every brand-colored surface and the background. If no color is locked, return to `../brand-identity`; do not fill the gap with a guessed hue.
- Decide which text, if any, must be correct. Image generators often misspell names and mishandle Arabic, mixed scripts, and small lettering. Keep exact copy out of image generation when accuracy matters; add typeset text afterward.
- Treat “vector-style” as a visual style request, not a claim that an image model creates editable vector artwork. Prepare or commission the final production vector separately.

## Logo prompt anatomy

Write a prompt with these parts, in this order:

1. **Brand and task** — exact approved name, what the business does, and whether this output is a mark, wordmark, or lockup.
2. **Single idea** — concrete object, action, form, or relationship tied to a verified brand truth.
3. **Shape logic** — silhouette, geometry, negative space, stroke/fill behavior, symmetry/asymmetry, and detail level.
4. **Typography** — exact script and spelling if included; intended character and weight; note RTL/bilingual hierarchy when relevant.
5. **Palette** — exact palette hex codes and roles, background hex, and allowed number of colors.
6. **Composition** — one mark only, centered, padding, square or horizontal aspect ratio, plain background, no presentation mockup.
7. **Use tests** — simple silhouette, one-color reproduction, small-size legibility, contrast on approved backgrounds.
8. **Exclusions** — only the failure modes relevant to this brief: stock symbols, decorative detail, unwanted literal imagery, invented words, gradients or effects that contradict the direction.

## 1. Concrete icon mark

Best when the brand needs an independent symbol that can read as a profile avatar, app icon, stamp, or small label. Simplify one concrete anchor. If the concept has two ideas, state which one leads and how the second supports it.

“Design one original icon mark for [exact brand name], a [specific business/offer] for [audience/market]. The mark should express [one verified brand promise] through a simplified [concrete object or action], not through a generic symbol. Use [specific silhouette and geometry], with [stroke or solid-fill behavior] and [negative-space relationship]. Keep [distinctive feature] visible at small sizes and remove details that disappear below [target size]. Use only these approved brand colors: [exact HEX and role], [exact HEX and role]; place the mark on [exact background HEX]. Use a centered [square / other exact ratio] composition with [padding rule]. Show one flat mark only. It must remain identifiable as a single-color silhouette and must not rely on texture, mockup lighting, or tiny detail. Avoid [relevant undesired symbols], stock clipart, extra lettering, additional colors, gradients, shadows, and 3D effects unless those effects are explicitly part of the approved brief. Output one clean concept image; final lettering and vector construction will be prepared separately.”

## 2. Wordmark

Best when the approved name has strong verbal distinctiveness or the brief prioritizes recognition through lettering. Do not ask the model to invent or “correct” the spelling.

“Create one typographic wordmark for [exact, copy-pasted brand name and script]. Preserve every character and its order exactly. The business is [specific offer]; the audience and market are [verified audience and geography]. Build a custom typographic direction around [letterform properties: contrast, width, terminals, rhythm, joins, or movement] to communicate [two approved personality traits]. Keep counters open and letter spacing balanced at [smallest intended use]. If the wordmark is bilingual, show the approved Arabic and Latin forms as separate, correctly spelled lines with [approved hierarchy/alignment]; do not fuse the scripts or invent transliteration. Use [exact HEX] for the wordmark, [exact HEX] for an optional accent, and [exact HEX] for the plain background. Show one front-facing, isolated wordmark with ample clear margin. Do not add an icon, tagline, frame, mockup, extra text, or unapproved colors. If the lettering is not exact, treat the output as a shape reference and typeset the final wordmark using a verified font or manual vector lettering.”

## 3. Emblem or badge

Best when the brief supports heritage, craft, membership, a place, or a formal seal. Keep the smallest text optional and protect it from generator errors.

“Design one [circle / shield / custom outline] emblem for [brand and specific offer]. Its central idea is [concrete, verified anchor], simplified into [clear shape relationship]. Use [approved visual era/character] without imitating a historical seal or another brand. Reserve the center for [symbol or exact approved initial]. If the full name is included, preserve this exact spelling and script: [copy-pasted name]; if accurate text cannot be rendered, leave a clean, intentional space for real typesetting. Keep the border, symbol, and lettering in a clear hierarchy that survives at [target physical/digital size]. Apply only [exact HEX and role] and [exact HEX and role] on [exact background HEX]. Show a flat front-on badge with equal margin, no fabric/metal mockup, no extraneous ribbon, date, location, or slogan, and no decorative texture that harms legibility.”

## 4. Initial or monogram

Use only when initials are meaningful and do not create confusing or culturally sensitive letter combinations. Test scripts separately; an English initial is not a substitute for the Arabic name.

“Create one monogram from the exact approved character(s) [characters and script] for [brand]. The characters should remain legible and should not become an unrelated object. Explore [one precise construction: shared stem, counter-space, overlap, or modular grid] connected to [verified brand idea]. Preserve the correct glyph forms and reading order; do not invent a ligature or alter diacritics. Use [exact HEX] as the primary mark, [exact HEX] only as a restrained accent, and [exact HEX] for the background. Make a simple centered mark with generous clear space, usable at [smallest intended size]. Show a one-color silhouette check as a separate output only if requested. Avoid ornamental complexity, unapproved script styling, extra words, shadows, and backgrounds.”

## 5. Combination lockup

Assemble only after the symbol and wordmark have been separately reviewed. Keep them as distinct components unless the locked brief explicitly asks for a custom integrated construction.

“Assemble the approved icon [attached asset] and approved wordmark [attached asset] into one brand lockup. Preserve their exact geometry, spelling, colors, and proportions; do not redraw, regenerate, embellish, or substitute either element. Place the symbol [above / left / approved position] with clear space measured using [approved logo rule]. Use [exact background HEX] and show a flat, front-facing lockup. Produce [primary horizontal / stacked] only. Keep the background plain and show no mockup, tagline, extra text, or alternate color.”

## Hand-off and review

Do not call a generated logo final until a human has checked: spelling and script, recognizability, distinctiveness from references and competitors, silhouette, one-color reproduction, contrast on light/dark approved backgrounds, smallest intended size, and suitability for actual production. Record which files are generated concepts versus approved production art.
