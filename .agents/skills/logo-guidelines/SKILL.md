---
name: logo-guidelines
description: Builds a research-led logo direction brief before a new logo exists, or evidence-based usage guidelines for an approved logo. Activate this first in a no-logo branding workflow.
argument-hint: "[brand-name] [existing-logo: yes/no]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Guidelines

Create a practical, evidence-led rule set for a logo project. This skill has two distinct modes: **pre-design direction** when there is no approved logo, and **logo-use guidelines** when a real approved logo asset already exists. It does not draw or generate a logo. For a new logo, it prepares the decision framework that the user and `logo-design` will use next.

## When to use

- First logo stage in `lets-brand` when the brand has no approved logo.
- User asks for a logo direction guide, logo rules, or usage guidelines.
- User has an approved logo and wants a source-grounded usage system.

## Read before acting

1. Read `references/reference.md`, `../../shared-references/research-reference-standard.md`, and `../shared-references/brand-intake-interview.md`; inspect `brand identity.txt`, `prompts.md`, supplied logo files, guidelines, and relevant project assets.
2. Read `../shared-references/visual-analysis-workflow.md`, `../shared-references/logo-design-reference-library.md`, and `references/logo-guideline-structure.md`.
3. Use the research protocol in `references/logo-research-protocol.md` before offering a logo direction. For any new-logo project, inspect at least **five distinct, relevant project pages and their actual logo images**. Select a useful mix for the brand's category, market, script, and likely applications; the reference-library minimum is a research floor, not a reason to use irrelevant examples.

## Mode A — no approved logo yet

1. Confirm that the brand brief is approved and that no approved logo asset exists. If identity facts that affect the logo are unresolved—exact name/script, category, audience, geography, positioning, or palette—ask only those missing questions first. Never infer a palette or invent a factual story.
2. Search the direct project pages in the logo reference library. Follow the `agent-reach` skill for supported public reading and use an image-capable browser for the actual case images. Read its platform/login/rate-limit rules. Do not bypass a block or repeatedly retry a timeout. If a public source page exposes direct image assets and image retrieval is necessary, use only a permitted public asset for transient private inspection; do not commit, embed, redistribute, or treat it as the new brand's artwork.
3. Inspect the project images, not just a project title, summary, or search snippet. Log direct URL, creator/market where stated, project status (client, student, concept, or unclear), visual evidence, interpretation, transferable method, and a specific no-copy boundary. Keep observation separate from interpretation. Do not claim an unverified commercial outcome.
4. From the inspected set, distill a **Logo Direction Guidelines** section: the brand problem the mark must solve; a recommended design territory and rationale; permitted meaning/shape sources grounded in the brief; script and language behavior; silhouette/complexity expectations; exact approved palette roles and monochrome needs; small-size, contrast, and likely-use tests; forbidden clichés/associations; and unanswered decisions for the next interview.
5. Recommend a direction by abstract design principles only. Do not lift a reference's silhouette, distinctive geometry, letter construction, composition, palette, or signature device. Name one or two transferable methods at most and explain their relevance to this brand.
6. Present the short direction summary and ask the user to confirm or correct it. Then continue to `../logo-design/SKILL.md`, which asks the logo-specific questions before writing a concept prompt. Do not skip directly to a prompt.
7. When requested, store the direction, source table, and later approved logo prompt modules under `## Logo` in `prompts.md`, preserving existing approved content. Do not add an AI-generated post-design guideline board before an approved logo exists.

## Mode B — approved logo exists

1. Identify the exact supplied master file and approved variants. Ask which asset is authoritative if files conflict. Do not redraw or alter the logo while writing guidelines.
2. Inspect the actual artwork and available vector/source files. Separate confirmed geometry from assumptions. Only publish construction-grid, clear-space, minimum-size, color-value, or typography claims that are provided by the owner or can be measured reliably from the authoritative source file and then approved.
3. Define approved primary/secondary/compact/reversed/monochrome variants only when the assets or user approval support them. Test contrast and legibility on the brand's approved surfaces. Record unsuitable backgrounds and misuse examples without fabricating alternative logo art.
4. Use `references/logo-guideline-structure.md` to prepare a detailed prompt for a human-editable logo guidelines document/board. Image generators may help with presentation art, but must not invent measurements, redraw the mark, or replace exact technical typography with approximations.

## Deliverable contract

- Default output is a researched direction summary and/or copy-ready prompt module, not an image or designed PDF.
- In a full `lets-brand` run, put requested material in `prompts.md`; do not paste the prompt pack into chat.
- For direct one-stage requests, return the research/direction or prompt form the user asked for. Do not silently create a visual artifact.
- Include the exact supplied logo filename(s), brief file, approved spelling, palette hexes and roles, attachment instructions, intended contexts, exclusions, output format, and quality checks when writing a generation prompt.
- If the requested source images could not be inspected, state the exact limitation, identify inaccessible pages, keep recommendations provisional, and add this exact note to `prompts.md`:

  `NOTE: Use the Agent Reach skill to access and visually inspect the reference URLs before finalizing these prompts.`

## Hard rules

- A **pre-design direction guide** is not a usage manual. Never state clear-space, minimum size, construction grid, or approved logo variants for a logo that does not exist.
- A **post-design usage guide** must be tied to the actual approved source file. Never ask an image model to fabricate technical rules or redraw the supplied logo.
- Use exact approved color values. Mark all unapproved colors as open questions.
- Preserve the user's Arabic/Latin spelling, directionality, and script hierarchy exactly.
- Keep facts, source observations, interpretation, and recommendations visibly distinct.
- References teach transferable design methods; they are not instructions to recreate another project.
- Do not write a concept prompt from this skill. The user must approve the direction and complete the `logo-design` interview first.
