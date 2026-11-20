# Reference Instructions — `brand-identity`

Read this file, `../../shared-references/research-reference-standard.md`, and `../../shared-references/subagent-collaboration-protocol.md` before identity work. Then read the existing identity questionnaire, identity-system framework, and brief-authoring prompt named in `SKILL.md`. This skill translates strategy into identity; a direct identity-only request can run without `lets-brand`.

**Approval gate:** First audit the supplied brief/assets read-only. Ask at most 3–6 missing strategic questions; wait for the user's confirmation of the facts, identity scope, and research direction before searching project-specific references or writing/updating `brand identity.txt`. Reuse confirmed answers and don't spend questions on easy execution details.

## Interview for strategic pivots

Audit `brand strategy.md`, `brand identity.txt`, supplied assets, and approvals first. If an approved strategy exists, reuse its offer, audience, differentiation, promise, proof, and trade-offs. Ask only missing identity decisions: desired tier/customer impression, refresh constraints, approved palette status, typography/script needs, logo status, supporting graphics/imagery, and required touchpoints. If the user asks for identity alone without a strategy file, ask only the minimum strategic facts needed to avoid arbitrary design; route deeper positioning or architecture work to `../../brand-strategy/SKILL.md`. Keep execution details out of the interview and translate design jargon into simple options.

Before writing, confirm: **who the brand serves, what it provides, why it is meaningfully different, where it competes, what is fact vs aspiration, and which visual decisions are approved versus open.** If the user rejects a proposed route, record why and exclude it from future prompts.

## Research and image analysis

Inspect at least five distinct real brands/projects in the closest category and target market, plus one contrasting case if that helps test differentiation. Use direct source pages, official identity materials, credited studio case studies, and the shared global/Arabic libraries. For each actual image, examine how the stated positioning relates to the mark, palette roles, typography/script, photography, supporting graphics, layouts, materials, and touchpoints. Don't infer strategy from aesthetics alone; record the source's own stated brief separately from your interpretation.

When the source gives accessible exact colors, record them as source metadata—not as candidate brand colors. If color is sampled from pixels, label it approximate and never copy it into the user's locked palette. Use examples to learn systems such as primary/accent/neutral contrast, bilingual hierarchy, product-family coding, or material tone. Do not copy a competitor's specific mark, colors, typeface, imagery, or positioning.

## Decision routes

- **No identity file, approved strategy exists** → use the strategy as source of truth, interview for missing design-system choices, then create `brand identity.txt` only after user approval.
- **Full new brand but no approved strategy** → route to `../../brand-strategy/SKILL.md` before finalizing the identity.
- **Identity-only request, no strategy file** → proceed independently with minimum context; mark strategic uncertainties provisional rather than forcing a full strategy project.
- **Existing approved identity file** → preserve it; ask only about contradictory or newly requested changes.
- **Brand facts or claims unresolved** → ask before using them in logo/story/campaign prompts.
- **Palette missing** → present 2–3 palette directions as proposals with role logic; do not call them approved until selected. Route final color roles back into the identity file.
- **No logo** → after identity lock, route to `../../logo-guidelines/SKILL.md` then `../../logo-design/SKILL.md` or `../../logo-text/SKILL.md`.
- **Logo usage, variants, or pattern requested** → route to logo specialist; don't fabricate measurements or derive components without approval.
- **Product/e-commerce brand** → document confirmed SKUs, variants, packaging structure, and facts; do not invent ingredients, benefits, package copy, or regulatory language.
- **Need only one downstream module** → hand the same approved facts to that skill; do not run the complete pipeline unless requested.

## Build the source-of-truth file

For every field, mark it **approved**, **proposal**, **unknown**, or **not applicable**. Record exact approved brand spellings by script; market/audience; offer; differentiators and proof; story; prohibited claims; tone; exact HEX with roles; typography and script behavior; logo status/files; graphics and image behavior; real applications; must-keep/must-avoid; and source links. Never turn an observation or design recommendation into a brand fact without user approval.

The identity file should be concise enough for agents and image tools to use, but specific enough that every downstream decision can be traced back to the brief. If existing text conflicts with user-approved files, show the conflict and ask; don't silently normalize or replace the file.
