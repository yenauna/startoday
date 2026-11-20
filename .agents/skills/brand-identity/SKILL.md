---
name: brand-identity
description: Translates an approved brand strategy into a coherent visual and verbal identity system, including exact palette roles, typography, logo constraints, graphics, imagery, and applications. Works independently or after brand-strategy.
argument-hint: "[brand-name] [industry]"
metadata:
  author: mostafa
  version: "1.1.0"
---

# Brand Identity — Translate Strategy into a Design System

This skill translates the approved strategic foundation into a usable design system and an identity source file. It can be invoked independently; in a full new-brand workflow, `brand-strategy` establishes the positioning first. Read `references/reference.md`, `../shared-references/research-reference-standard.md`, `../shared-references/brand-intake-interview.md`, `references/identity-questionnaire.md`, `references/personality-archetypes.md`, `references/brief-authoring-prompt.md`, and `references/identity-system-framework.md` before drafting.

## When to Use

- At the start of a new branding project
- When a brand identity file is missing and the user starts a full branding workflow
- When an existing logo or brief must be reconciled before writing downstream prompts
- When an approved brand strategy needs a visual/verbal identity translation

## Workflow

### 1. Audit before interviewing

Inspect the project root and relevant asset folders. Look specifically for `brand strategy.md`, `brand identity.txt`, `prompts.md`, logo variants, current guidelines, palette/type specifications, approved copy, product imagery, mockups, and previous approvals.

- If `brand identity.txt` exists, read it and reuse it as the current source of truth. Do **not** create a duplicate, rename it, or overwrite it.
- If `brand strategy.md` exists, use its approved positioning, audience, promise, proof, and trade-offs as strategic constraints. Do not silently re-position the brand inside this identity skill.
- If either file conflicts with newer user instructions or approved assets, show the conflict and ask which approved source should govern.
- If it does not exist, continue the interview and create it only after the user approves the brief summary.
- Do not infer that a file is approved just because it exists; verify its status from its contents or ask.

### 2. Interview for decision-critical facts

Use `../shared-references/brand-intake-interview.md` and `references/identity-questionnaire.md`. Reuse facts already supplied and ask only about missing or conflicting decisions:

- Exact brand name and approved spelling in Arabic, Latin, or other scripts
- Offer, category, differentiators, proof, and prohibited or unverified claims
- Market, country/city, audience, language and dialect
- Brand story and which details are factual versus aspirational
- Personality, voice, positioning, and desired customer impression
- Logo files and variants, what must remain unchanged, and usage needs
- Approved colors and their roles; typography and script needs
- The intended price/experience tier and what “premium” should mean to this audience; translate it into observable design behavior rather than defaulting to black, gold, or luxury clichés
- The connected brand system needed across selected touchpoints: logo variants, palette roles, type hierarchy, supporting graphics, image direction, layout behavior, voice, and application rules
- For product brands, the approved product/variant architecture, packaging formats, and supplied product imagery or artwork
- Image direction, touchpoints, channels, production constraints, and selected deliverables

Do not ask the user to repeat known facts. Do not return prompts during this interview.

If `brand strategy.md` is approved, treat its core strategic choices as settled and ask only for missing identity decisions. If strategy is absent and this is a full new-brand workflow, route to `../brand-strategy/SKILL.md`; if the user explicitly wants identity alone, gather only the minimum strategic context needed and label unresolved positioning as provisional rather than forcing the full strategy skill.

### 3. Lock the color palette explicitly

Colors are required in `brand identity.txt` and every later image prompt. If the user provided approved colors, preserve their exact hex values and roles. If colors are missing:

1. Ask whether the user wants to supply colors or review a small set of proposals.
2. If requested, prepare three or four distinct options with exact hex values, palette roles, contrast considerations, and a brief rationale.
3. Keep all options marked **proposed** until the user selects or edits them.
4. Do not write image prompts or mark the palette locked before approval.

Never choose colors from a national, regional, industry, or personality stereotype.

### 4. Confirm the identity summary

Show the user a concise summary and wait for approval before creating or changing the file:

```text
Brand name and exact scripts:
Offer and category:
Market and priority audience:
Positioning, intended tier, promise/proof, and differentiation:
Approved story, voice, and claims to avoid:
Locked palette: #HEX (role), #HEX (role), ...
Typography and script hierarchy:
Logo/assets and constraints:
Graphic, image, and layout system:
Selected products/variants and touchpoints:
Must-keep / must-avoid:
Open questions:
```

If the existing identity file is already approved and no decision has changed, do not force a redundant approval round; summarize what is known and ask only about the new or conflicting details.

### 5. Create the identity file only if it is absent

For a full branding run, create `brand identity.txt` in the project root after approval, but only if no such file exists. Use plain text with clear section headings and include:

1. Brand name and exact script spellings
2. Business offer, category, market, target audience, and intended price/experience tier
3. Brand story, customer promise, proof, differentiators, and claims to avoid
4. Positioning, personality, and voice direction
5. **Color palette:** exact hex, role (primary/secondary/accent/background/text), approval state, and approved usage notes
6. Typography hierarchy and bilingual/script behavior
7. Logo system: approved assets and variants, hierarchy, clear space, background behavior, and fidelity constraints when known
8. Graphic system: approved motifs, shapes, patterns, icon/illustration behavior, and layout/grid principles
9. Image system: subject/styling, composition, lighting, texture, editing, and boundaries grounded in the brief
10. Voice system: voice traits, language/script behavior, approved vocabulary/copy, and claims or phrases to avoid
11. Application system: how the identity carries across selected packaging, digital, social, retail, or service touchpoints; what stays consistent and what may vary
12. Product/variant architecture, materials, accessibility and production limits, must-keep/must-avoid rules, open decisions, approvals, and source notes as relevant

For cosmetics and other product brands, apply the relevant checks in `references/identity-system-framework.md`: connect confirmed products into a coherent SKU and packaging hierarchy; define the rules shared by primary and secondary packaging; and keep claims, ingredient details, variants, and regulatory copy user-supplied or explicitly open. “Premium” does not authorize adding gold, black, glass, metallic finishes, or other luxury cues without approval.

Do not treat the identity as complete until the approved choices form a usable system for the selected touchpoints. Resolve material contradictions or mark them open before downstream prompts.

Use only user-approved facts as locked values. Mark recommendations as proposed and open questions as unresolved. If the file already exists, leave it intact and do not create a second copy. If the user wants a change, update the existing file only after asking and receiving approval.

## Rules

- Never silently invent colors, audience, proof claims, market, personality, typography, or story facts.
- Ask for country/region when geography changes the identity or a later real-world image prompt.
- Do not imitate a competitor or reference. Record an originality boundary when references informed the direction.
- Keep functional requirements with the identity: language/script, accessibility, environments, touchpoints, materials, and production constraints.
- Treat the identity as one connected design system, not a collection of unrelated attractive directions. Before downstream prompts, check that logo, colors, type, graphic devices, imagery, voice, and applications reinforce the same approved positioning.
- Give later image prompts exact source asset names and the role of each attachment. If a required logo or design-system reference is missing, identify the gap and ask; never silently substitute a generic logo, palette, or style.
- The interview comes before prompt output even when the user says “make it better.”
- For the full `Let's brand` workflow, save approved identity in `brand identity.txt`; save all prompt modules in `prompts.md`. Do not paste the prompt pack into chat.
