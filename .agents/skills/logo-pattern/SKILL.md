---
name: logo-pattern
description: Develops a repeatable brand pattern from an approved logo's real geometry and writes a controlled image-generation prompt. Activate after the logo has been approved.
argument-hint: "[brand-name] [pattern-use]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Pattern

Extend an approved logo into a secondary repeat graphic without damaging the primary mark or inventing unrelated decoration. This skill writes a prompt/system specification; it does not generate the pattern image unless explicitly asked.

## When to use

- The user wants a repeating brand pattern based on an approved logo or mark.
- A brand needs a logo-derived surface graphic for confirmed packaging, stationery, social backgrounds, textiles, or environments.

If no approved logo or vector/master asset exists, pause and route to `../logo-design/SKILL.md` or `../logo-text/SKILL.md`. Do not design an unrelated pattern as a substitute.

## Read before acting

Read `references/reference.md` and `../shared-references/research-reference-standard.md`; inspect the approved `brand identity.txt`, the actual logo master, its usage constraints, palette, previous approvals, and the intended material/application. Then read `references/logo-pattern-system.md`, `../logo-guidelines/references/logo-guideline-structure.md`, `../shared-references/logo-design-reference-library.md`, and `../shared-references/visual-analysis-workflow.md`. If the logo's source geometry is unclear, ask for the vector or a reliable high-resolution master.

## Workflow

1. **Audit the source mark.** Identify its approved geometry, visual components, stroke weights, counters, orientation, and parts that cannot be separated or altered. Record the exact filename and format.
2. **Interview for application decisions.** Reuse known facts; ask only missing details that change the repeat, including pattern purpose/surface, scale, density, visible direction, material/print method, background, and approved palette roles. Confirm whether the pattern is subtle texture or a prominent graphic.
3. **Research pattern systems.** Open at least five distinct project pages that show logo-derived patterns or documented brand repeats. Inspect the actual pattern images using Agent Reach plus an image-capable browser/viewer. Record what is visible, the likely construction method, and a no-copy boundary. If the same projects were already visually inspected for `logo-guidelines`, reuse them only when their pattern pages were actually seen; add relevant projects until there are five pattern examples.
4. **Choose a derivation method** in `references/logo-pattern-system.md`: whole-mark repeat, approved subshape, negative-space extraction, modular crop, or line/outline derivative. Use a method only if it preserves recognition and is approved by the owner.
5. **Define a controlled system.** State repeat tile, spacing, orientation, scale range, density, rotation/mirror rules, color variants, clipping behavior, quiet zones around primary logo/text, seamless-edge requirements, and output dimensions. Keep the approved logo itself unchanged.
6. **Create two prompts only when useful:** (a) a flat seamless pattern swatch for testing, and (b) a clearly labeled application/mockup prompt using a named surface. Do not let the model redraw the logo or fabricate real-world copy.
7. **Review outputs** for seam continuity, repeated-mark legibility, visual noise, contrast, line weight, scale, mark distortion, and trademark/recognition dilution. Correct one variable per iteration.
8. **Save** under `## Logo Pattern` in `prompts.md` during a full pack, preserving other approved content. Attach the exact approved vector/master and exact palette board, and specify their roles. If fewer than five actual pattern images were accessible, keep the pattern prompt provisional, list the blocked URLs, and include the exact Agent Reach note required by the shared workflow.

## Hard rules

- The pattern is subordinate to the primary logo and must never replace it.
- Derive components from the approved mark only. Never invent a new icon family, merge multiple references, or trace a competitor's motif.
- Do not distort, recolor, rotate, mirror, crop, separate, or repeat the complete logo if the usage rules prohibit that treatment.
- Use exact approved color hexes and roles. Do not create extra colors, gradients, opacities, tints, or reversed variants unless authorized.
- State whether Arabic lettering may be abstracted into pattern pieces. If meaning or legibility could change, preserve the full approved wordmark as a unit.
- Ask which brand name, tagline, or packaging text is approved. If the generator may misspell it, reserve clean space for manual typesetting.
- A generated tile is a visual concept; confirm vector repeat, seam accuracy, overprint, bleed, and production limits in the target design/print tool.
- Do not create an image or write a file unless requested.
