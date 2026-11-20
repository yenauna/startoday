---
name: logo-prompting
description: Refines prompts for an existing logo or corrects a failed logo-generation attempt. For a new logo, route through logo-guidelines and logo-design first.
argument-hint: "[brand-name] [concept-direction]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Prompting — Refinement and Compatibility

Writes focused revision prompts for existing logo assets or corrects an earlier image-generation prompt. Prompt-only output is the default; do not assume this agent can generate image files. For a first logo with no approved mark, use `../logo-guidelines/SKILL.md` first, then `../logo-design/SKILL.md`; for a name-only wordmark, use `../logo-text/SKILL.md`. This skill remains available to existing users and projects that explicitly call `logo-prompting`.

## When to Use

- An AI-generated logo came back wrong (off-brand, wrong colors, unrelated shapes, bad text rendering) and needs a corrected prompt
- User wants a small, specific change to an existing AI-generated logo (not a full redo)
- An existing user workflow explicitly calls this legacy-compatible logo-prompt skill

## Workflow

1. **Read the research protocol**: read `references/reference.md`, `../shared-references/research-reference-standard.md`, and `../shared-references/brand-intake-interview.md`. Inspect the brief and current logo before asking anything.
2. **Route first-time work correctly**: if there is no approved logo and a new direction is needed, stop and invoke `../logo-guidelines/SKILL.md`, followed by `../logo-design/SKILL.md` after direction approval. If a name-only logo is requested, use `../logo-text/SKILL.md`.
3. **Interview before revisions**: ask only for missing or conflicting facts that affect the requested change. Confirm exact spelling/scripts, market/audience, intended use, approved colors, authoritative file, and what must stay unchanged. Summarize the lock before writing a prompt.
4. **Research the issue**: inspect at least five relevant real logo revision/redesign examples with actual images and use the research protocol. Do not copy a source or add extra changes.
5. **Choose one revision route** from `references/prompt-patterns.md` (icon, wordmark, emblem, monogram, or an approved combination). Explain why it fits. If the brief supports two routes equally, offer them as separate choices instead of mixing them in one prompt.
6. **Build a complete, copy-ready revision prompt** with the entire current logo state, one concrete requested change, exact palette hex codes and roles, exact background hex, composition, intended-size test, tool/ratio when known, exclusions, and a validation checklist. For bilingual or non-Latin names, copy exact user-approved text and specify manual typesetting if spelling is unreliable.
7. **Hand off and review**: name the exact user-supplied reference assets to attach and their role. The user runs the prompt in their image tool and can return the result. Check brief fit, requested-change fidelity, spelling, silhouette, one-color use, small-size reading, and similarity to references/competitors. If lettering or geometry is wrong, label the image as rough direction and recommend rebuilding in a design tool.
8. **Iterate one decision at a time** using `references/iteration-strategy.md`. Keep the approved logo attached when refining or applying it; record the prompt and rejected directions.
9. **Lock production assets only after user approval**. Save approved files to `/assets/logo/` only when the user asks for project-file handling. Record actual formats, color variants, script/spelling, exact colors, measured/approved clear space, and known limits.

## Hard Rules (from real failure cases — see common-pitfalls.md for the full list)

- Never write "abstract shape" without anchoring it to something concrete the viewer will recognize (a basket, a crystal, a cup) — pure abstraction reliably produces unrelated, unusable shapes.
- Never ask an AI image tool to render small, precise text (especially non-Latin scripts) *inside* a complex shape (e.g. letters forming a silhouette) without expecting several failed attempts — flag this risk to the user before they spend generations on it, and offer the fallback (icon + separate wordmark, not fused).
- Always specify the exact hex codes, not "warm brown" or "a nice red" — color drift between generations is one of the most common complaints.
- Always specify flat/vector/geometric style explicitly if that's the direction, or the tool defaults to literal, cluttered, or photorealistic renders that don't scale down as a usable mark.
- When revising one part of an existing logo, describe the ENTIRE logo's current state in the prompt (what to keep, exactly) plus the one change — a prompt that only describes the change tends to regenerate the whole thing differently.
- A generated raster image is a concept, not automatically an editable logo, vector file, trademark clearance, or accurate wordmark. Label it accurately and verify production needs separately.
- Use references to study methods. Never request a “same as” recreation or reuse a distinctive competitor/reference device.
- When the user requests a visual logo-guideline board, also read `../brand-guidelines-doc/references/visual-guidelines-prompt.md`. Treat the board as a separate deliverable from the logo concept prompt; never invent clear-space or minimum-size rules.
- Do not generate or edit images unless the user explicitly asks and an image-generation capability is available. A prompt request means return prompt text for the user's external tool.
