# Complete Brand System Framework

Use this reference when creating or refreshing a full brand identity, especially when the user wants a premium, polished, or product-led result. It turns the approved strategy into a connected system that later logo, mockup, campaign, presentation, and guideline prompts can reuse. It is a decision checklist, not a demand to invent every field: record unknowns as `OPEN`, recommendations as `PROPOSED`, and only user-confirmed choices as `LOCKED`.

## What “complete” means

A complete identity gives every downstream deliverable the same source of truth. It explains both the design elements and how they work together across real customer touchpoints. A collection of attractive but unrelated colors, fonts, logos, and mockups is not a complete identity.

Before locking the direction, make sure the brief explains:

1. **Strategy:** offer, audience, market, positioning, meaningful differentiation, promise and evidence, price/experience tier, and what the brand must not imply.
2. **Core identity:** exact name/spelling by script, logo assets and variants, palette with exact hex and roles, typography hierarchy, language/script behavior, and any established graphic assets.
3. **Recognizable design codes:** approved shapes, pattern, illustration/icon style, image treatment, layout/grid behavior, and one or more signature behaviors that can work even when the logo is small or absent. Do not invent signature assets without approval.
4. **Verbal identity:** voice traits translated into writing behavior, languages/dialects, approved terminology or copy, and words/claims to avoid.
5. **Application rules:** what remains consistent and what may vary across the specific packaging, digital, social, retail, or service touchpoints in scope.
6. **Production and governance:** supplied files, material/print or screen constraints, accessibility needs, approval state, source/provenance, unresolved decisions, and a short fidelity checklist.

For each major design choice, connect it to an approved audience need, positioning point, or practical constraint. If the rationale cannot be stated, keep the choice proposed rather than presenting it as an established brand fact.

## Premium without a generic luxury preset

“Premium” is a positioning and experience decision, not a palette. Ask what tier the user intends, who should recognize that value, how the product earns it, and where customers will encounter it. Translate the answer into a few observable behaviors such as confident hierarchy, restrained but distinctive graphic detail, precise product photography, material quality, or unusually clear information design. Choose only behaviors the user approves and the production context can support.

Do not infer premium from black, gold, serif type, minimalism, glass, metallic finishes, sparse copy, English-only labels, or high prices. Those may fit a brief, but they can also clash with the audience, product, market, or channel. Avoid piling on “luxury,” “elegant,” “premium,” and “exclusive” as adjectives unless each maps to a specific approved visual or verbal behavior.

## Cosmetics and beauty module

Use these questions only when relevant to the actual category; do not assume skincare, makeup, haircare, fragrance, or wellness are interchangeable.

### Confirm the product and customer context

- Exact subcategory and product(s) in scope; existing or proposed status of each.
- Hero product and confirmed line/variant structure: product names, sizes, shades/scents, and the user-approved rule that differentiates variants.
- Target customer, market, price/experience tier, purchase channel, use occasion, and the customer need the product addresses.
- Which product, formula, ingredient, efficacy, origin, testing, safety, sustainability, or clinical statements are verified and approved for use. Keep all others open; never add a benefit claim to make packaging look finished.
- Exact packaging formats supplied or in scope: primary container, closure/applicator, secondary carton, set, shipping box, retail display, and digital product image. Do not assume all are needed.
- Existing product photography, dielines, label copy, packaging dimensions, material/finish specs, required symbols, and what is still provisional.

### Build a coherent packaging architecture

Record rules that make the line read as one family and each SKU easy to distinguish:

- **Shared anchors:** logo position and scale, product-name zone, information hierarchy, grid/margins, recurring graphic device, and common color/material behavior.
- **Variant coding:** the single approved way variants differ, such as an exact named color or label field. State which parts may vary and which must not.
- **Readability:** primary information order and legibility across the actual container size, secondary carton, shelf view, and e-commerce crop. Arabic and Latin copy must use the approved wording and proper script direction.
- **Material and finish:** only supplied or approved substrates, closure, printing, coating, emboss/deboss, foil, glass, or texture. Label visual concepts as unverified if manufacturability is unknown.
- **Mockup input plan:** exact logo image, product/packaging image or artwork, color-system board (if supplied), and identity file to attach. Assign a role to each reference so an image model does not treat a logo as a style sample or a moodboard as editable label artwork.

Do not invent SKU counts, shade names, ingredients, volume, directions, certifications, warnings, barcodes, regulatory text, or medical/clinical claims. Use approved exact copy or reserve a clean area for accurate typesetting. A rendered package is a visual concept, not proof that the package, label, claim, or regulatory information is production-ready.

### Beauty imagery and tone

Define image direction from the audience and product: subject range if people appear, styling, skin/hair/makeup treatment, product-to-person balance, lens/crop, lighting, surface, texture, and retouching level. Do not default to a narrow skin tone, gender, body type, regional aesthetic, botanical imagery, or sterile laboratory look. Confirm any people, location, cultural details, and product-use scene before making them fixed prompt instructions.

## Cross-system coherence check

Before marking the identity ready for downstream prompts, review the same decisions together:

- Does the mark remain recognizable at actual package, screen, and social sizes? Are light/dark and single-color versions supplied or still open?
- Do the exact palette roles work with the intended text, product material, and contrast needs? Keep HEX values exact; distinguish screen values from any production-matched color that has actually been approved.
- Do type styles cover every required script and hierarchy? Do not name a font as licensed or available unless verified; request a suitable licensed equivalent if necessary.
- Do graphic devices and imagery support the same positioning without repeating the logo everywhere?
- Can a customer identify the brand and understand product/variant hierarchy across the selected mockups at a glance?
- Do exact copy and claims match user-approved sources? Are all unknowns clearly open?
- Does each proposed prompt name the exact source files to attach and the role each file plays?

If a conflict appears, stop before downstream prompts, point out the conflicting decisions, and ask which approved direction should govern. Do not resolve it by silently changing the identity file.

## `brand identity.txt` system block

When the user approves a full identity and the file is absent, use this structure in the project root. Fill only supported values; keep the remaining lines marked `OPEN` or `PROPOSED`.

```text
BRAND SYSTEM — [brand name]
Status / last approved decisions:

1. STRATEGY
Offer and category:
Market and language(s)/script(s):
Primary audience and need:
Positioning and intended price/experience tier:
Promise and verified proof:
Differentiation:
Claims, associations, or competitor cues to avoid:

2. NAME AND VOICE
Exact name and spelling by script:
Pronunciation/meaning if user supplied:
Voice traits → observable writing behavior:
Approved copy/terminology:
Language, dialect, and words to avoid:

3. LOGO SYSTEM
Approved files and exact filenames:
Approved variants and when to use each:
Clear space, minimum size, backgrounds, and single-color behavior:
Do not alter:
Open logo decisions:

4. COLOR SYSTEM
Primary: #HEX — role and approved use
Secondary: #HEX — role and approved use
Accent: #HEX — role and approved use
Background/surface: #HEX — role and approved use
Text/contrast colors: #HEX — allowed pairings
Optional functional colors: #HEX — use (only if approved)
Approval/production status and source:

5. TYPE SYSTEM
Display / headline:
Body / product information:
Supporting labels / data:
Arabic and Latin pairing/script behavior:
Type hierarchy, spacing, and text direction:
Font availability/licensing status:

6. GRAPHIC AND IMAGE SYSTEM
Approved shape/pattern/icon/illustration behavior:
Layout/grid/spacing behavior:
Photography/imagery: subject, styling, lighting, crop, texture, retouching:
Signature behaviors beyond the logo:
Do not use:

7. PRODUCT / PACKAGING ARCHITECTURE (if relevant)
Confirmed products and variants:
Shared anchors across the family:
Approved variant-coding rule:
Primary/secondary package formats and dimensions:
Materials/finishes: approved vs visual concept only:
Exact approved label copy and source:
Open technical/regulatory/copy items:

8. APPLICATION RULES
Selected customer touchpoints:
What stays consistent:
What may vary and by what rule:
Accessibility, market, budget, and production constraints:

9. APPROVAL AND PROVENANCE
Locked decisions:
Proposed directions:
Open questions:
Supplied assets and reference sources:
Originality boundaries:
Approvals and date:
```
