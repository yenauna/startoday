# Color Palette Management

Document the palette that has been approved in `../brand-identity`. This file explains how to describe, check, and use that palette; it does not provide colors to copy into a brand.

## Palette record

For every approved swatch, record:

| Field | What to record |
|---|---|
| Name | A useful, non-ambiguous name approved by the owner |
| Exact value | Hex copied from the locked brief; do not round or infer |
| Role | Primary, secondary, accent, background, ink, or a role defined by the brand |
| Intended use | Surfaces, text, marks, packaging, digital elements, or print context |
| Pairings | Approved foreground/background combinations |
| Status/source | Approved, recommended, or open; link to the source file |

Do not add light/dark tints, semantic status colors, or extra neutrals to fill out a table unless they are approved. If an output needs a missing role, ask the owner or record a clearly labeled recommendation.

## Usage guidance

- Use palette roles consistently but do not impose a universal 60/30/10 ratio. Let the brief, application, and layout determine proportions.
- A neutral production material may have its own color; document it as a material choice and do not silently promote it to a brand color.
- For AI image-generation prompts, use the exact approved hex codes for all brand-colored surfaces and backgrounds. Never substitute vague color words for the actual values.
- For print, screen rendering and printed ink may differ. The printer or production partner must confirm color mode, profile, substrate, and proofing requirements.
- If image sampling is requested, label it as an estimate. Pixels from a photograph can be affected by lighting, color grading, compression, and display calibration; they do not replace the locked source palette.

## Accessibility checks

Check actual color pairs used for text, icons, controls, and borders. WCAG contrast guidance commonly uses 4.5:1 for normal text and 3:1 for large text; use the applicable current accessibility standard for the delivery context and record the check method/result. Do not claim every palette combination passes because the palette as a whole looks harmonious.

When a pair fails, propose a documented accessible alternative or use a non-color cue (label, icon, border, or pattern). Do not alter the approved brand colors without approval.

## Handoff check

- [ ] Values copied exactly from the approved brief
- [ ] Roles and intended use are clear
- [ ] All production materials or channel-specific colors are identified as such
- [ ] Common text/background pairs are checked
- [ ] No unapproved palette extensions are presented as official
- [ ] Any print color-management requirement is confirmed with the vendor
