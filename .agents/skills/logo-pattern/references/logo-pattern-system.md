# Logo-Derived Pattern System

## Intake decisions

Ask only what is not established by the locked brief or existing logo guidelines:

- Which confirmed surface or product will use the pattern, and in what country/region if a real-world scene appears?
- Should it read as quiet texture, an editorial graphic, or a prominent brand signature?
- What is the physical/digital scale and crop area? Is there a printer, embroidery, laser, foil, or packaging constraint?
- Can the symbol be separated from the wordmark? Which components are explicitly approved for use?
- Is rotation, mirroring, cropping, overlap, transparency, or outline treatment allowed?
- Which exact approved palette color is background, motif, accent, and contrast color? Are one-color or reverse versions approved?
- What quiet zones must remain empty around copy, product information, or the primary logo?

## Choose a repeat construction

| Method | Use when | Required checks |
|---|---|---|
| Whole-mark repeat | The complete symbol is simple and repetition is authorized | Mark is not crowded, misread as a logo replacement, or distorted at tile edges |
| Approved subshape | The owner has identified a separable component | Its extraction does not alter meaning or create an unapproved new mark |
| Negative-space extraction | The mark has a distinctive internal counter/void | Counter remains recognizable as a derived detail, not an independent imitation |
| Modular crop | A clear geometric module repeats safely | Grid and crop are derived from the real vector and seams remain mathematically consistent |
| Line/outline derivative | A single-color decorative surface is needed | Exact stroke weight, no new contours, no effects unsupported by identity |

Do not choose a method because a reference used it; verify it against the supplied mark and approved usage rules.

## Pattern specification checklist

- Source logo filename, format, and owner-approved components.
- Tile dimensions/aspect ratio and repeat type (straight, half-drop, mirror, radial, or other), with reason.
- Motif scale at the intended output size, spacing, density, direction, and maximum allowed rotation.
- Whether the mark is shown whole, cropped, outlined, filled, or reduced to an approved component.
- Background/motif/accent colors as exact approved HEX values and roles.
- Seamless edges on all tile boundaries; no near-misses, uneven spacing, unintended overlap, or focal seam.
- Quiet areas and safe zones around primary logo, text, product labels, and important content.
- Pattern swatch and application output as separate images; name the real surface and print/render context.
- Production check in a vector tool for tile repetition, min stroke, color profile, bleed, and licensing of any third-party mockup.

## Copy-ready prompt skeleton

> Using the attached approved master **[exact logo filename]** as the source asset and **[palette filename]** as the approved color reference, create one **flat, seamless, repeatable pattern swatch** derived only from **[owner-approved part of mark]**. Keep the source logo geometry intact; apply only the approved operations **[repeat/scale/crop/rotate rules]**. Use **[HEX + role]** for the background, **[HEX + role]** for the repeated motif, and **[other approved HEX + role]** only as specified. Tile: **[width × height / ratio]**; repeat: **[method]**; target motif size: **[value at output scale]**; spacing: **[value or proportion]**; density: **[low/medium/high with explanation]**. Preserve a **[quiet-zone description]** for later approved copy/logo placement. Every tile edge must connect seamlessly with consistent spacing and scale; show the tile boundaries only in a separate technical proof, not in the presentation swatch. Do not redraw or retype the logo, invent symbols, add unapproved motifs, distort/overlap the mark, add gradients or shadows, add colors, add fake text, or borrow patterns from references. Output **[dimensions/ratio]**, with clear separation between swatch and any optional application. Check edge continuity, mark fidelity, legibility, contrast, visual density, and suitability at both intended physical size and screen zoom.
