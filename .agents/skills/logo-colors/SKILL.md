---
name: logo-colors
description: Defines approved logo color variants and exact-color prompt instructions from the locked brand palette. Activate when preparing color studies or logo applications.
argument-hint: "[brand-name] [approved-palette-file]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Colors

Translate the approved brand palette into a usable logo color system. This skill does not invent a palette or automatically modify a logo; it specifies and prompts only for variants that the brand owner approves.

## When to use

- The user wants color decisions for a new logo after identity approval.
- The user wants to evaluate an approved logo against its palette and backgrounds.
- The user needs color, monochrome, reverse, or application variants documented.

For a new palette, use `../brand-identity/SKILL.md` first. For a logo concept, use `../logo-design/SKILL.md` and return here for a color study. For actual usage rules, also use `../logo-guidelines/SKILL.md`.

## Read before acting

Read `references/reference.md` and `../shared-references/research-reference-standard.md`; inspect `brand identity.txt`, the actual approved logo/vector (if it exists), color approval status, exact color roles, intended backgrounds, `references/logo-color-variants.md`, and `../logo-guidelines/references/logo-guideline-structure.md`. Inspect supplied files rather than trusting filenames.

## Workflow

1. **Audit palette status.** Collect exact HEX values and named roles from the locked identity. If values are absent, approximate only, contradictory, or unapproved, stop and ask the user to approve a palette through the identity workflow. Never sample a reference brand and call it this brand's palette.
2. **Audit logo status.** If a real logo exists, identify the exact master and variants. If it is a new concept, label color work as a concept study and use only palette values already approved for the identity.
3. **Interview for missing behavior.** Ask whether the user needs full-color, one-color, reversed, limited-ink, background-specific, or accessibility variants. Ask which surfaces/backgrounds and output use matter. Avoid asking questions already answered in the brief.
4. **Research color behavior.** Review at least five distinct relevant logo/guideline projects where actual palette/variant pages are visible. Record how color roles, backgrounds, and contrast are presented; do not copy values or imply that a reference's palette is appropriate for this brand. Reuse inspected projects from `logo-guidelines` only when their color pages were actually viewed.
5. **Map color roles.** For each approved variant, state logo element → exact color → role; permitted background → exact color → role; contrast/readability check; and whether the version is approved or exploratory.
6. **Separate exact color from appearance.** Explain that RGB/HEX on screen does not guarantee printed color. If print is requested, record the print process, profile, and owner/printer-approved CMYK/Pantone data; do not fabricate conversions as final production specs.
7. **Write the prompt/specification.** Use `references/logo-color-variants.md`. Attach the exact logo and palette file. Tell an image tool to preserve the supplied logo as an immutable reference; if it cannot, leave a placement area for manual compositing instead of regenerating the logo.
8. **Check variants** on the actual approved background(s), at small size, in grayscale/one-color, and against contrast needs. Reject a variant if the mark becomes unreadable or if it needs an unapproved color.
9. **Save** requested content in `## Logo Colors` within `prompts.md`; preserve other approved sections. If fewer than five relevant pages or their color images were accessible, keep the affected prompt provisional and add the exact Agent Reach note from the shared workflow.

## Hard rules

- Every color is exact HEX plus role; no vague color words as a substitute.
- Unapproved colors, gradients, opacity, tints, shadows, metallic finishes, and background fields remain open decisions.
- Do not infer that a black or white logo variant is approved. Ask the owner or clearly label it a proposed variant for approval.
- Never recolor a supplied master inside an image generator and present the result as accurate brand artwork. Use vector editing/compositing for exact assets.
- Distinguish color contrast testing from accessibility certification and print color proofing.
- Do not create images or write files without an explicit request.
