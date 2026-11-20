---
name: brand-presentation
description: Writes a detailed, ready-to-paste coding-agent prompt for a standalone HTML brand presentation from approved assets. Build the HTML only when the user explicitly asks for the file.
argument-hint: "[brand-name] [project-folder]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Brand Presentation

Prepares a detailed prompt for a coding agent to assemble the approved brief and assets from `../brand-identity`, `../logo-prompting`, and `../mockup-prompting` into a polished, standalone HTML page. Prompt-only output is the default. Create the HTML yourself only when the user explicitly requests the file or directs this agent to execute the build prompt.

## When to Use

- User asks for a prompt to build a brand presentation or Behance-style case-study page
- User explicitly asks for the HTML file itself, or asks this agent to execute the build prompt
- An existing presentation needs a revision prompt or a direct, user-requested revision

## Workflow

1. **Interview and audit**: read `../shared-references/brand-intake-interview.md`. Inspect the locked brief, existing logo/variants, approved imagery, mockups, copy, and folder paths. Ask only missing or conflicting questions: desired presentation audience, included sections, available assets, target output path, and whether the user wants the build prompt or the actual HTML file. Confirm the input summary before drafting.
2. **Read** `references/reference.md`, `../shared-references/research-reference-standard.md`, `references/page-structure.md`, `references/visual-direction.md`, `references/technical-spec.md`, and `references/build-prompt.md` before producing the handoff.
3. If research is requested or useful to a stated decision, consult `../shared-references/brand-design-reference-library.md`, `../shared-references/arabic-brand-design-reference-library.md`, and `../shared-references/visual-analysis-workflow.md`. Borrow broad sequencing or touchpoint-proof methods, never an exact composition, distinctive graphics, or another brand's assets.
4. **Prompt-only default**: return a complete copy-ready coding-agent prompt with actual brief facts, approved asset paths, requested content map, layout and pacing direction, technical constraints, accessibility checks, responsiveness, and review checklist. Mark absent files/copy as open inputs; do not insert placeholder content. State whether the recipient should create the HTML or return an implementation plan.
5. **If the user explicitly asks for the HTML file**: use the same approved inputs and prompt structure to build one continuous responsive page. Use only actual approved brief values, copy, and assets; add descriptive alt text and meaningful headings. Keep mockups large enough to judge and maintain mobile reading order.
6. Preview the file at desktop and mobile widths only when a file is actually built. Check images, relative paths, font fallbacks, text overflow, contrast, and crop behavior. Fix the page in place; do not create v2/v3 copies unless the user asks for a comparison.

## Non-negotiables

- Single self-contained HTML file. No React, no Tailwind CDN, no build tooling.
- One continuous scroll, full-bleed sections, Behance-case-study feel, not a dashboard of boxed-in cards.
- Every color and typography value shown must match the brief's locked values exactly. The page must not drift from the brand source of truth.
- If a detail is missing (a color, a mockup, the brand name), ask before inventing a placeholder.
- Do not write a project claim, product feature, or tagline that is not in the approved brief or copy supplied by the user.
- Use real logo and mockup assets. Never ask CSS or an image model to approximate a logo that already exists as an approved file.
- Do not present guessed logo clear-space or minimum-size values as approved rules; use only measured or confirmed guideline values.
- An instruction to create a presentation prompt is not an instruction to create the HTML or generate images. Do the selected handoff only.
- If a presentation contains a real-world scene or person, ensure its country/region is in the approved brief. Do not invent one.
