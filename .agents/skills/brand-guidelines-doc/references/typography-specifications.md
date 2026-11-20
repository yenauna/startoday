# Typography Specifications

Document the typography direction approved in `../brand-identity`. Typeface examples and numeric scales in this reference are not defaults; use only actual approved fonts and measured output values.

## Font inventory

| Font family | Script coverage | Role | Approved weights/styles | Source/file/license status |
|---|---|---|---|---|
| [exact family] | [Arabic / Latin / other] | [display / heading / body / label] | [available weights] | [source and license] |

Specify a tested fallback stack for each role. Never assume that a font supporting Latin also contains the required Arabic glyphs, diacritics, or punctuation.

## Define the hierarchy

For each medium, document the actual roles used—display, page title, section title, body, caption, interface label, or legal copy—and note:

- Typeface, script, weight, and style
- Size, line height, and tracking at relevant viewports
- Maximum readable line length and paragraph spacing
- Alignment and text direction
- Where a role appears and which roles are intentionally paired
- Any print size or viewing distance requirement confirmed by the printer

Choose a scale that supports the brand and medium; don't force the same desktop values into mobile, social, signage, and packaging.

## Arabic and bilingual typography

- Use a typeface with complete, tested glyph coverage for Arabic, including required diacritics and punctuation.
- Set correct language and direction in HTML and test bidirectional lines that include numbers, parentheses, Latin product names, URLs, or currency.
- Check shaping, joining, line breaks, kashida, letter spacing, diacritic clipping, and baseline alignment in the final renderer. Do not apply Latin tracking rules to Arabic text without review.
- When Arabic and Latin share a layout, specify whether both scripts have equal hierarchy or one is intentionally secondary. Test each script alone and in paired lines.
- Use copy supplied or approved by the user; do not transliterate or translate a brand name without confirmation.

## Readability and accessibility

- Test actual text/background combinations, font weights, size, line length, and responsive wrapping.
- WCAG guidance commonly sets 4.5:1 contrast for normal text and 3:1 for large text. Record the applicable requirement and actual tested result for the delivery context.
- Avoid thin weights at small sizes and all-caps long passages; check for clipping and text embedded in images.
- Provide a fallback that preserves reading order when an external font cannot load.

## Web implementation notes

- Use a local, licensed font file when one is supplied and appropriate for the standalone deliverable. If an external service is used, confirm approval, include fallbacks, and note the network dependency.
- Define reusable CSS properties for approved families, weights, and scale values. Keep role names separate from specific component names so the presentation remains editable.
- Include only weights/styles that are actually available; synthetic bold or italic can change the designed shape.

## Specimen tests

Use real approved brand copy, not dummy filler, to test:

1. Brand name and longest key phrase
2. Body paragraph and a short label
3. Arabic-only or other non-Latin copy, if required
4. Bilingual line with numbers and punctuation, if required
5. The smallest intended caption/label
6. A narrow mobile width and the final print/display size

Record any open font license, coverage, or export issue rather than implying that it has been resolved.
