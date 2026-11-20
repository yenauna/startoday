# Mockup Prompt Patterns

Read `brand identity.txt`, when present, and `mockup-types-by-business.md` first. In the full branding workflow, use the [Brand Design Reference Library](../../shared-references/brand-design-reference-library.md) and the [Arabic Brand Design Reference Library](../../shared-references/arabic-brand-design-reference-library.md) to visually inspect at least five global and five Arabic-market projects before drafting. Open direct case pages and inspect their actual identity/mockup imagery; titles, snippets, and text summaries do not count. Follow the `agent-reach` skill's access rules, and use a visual-capable browser/tool if text retrieval does not expose imagery. Do not copy any reference's product, composition, logo, palette, typeface, or distinctive treatment.

## Prompt inputs to collect

For each approved mockup, establish:

- The exact object, screen, or scene and why a customer would encounter it
- The intended market and country/region for any real-world setting
- Object dimensions or useful scale cue, construction, substrate, finish, and realistic condition
- The actual logo file and approved lockup; the prompt must not redraw or reinterpret it
- Exact attachment filenames and the role of each one: logo image, palette/design-system board, `brand identity.txt` text specification, product/package photo or artwork, and any optional inspiration image
- Whether the image tool accepts image references, text/document references, or both; use only capabilities it actually supports
- Exact approved hex codes for any brand-colored surfaces and the background
- Whether a palette/design-system reference image exists. When supplied, name it and explicitly tell the image tool to use the uploaded image as its visual reference; when absent, state that and repeat each approved HEX value and role in the prompt
- Where the logo sits, approximate physical size, any approved clear-space rule, orientation, and whether it is printed, embossed, embroidered, etched, or shown on-screen
- Camera angle, lens feel, crop, lighting, surface shadows, and image aspect ratio
- Whether this is a clean brand-guidelines presentation or an explicitly requested campaign/lifestyle scene
- One or two general methods from visually inspected references that fit the approved brand, plus the original element that must not be copied
- Any exact visible copy; for image generation, default to no words and add verified text afterward

Ask for missing facts that materially change the prompt. Do not guess the country, economic tier, product substrate, audience, or required mockup type.

## 1. Clean studio object mockup

Use for brand presentations and guidelines when the goal is to inspect identity application clearly.

“Create a clean studio product photograph of [exact object and product type] for [brand], a [specific business]. The object is [dimensions or scale cue], made from [verified substrate/material], with [construction, edge, closure, finish, and realistic texture]. Use [exact HEX] for the brand-colored surface and [exact HEX] for the plain background; allow only the neutral material colors inherent to [specified material]. Use the uploaded [exact logo filename] image as the exact logo reference and apply the approved mark visibly at [exact position], at approximately [physical proportion], in [approved print/finish method]. Preserve the logo's spelling, silhouette, proportions, color, and clear space; do not redraw, replace, or omit it. Show [camera angle and crop] with soft, even [light direction], realistic contact shadows, legible material texture, and enough margin to inspect the whole object. Output one object, front-facing enough to evaluate, with no people, extra products, captions, invented marks, fake text, watermark, or decorative set dressing. If the tool cannot keep the actual supplied mark intact, do not present its generated mark as final; use the supplied art in an image-editing/compositing step, or leave an accurately placed blank area and label that output provisional.”

**Add this reference block to every mockup prompt, not just the studio example, and replace every filename:**

```text
UPLOAD THESE REFERENCES BEFORE RUNNING:
- [exact-logo-file.png]: Use the uploaded image as the exact logo reference. Apply this approved mark visibly at [position/scale]. Preserve the artwork; do not redraw, replace, or omit it.
- [palette-board-file.png, if supplied]: Use the uploaded image as the visual palette and design-system reference. Follow its approved color roles and visual behavior.
- [brand identity.txt, if supported]: Use as the text source of truth for exact HEX values, approved copy, materials, and system rules.
- [actual-product-or-package-file, when relevant]: Use only as a reference for the actual product/package details it shows.

Brand colors: [#HEX — role/surface, #HEX — role/surface]. Do not substitute colors.
If the selected tool cannot preserve the attached logo, stop treating the result as a final branded mockup; leave a clean, accurately positioned area for real-asset compositing and label the result provisional.
```

## 2. Real-world place or person

Use only when the user wants context/lifestyle imagery or the actual customer touchpoint requires it. Use the geography already locked in the brief; if it is missing, ask first.

“Create a [documentary / campaign] photograph of [specific scene or person] for [brand] in [country, city/region, and neighborhood or setting type]. The location should read as [verified architectural, cultural, and economic context], not a generic stock-photo default. The person, if shown, is [non-sensitive, task-relevant description] doing [natural action] in [realistic context]. Show [object/touchpoint] with the attached approved logo placed at [position and approximate scale] using [realistic application method]. Use only [exact HEX codes] for brand-colored elements; set unbranded environmental colors/materials to [specific described context]. Composition: [camera distance, angle, lens feel, crop, negative space]. Lighting: [brand-matched light quality and direction], with [realistic level of contrast]. Keep the logo legible and physically plausible. No invented copy, extra logos, stereotypes, unrelated props, altered marks, or unapproved color accents.”

## 3. Packaging family or product range

Use when the user needs to demonstrate a system across multiple product variants. Do not invent flavors, claims, ingredients, sizes, or regulatory text.

“Photograph a coherent [number] item family for [brand and category]: [list only user-approved variants]. Keep the shared layout consistent: [logo position], [type hierarchy], [repeatable brand device], and [exact HEX palette and roles]. Differentiate variants only through [approved coding rule such as a named accent, illustration, or label field]; use [exact approved hex for each color]. Show [pack formats/materials] from [camera angle], arranged [specific grouping and spacing] so each label can be compared. Use [background HEX] and [lighting]. Preserve the attached logo artwork. Leave all small copy blank for accurate typesetting unless exact copy assets are supplied. Do not add unapproved ingredients, nutrition claims, seals, barcodes, regulatory marks, or decorative elements. The result should read as one family at a glance and as distinct products on closer inspection.”

## 4. Beauty / cosmetics packaging system

Use only for user-confirmed beauty products and selected pack formats. Confirm the hero SKU, variants, exact package structure, approved copy, and price/experience tier first. “Premium” should come from the locked brand direction and feasible materials, not a stock luxury preset.

```text
Create an on-brand product mockup at the approved [experience/price tier] for [brand] in [confirmed beauty subcategory]. Show only the approved hero product(s): [exact product names/variants]. Package structure: [verified primary container, closure/applicator, and secondary carton if supplied]. Do not add products or sizes that are not listed.

UPLOAD THESE REFERENCES BEFORE RUNNING:
1. [exact logo filename]: use the uploaded image as the exact logo reference. Keep it clearly visible on [approved label/face/position] at [approximate scale]. Preserve its lettering, silhouette, proportions, colors, and clear space; do not redraw, substitute, or omit it.
2. [palette/design-system board filename, if supplied]: use the uploaded image as the visual reference for approved palette, type/graphic behavior, and brand mood. Follow the system; do not copy any unrelated moodboard/logo artwork.
3. [brand identity.txt, if supported]: use as the source of truth for all approved color roles, type/script behavior, claims, copy, and package rules.
4. [actual product/packaging/artwork filename]: use as the source for real package shape, product appearance, and supplied label artwork; do not redesign physical details that are already approved.

VISUAL SYSTEM: use these exact approved colors only: [#HEX — role — surface]. Use [confirmed type direction and graphic behavior] as specified in the brand identity. Keep shared anchors consistent across the family: [logo position, information hierarchy, grid, and approved graphic device]. Differentiate variants only by [exact approved rule].

PREMIUM CUES (approved): [specific approved finish, material, lighting, spacing, or image behavior]. If no finish or material has been approved, use a neutral, realistic presentation and do not invent foil, glass, embossing, stone, metallic accents, or luxury props.

Composition: [camera angle, crop, scale, spacing, orientation]. Lighting/material rendering: [brand-fit light and verified surface behavior]. Keep product and logo readable at [intended presentation size]. Use [exact background HEX or approved neutral].

Copy: render only [exact approved copy/artwork]. Leave [fields] blank for manual typesetting if final text/artwork is missing. Do not invent ingredient, efficacy, safety, clinical, sustainability, origin, certification, dosage, size, shade, scent, barcode, warning, or regulatory claims.

Quality check: correct attached mark and spelling; exact color roles; coherent shared packaging hierarchy; only approved variants and assets; realistic, not falsely certified, materials; sufficient label legibility and crop. No fake logo/text, extra products, unapproved props, watermark, or copied competitor/reference design.
```

## 5. Digital interface or device mockup

When possible, build the actual UI in standalone HTML/CSS and place a screenshot into the device scene. Image models frequently invent interface text and controls.

“Create a [device/context] product mockup showing the supplied interface screenshot exactly. Do not generate, alter, or paraphrase the interface, logo, words, numbers, icons, or controls. Device: [model/form factor if supplied, otherwise generic unbranded device], viewed from [angle], with [screen reflections and bezel detail]. Place it against [exact background HEX] with [lighting and shadow]. Keep the screenshot fully visible and undistorted; preserve a readable screen scale. No extra screen, invented notifications, interface copy, watermark, or brand mark outside the supplied UI.”

## 6. Presentation-ready versus campaign photography

- **Identity/guideline image:** clean lighting, clear material, controlled crop, little or no environment, faithful logo placement.
- **Campaign image:** a real narrative or lifestyle moment only if requested; follow the brand's image direction and market context. Give the story one subject and one action.
- **Stylized or illustrated mockup:** match the illustration/rendering style to the approved identity. Do not combine flat identity artwork with cinematic effects by default.

## Placement fidelity checklist

Before delivery, check: the correct attached logo variant; no distorted/misspelled mark; plausible scale and surface perspective; clear space; approved colors; material/print method; expected crop; no generated fake text; and fit with the audience, market, and actual business touchpoint. If the model cannot preserve the real logo, use an image-editing/compositing step with the approved asset, or produce a clearly provisional placement-area mockup. Never treat an unbranded output or generated substitute mark as the final branded result.
