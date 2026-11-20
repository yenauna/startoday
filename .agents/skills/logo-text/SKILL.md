---
name: logo-text
description: Designs a text-only logo or wordmark through a language-aware interview and a precise typography prompt. Activate when the user wants the name itself to be the logo.
argument-hint: "[exact-brand-name] [script(s)]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Text — Wordmark Prompting

Create an original **wordmark** where the approved brand name is the complete logo. This is a typography-led identity, not a symbol logo and not merely a brand name typed in a default font. The default output is a detailed prompt for an image or lettering tool; final lettering should be typeset and refined in a vector-capable design tool.

## When to use

- The user explicitly wants a text-only logo, logotype, or wordmark.
- The approved identity favors the name and custom lettering over an icon.
- The user needs an Arabic, Latin, or bilingual typographic mark.

For a symbol plus name, use `../logo-design/SKILL.md`. For symbol-based repeat patterns, use `../logo-pattern/SKILL.md` only after an approved mark exists. For logo color variants, use `../logo-colors/SKILL.md`.

## Read before acting

Read `references/reference.md` and `../shared-references/research-reference-standard.md`; inspect the locked brand brief, exact approved spelling in all scripts, name pronunciation/meaning if owner-confirmed, palette, competitors/rejected options, current logo files, and the approved Logo Direction Guidelines. Then read `references/wordmark-interview.md`, `references/wordmark-prompt.md`, `../logo-prompting/references/common-pitfalls.md`, and relevant Arab-script references in `../shared-references/logo-design-reference-library.md`.

## Workflow

1. **Confirm that name-only is intentional.** If the user has not approved a text-only route, ask whether the logo should be a wordmark alone or include a separate symbol. Do not add an icon by default.
2. **Audit the name and script.** Preserve the approved text character for character. Confirm Arabic spelling and RTL direction, Latin transliteration, script order, diacritics, ligatures, punctuation, tagline exclusion/inclusion, and whether the mark is Arabic-only, Latin-only, or bilingual. Do not invent a translation.
3. **Interview for type behavior.** Use `references/wordmark-interview.md`; ask at least five or six distinct unanswered decisions. Cover typographic category, custom-lettering ambition, key letter behavior, weight/width/contrast, spacing/rhythm, script relationship, palette, and actual use scale.
4. **Review visual research.** Open at least five relevant wordmark/logo project pages and inspect their actual letterforms, with Arabic references when the brand uses Arabic. Use the shared research protocol; separate observed letterform behavior from interpretation and do not copy a specific shape. If fewer than five actual logo images can be inspected, keep the direction provisional, identify inaccessible pages, and add the exact Agent Reach note to `prompts.md`.
5. **Set the typography direction.** State the design principle for the letters: structure, stroke contrast, terminals, counters, rhythm, ligature approach, proportion, and whether a typeface is only a starting reference or custom lettering is required. Name fonts only when they are verified and licensed/approved for this task.
6. **Write the prompt.** Use `references/wordmark-prompt.md`; make the exact brand text central, require a clear text-only result, and specify a blank/manual-typesetting fallback when the model cannot render script accurately.
7. **Review** exact spelling, RTL ordering, letter joins, diacritics, kerning, rhythm, negative space, silhouette, small-size legibility, pronunciation cues, and similarity to other wordmarks. Ask the user to proof the text. Recommend vector reconstruction for approved production lettering.
8. **Save** under `## Logo Text / Wordmark` in `prompts.md` for a full project, preserving prior content. Direct requests receive the requested prompt text only.

## Hard rules

- Do not add an icon, monogram badge, decorative frame, or illustration unless the user approves changing the route.
- Copy approved text exactly. Do not autocorrect spelling, translate, change diacritics, reorder scripts, or fabricate a tagline.
- For Arabic, explicitly specify right-to-left reading, connected letterforms, appropriate shaping, and valid ligature behavior. Do not treat a glyph-separated pseudo-Arabic rendering as acceptable.
- Do not assume that one font file supports the needed Arabic/Latin glyphs, weights, license, or proper shaping; verify before recommending it.
- If a generator cannot render the exact text, ask it for a typographic composition direction with a clean empty wordmark zone; set exact lettering manually afterward.
- Use exact approved HEX values and identify their roles. Never infer a palette from reference projects.
- State that generated text artwork is exploratory, not final editable lettering or trademark clearance.
- Do not generate an image or write a file unless requested.
