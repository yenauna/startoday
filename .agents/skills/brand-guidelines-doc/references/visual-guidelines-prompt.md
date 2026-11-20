# Visual Logo and Brand Guidelines Board Prompt

Use this when the user wants an image-generator prompt for a visual guideline sheet or logo-usage board. It complements the written guide; it does not replace the actual approved vector files or exact production specifications.

## Before writing the prompt

- Read the approved logo variants and the locked brief. Ask which facts are approved if the source files conflict.
- Confirm which board they need: logo family, color and background behavior, typography, clear-space demonstration, minimum-size test, or misuse examples.
- Only show numeric clear space, minimum size, or logo proportions if they were measured from the real asset or approved by the brand owner. Otherwise show a labeled “demonstration only” area or omit it.
- Never ask an image model to redraw precise Arabic or Latin lettering. Use the approved logo file as a reference if supported; otherwise ask for a blank placeholder area and state that the real logo will be composited afterward.

## Prompt pattern

```text
Create a clean visual brand-guidelines board for [brand] using the attached approved identity brief and actual logo file(s). This is a presentation diagram, not a new logo design.

Board purpose: [selected rule set].
Audience: [brand team / designers / vendors / another confirmed audience].
Layout: [clear grid, labeled section order, generous whitespace, intended board ratio].
Show only these approved elements: [primary logo variant, secondary variant, monochrome variants, locked palette with exact hex labels, approved typography samples, measured/approved spacing rules].
Color fields: use #HEX [role], #HEX [role], ... exactly. Keep any unapproved colors out.
Logo fidelity: place the attached logo unchanged, with correct script and proportions. Do not redraw, stylize, translate, rotate, distort, outline, add effects, or invent a symbol. If fidelity is uncertain, leave clearly marked blank logo-placement areas for manual compositing.
Text handling: use only the exact supplied text [copy]. If the model cannot render it accurately, leave blank caption blocks for later typesetting; do not create pseudo-Arabic or fake labels.
Usage examples: [confirmed light/dark/background use or touchpoints]. Keep examples consistent with the real logo file and brief.
Avoid: invented clear-space or minimum-size numbers, unapproved fonts, altered logo variants, extra mockups, decorative imitation of another brand, fake text, watermarks.
Output: [orientation, aspect ratio, resolution if known]. Keep all labels legible and create a spacious editorial guideline sheet.
Review: verify every shown rule against the source file. Mark conceptual demonstrations as examples, not production rules.
```

## Important limitation

Image generators often distort lettering, labels, measurements, and diagram logic. Use the generated image only as a layout or art-direction concept. Typeset the final captions and place approved logo/vector assets in an editable design file or the brand's HTML presentation.
