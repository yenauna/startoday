---
name: lets-brand
description: Orchestrates an interview-first brand strategy and identity workflow through selected specialist skills, then saves approved strategy and requested prompts. Use for a full new brand or repositioning; invoke a specialist directly for one stage.
argument-hint: "[brand-name] [industry] [notes]"
metadata:
  author: mostafa
  version: "1.1.0"
---

# Lets Brand — Research-Led Branding Workflow

Run the project through an intake interview, an approved brand strategy, identity, selected specialist work, and file-based delivery. This skill coordinates the sibling skills; it does not generate images or execute HTML unless the user explicitly asks for those artifacts. The specialist skills also work independently when the user invokes them directly.

## Output Contract

- When the user says “Let's brand,” do not answer with prompt text, a prompt preview, or a long design analysis in chat. Begin the interview and ask only decision-critical questions.
- Show a concise brand-lock summary in chat and wait for the user's approval before writing deliverables.
- For a complete new brand or repositioning, create `brand strategy.md` only when absent, then create `brand identity.txt` only when absent, and create or update `prompts.md` with the requested prompt pack. Preserve existing approved files; update only after approval.
- Do not paste the contents of `prompts.md` into chat. After writing, give only a short completion note with the file paths and any real access limitation.
- If `brand strategy.md` or `brand identity.txt` already exists, read and use it; do not create a duplicate or overwrite it. If either conflicts with supplied assets or the user's latest direction, ask before changing it.

## When to Use

- User says “Let's brand [name]” / “ابدأ مشروع براندينج”
- A new client or practice branding project is starting
- User wants the complete brand prompt pack or wants to resume an existing project

## Workflow

### 1. Audit the project before asking questions

Read `references/reference.md`, `../shared-references/research-reference-standard.md`, `../shared-references/subagent-collaboration-protocol.md`, and `../shared-references/brand-intake-interview.md`. Inspect the project root and relevant asset folders for:

- `brand strategy.md`, if present
- `brand identity.txt` and `prompts.md`
- Approved logo files and variants
- Existing brand guidelines, palette/type specifications, approved copy, products, mockups, and prior approvals
- Existing reference links and notes

If `brand strategy.md` exists, treat approved strategic decisions as the source for positioning and business choices. If `brand identity.txt` exists, preserve its approved visual and verbal system. Never create duplicates. Keep candidate and unresolved details clearly marked.

### 2. Interview and lock the brief

Reuse confirmed information and ask only missing or conflicting questions. Cover the business objective, brand strategy status, brand name and exact scripts, offer, market and audience, story and factual claims, personality, differentiation, approved colors, typography direction, logo assets, channels, touchpoints, deliverables, target tools, and output ratios. Ask which modules the user wants, including strategy, a brand decision review, or an audit only when relevant. Do not write or show prompt content during the interview.

Confirm a compact brand-lock summary in chat. Do not proceed to file output until the user approves it. Do not reopen settled decisions without a conflict or a direct request.

### 3. Delegate selected work and run the review round

After the scope and brief are approved, act as the main agent and follow `../shared-references/subagent-collaboration-protocol.md`. Create one specialist subagent per selected skill module—never for unselected work. Each specialist reads its own `SKILL.md` and `references/reference.md`, then returns its findings, draft, sources, assumptions, gaps, and handoff to the main agent. Keep stage dependencies sequential and parallelize only independent research/review.

Run one evidence-based debate round for every material recommendation: the specialist proposes with evidence, the main agent challenges fit and constraints, and the specialist responds or revises. The main agent resolves the result against the approved brief and owns project files and user approvals. If the host lacks subagent support, use the protocol's independent-review fallback and do not claim delegation occurred.

### 4. Build or update `brand strategy.md` when relevant

For a full new-brand or repositioning workflow, run `../brand-strategy/SKILL.md` before `brand-identity` if the strategy is absent or changing. Use an existing approved strategy as the baseline and do not repeat settled research. Create `brand strategy.md` only after approval and only when absent; preserve existing strategy content unless the user approves a specific change. Keep positioning, audience, value, proof, pillars, trade-offs, and architecture distinct from the visual specifications in `brand identity.txt`.

For an existing brand, run `../brand-audit/SKILL.md` only when the user requests a broad diagnosis. Use `../brand-compass/SKILL.md` for a single strategy-based do/don't decision. Neither is an automatic phase in every new-brand project.

### 5. Create `brand identity.txt` only when absent

When the full workflow is requested and no `brand identity.txt` exists, create it in the project root after strategy and identity scope approval. Reuse the approved strategic handoff from `brand strategy.md` where present. Include:

- Exact brand name and approved spelling in every script
- Offer, category, market, audience, and language/dialect
- Story, promise, proof, differentiators, and claims that must not be made
- Personality and voice
- Color palette with exact hex values, named roles, and approval status
- Typography hierarchy and bilingual/script behavior
- Logo system: exact files, variants, hierarchy, clear-space/background or fidelity constraints when known
- Graphic/layout system: approved devices, shapes, pattern/icon/illustration behavior, grid, spacing, and what stays consistent across applications
- Image system: subject/styling, composition, lighting, texture, editing, and boundaries grounded in the brief
- Voice system: voice behavior, approved terminology/copy, language/script, and phrases/claims to avoid
- Application rules for approved touchpoints; for product brands, confirmed products/variants, shared packaging anchors, approved variant-coding rule, formats, supplied artwork, and open material/production decisions
- Must-keep, must-avoid, and unresolved decisions
- Reference credits or source links that materially informed the brief

Read `../brand-identity/references/identity-system-framework.md` when shaping the brief and applying product/beauty-specific questions. Treat “premium” as the user's intended price/experience tier translated into approved visual behavior; never fill gaps with a default luxury style. Do not invent products, packaging copy, ingredients, benefits, safety, testing, or regulatory details.

If approved colors are missing, ask the user to provide or approve them. Do not treat proposals as locked. Every image prompt must use the approved hex values from this file.

### 6. Run the logo sequence when no approved logo exists

If the brief has no approved logo file, do not skip straight to a concept prompt:

1. Read `../logo-guidelines/SKILL.md`. Run its **pre-design direction** mode first: select at least five relevant, distinct logo projects, open the direct pages, and visually inspect the actual logo/guideline images. Include Arabic-script work where the brand needs Arabic or bilingual lettering.
2. Summarize evidence-based Logo Direction Guidelines for the user: one recommended logo route and rationale, concrete meaning anchors, form/script behavior, approved colors, use/scale tests, and avoidances. Keep observations separate from interpretation, and wait for the user to confirm this direction before moving forward.
3. Then read `../logo-design/SKILL.md` and ask at least five or six unanswered logo-specific questions from its interview reference. Reuse locked identity facts and the research the user has already reviewed; do not repeat generic intake questions.
4. Confirm the selected route and exact text. If the user wants a text-only mark, route to `../logo-text/SKILL.md`; otherwise prepare one focused logo-concept prompt with `logo-design`.
5. Treat `logo-colors` and `logo-pattern` as separate optional modules. Color variants use only the approved palette; a logo-derived pattern requires an approved logo asset and its usage constraints.
6. Ask for approval at each stage. Do not silently chain direction → concept → color/pattern prompts. Add only the modules the user selected to `prompts.md`.

If an approved logo already exists, skip new-concept research unless the user asks for a redesign. Use `logo-guidelines` in post-design mode for actual usage rules, based on the authoritative file. Do not invent construction grids, clear space, minimum size, or variants.

### 7. Research real reference pages before writing prompts

For every full branding pack that includes mockups, complete a reference scan before drafting `prompts.md`:

- Review at least **five distinct global references** from `../shared-references/brand-design-reference-library.md` and at least **five distinct Arabic-market references** from `../shared-references/arabic-brand-design-reference-library.md` — ten distinct projects total.
- Select projects relevant to the confirmed sector, touchpoints, and market. For Arabic references, prefer the user's target country and audience when the library permits.
- Open each direct source URL. Inspect the actual identity/mockup images, not only the library description, search snippet, thumbnail, or page title. A reference counts toward the minimum only when the relevant visuals were accessible and inspected.
- Activate and follow the `agent-reach` skill for access to source pages when available. Follow its routing and stop rules; do not bypass logins, access controls, rate limits, or platform blocks. Use an image-capable browser when the page text alone cannot reveal the visual details.
- Record the source URL, project/context, what was visibly observed, which touchpoint it informs, a transferable method, and what must not be copied. Separate observation from interpretation.

For logo concept, wordmark, guideline, color, or pattern prompts, also complete the logo-specific scan in `../logo-guidelines/references/logo-research-protocol.md` or the selected sibling skill. Select at least five relevant logo projects from `../shared-references/logo-design-reference-library.md`, open their direct pages, and inspect their actual logo images. Count only visually inspected project pages; image-search captions, snippets, and reference-library notes are discovery aids only.

If a link is unavailable, try another relevant entry from the same library without bypassing blocks or retrying repeatedly. If any applicable visual-inspection minimum remains unmet, do not claim it was met. Add this exact note to `prompts.md` and leave affected visual decisions provisional:

> NOTE: Use the Agent Reach skill to access and visually inspect the reference URLs before finalizing these prompts.

Also state which links could not be inspected and why, without repeatedly retrying blocked or rate-limited sources.

### 8. Assemble `prompts.md`

Read `../shared-references/brand-prompt-pack-template.md` and invoke the relevant sibling skills. Save the complete requested prompt set as `prompts.md` in the project root. If it already exists, preserve prior approved content and update only the requested sections; do not erase useful prompt history without asking.

Include:

1. A short input lock referencing `brand strategy.md` when present, `brand identity.txt`, and the exact files the user must attach.
2. A reference review table for every selected research track: at least 5 distinct logo projects for new-logo work, and at least 5 global + 5 Arabic projects when mockups are requested. Include direct links, visual observations, transferable lessons, originality boundaries, and the exact Agent Reach note when an applicable inspection threshold is not met.
3. One detailed, ready-to-paste prompt per requested deliverable: logo concept/refinement, text-only wordmark, logo color study, logo-derived pattern, mockups, posters/banners, story-led visuals, visual or written guidelines, and HTML presentation as selected. Include the approved Logo Direction Guidelines/research record when a new logo was requested.
4. Exact approved hex colors, exact approved copy/spelling, composition, output size/ratio, exclusions, quality checks, unresolved inputs, and the exact filenames/role of every supplied asset to attach for each relevant prompt. For mockups, explicitly instruct the image tool to use the uploaded approved logo as its logo reference and the supplied palette/design-system board as its visual-system reference; include exact HEX values in text as well.

Include only the requested or brief-relevant modules. Do not copy recognizable logos, palettes, typefaces, layouts, illustrations, or signature devices from references. Never invent missing details.

### 9. Close out without returning prompt text in chat

Confirm that `brand strategy.md` and `brand identity.txt` were created only when required and otherwise preserved, and that `prompts.md` contains the approved prompt pack when requested. Do not claim visual research was complete if any reference images could not be viewed. Reply with a concise status and paths only; keep prompt contents inside the file.

## Running One Stage Only

When a user asks for one stage, activate that sibling skill directly. For a new logo with no approved mark, start with `../logo-guidelines/SKILL.md`; after direction approval, continue to `../logo-design/SKILL.md` or `../logo-text/SKILL.md`. For mockup prompts, follow the same approved-brief, file-output, and visual-reference requirements in `../mockup-prompting/SKILL.md`. A direct request to create an image or HTML artifact applies only to that selected deliverable and does not authorize other stages.
