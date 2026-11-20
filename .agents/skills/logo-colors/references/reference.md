# Reference Instructions — `logo-colors`

Read this file, `../../shared-references/research-reference-standard.md`, `logo-color-variants.md`, and the current approved palette/logo rules before recommending or prompting a color variant. This skill maps approved colors onto a mark; it does **not** choose a new brand palette.

**Approval gate:** Audit the existing palette and mark read-only, ask only unresolved decisions that change the variant, and wait for approval of the variant scope and research target before project-specific reference research or prompt/file output. Keep all already-approved HEX values and roles fixed.

## Ask only color decisions that affect the variant

Audit the exact HEX values, roles, approval status, master-logo file, existing color variants, and actual background/surface. If a color, role or approval status is missing, ask or return to `../../brand-identity/SKILL.md`; never sample a reference and silently adopt its color. Ask whether the user needs full color, one ink, reversed, limited-ink, light/dark UI, grayscale proof, print, or a particular substrate—and which actual surfaces must be supported.

## Inspect color systems, not just swatches

Review at least five distinct logo/guideline projects with their actual color-usage images visible. Study the logo on light/dark/colored fields, contrast, grayscale/one-color behavior, role mapping, hierarchy between mark and wordmark, and whether alternate versions preserve silhouette. Record reference colors only as source facts; they are never candidate brand colors. If a source only shows attractive palette swatches without logo applications, do not use it to infer mark contrast or usability.

## Color decision branches

- **No approved palette** → return to `brand-identity`; do not write a final logo-color prompt.
- **Approved palette, no finished logo** → produce a labeled concept study using only approved values; don't present it as an approved logo variant.
- **Approved logo and palette** → preserve the source master; list each requested logo element, exact color role, approved background and contrast check.
- **Black/white, reversed, tinted, gradient or metallic variant requested** → ask whether it is approved; do not assume it from convention.
- **Print color requested** → verify process/profile and printer-provided CMYK/Pantone values; screen HEX is not a print proof.
- **Generator cannot preserve the exact logo** → prompt for empty variant panels and compose the real vector asset manually.

## Evidence-to-prompt requirements

For every panel/variant, include exact HEX + named role, approved background value, master-file attachment and immutable use instruction, variant approval status, intended output size, contrast/small-scale check, and forbidden effects/extra hues. Separate approved variants from proposals. Test logo/wordmark balance and real contexts. Never claim accessibility compliance or color accuracy from a generated visualization.
