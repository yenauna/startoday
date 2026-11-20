# Identity Questionnaire

## Why this step can't be skipped

Every prompt written in `logo-prompting`, `mockup-prompting`, `brand-presentation`, and `banner-design` describes the brand in words. If those words are vague ("make it nice", "modern colors"), the AI tool fills the gaps with whatever is statistically common in its training data — which is almost never what the specific brand needs, and never consistent from one generation to the next. A locked brief turns every later prompt into a precise, repeatable spec instead of a fresh guess each time.

## The required fields

Ask for these, in this order. Skip a field only if the user has clearly already given it earlier in the conversation.

1. **Name** — exact spelling, script (Arabic/English/both), and whether it has a meaning worth reflecting visually (e.g. "ملح وسكر" literally means "salt and sugar" — that became the logo concept itself).
2. **Industry / what it actually sells or does** — be specific. "Food business" is not enough; "small neighborhood grocery store" vs "specialty coffee roaster" vs "food delivery app" lead to completely different everything.
3. **Target audience** — who buys from it, where they are, what matters to them (price, status, convenience, trust, novelty). "Families in a residential area" and "young professionals downtown" need different personalities even for the same industry.
4. **Geography / market** — country and, if it matters, city tier (upscale neighborhood vs working-class area vs rural). This single detail prevents the most common AI-generation failure: scenes, architecture, or people that read as the wrong country.
5. **Personality** — see `personality-archetypes.md`. Get one or two archetype words plus one plain-language gut-check sentence ("if this brand was a person, it would be ___").
6. **Customer promise and proof** — what changes for the customer, and what real product, service, expertise, process, or experience supports that claim? Do not write unsupported marketing claims.
7. **Differentiation and reference brands** — what should feel familiar within the category, and what should be distinct? If the user requests a visual scan, log credited examples using `../../shared-references/visual-analysis-workflow.md` and discuss methods, not copied assets.
8. **Touchpoints and constraints** — where customers meet the brand, language and script needs, accessibility requirements, production/budget limits, existing assets, regulatory boundaries, and any fixed colors or fonts.
9. **System completeness** — which logo versions, graphic assets, packaging or product rules, image behavior, voice behavior, and application rules already exist? Which does the user expect this identity to establish? Ask for exact asset filenames and approval status.
10. **Tier and experience** — what price/experience tier is intended, and what should make the audience perceive that value? Ask for a concrete desired customer impression; do not equate “premium” with a preset palette or style.

## Cosmetics and beauty follow-up

Use only for beauty/cosmetics projects, and ask only what is in scope:

- Which category is this: skincare, makeup, haircare, fragrance, body care, or another specific offer?
- Which exact products are confirmed, and what is the hero product? What variants, sizes, shades, or scents are approved?
- What is the approved variant-coding rule, or is it still open?
- What customer need, verified product proof, and market/price tier should the design communicate?
- What package formats, product photographs, label artwork, dimensions, materials, finishes, copy, or dielines already exist?
- Which claims, ingredients, origin, clinical/testing language, certifications, warnings, or regulatory content have approved source copy? Which must remain blank/open?
- Which touchpoints matter: primary pack, carton, set, shipping, shelf/display, product listing, or campaign? Do not assume every format is required.

Do not fill a missing product detail with a beauty-category convention. Mark unknowns as open; identity and mockup prompts must not invent SKUs, shade names, ingredients, efficacy, safety, or regulatory copy.

## What NOT to ask

Don't interrogate the user with a rigid form if they've already volunteered most of it in free text — extract it, confirm it back, and ask only for genuine gaps that affect the design. A brief that takes ten questions to assemble when three would do is its own failure mode. If the user is in a hurry, offer a compact set of specific choices rather than guessing.

## Output shape

Always end this step with the confirmed brief and system fields from `SKILL.md` and `identity-system-framework.md`. Mark details as locked, proposed, or open; only locked details may be used as facts in downstream prompts. For a full identity, preserve the approved system in `brand identity.txt` so every later skill has one consistent source of truth.

## Compact intake wording

“I have [facts already provided]. To lock a usable brand brief, I still need: [only missing critical details]. You can answer briefly or choose one of these routes: [clear options]. I will mark any unconfirmed detail as open and won't use it as a fixed design instruction.”

## Direction review before the lock

When references are part of the request, compare examples on audience fit, central idea, system behavior, real touchpoints, legibility, and evidence quality. Select no more than two transferable principles and explain how they support this brief. Log direct URLs and one “do not copy” note for each. Reference research should help define differentiation, not replace customer/audience knowledge.
