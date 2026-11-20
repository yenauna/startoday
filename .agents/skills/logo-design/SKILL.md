---
name: logo-design
description: Interviews the user after logo-direction research and writes a precise, original AI logo-concept prompt based on the approved brief. Activate after logo-guidelines for a new logo.
argument-hint: "[brand-name] [mark / wordmark / combination]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Logo Design

Turn an approved brand brief and confirmed Logo Direction Guidelines into a focused logo-concept prompt. This is an interview-first, prompt-only skill: do not generate the image or claim that a raster concept is a production-ready vector logo.

## When to use

- The user has no approved logo and is ready to move from `logo-guidelines` into concepting.
- The user asks for a new symbol, combination mark, emblem, monogram, or logo system.
- A logo concept needs a full strategic rethink rather than a small prompt correction.

For name-only typography, route to `../logo-text/SKILL.md`. For a small revision to an existing generated logo, use `../logo-prompting/SKILL.md`.

## Read before acting

Read `references/reference.md`, `../shared-references/research-reference-standard.md`, the approved `brand identity.txt` or brand brief, the confirmed direction from `../logo-guidelines/SKILL.md`, `references/logo-design-interview.md`, `references/logo-concept-prompt.md`, `../logo-prompting/references/common-pitfalls.md`, and the relevant rows from `../shared-references/logo-design-reference-library.md`. Use `../shared-references/visual-analysis-workflow.md` for research evidence.

## Workflow

1. **Audit first.** Inspect the existing identity, exact spelling in every script, approved palette and roles, references, current logo files, previous concepts, and rejected directions. Reuse facts; do not ask the same questions again.
2. **Check the direction gate.** The user must have approved the logo direction and the relevant reference summary. If not, return to `logo-guidelines`. If a source image could not be inspected, preserve the exact Agent Reach note in the project prompt file and keep affected decisions provisional.
3. **Ask at least five or six logo-specific questions when unanswered.** Use `references/logo-design-interview.md`. Ask these after the direction-guideline review, not before it. Ask one concise batch, skip every answer already in the brief, and include clear choices plus a free-text option where useful. Do not ask for approval of an unshown direction.
4. **Confirm the logo brief.** Summarize the chosen logo route, central idea, exact script, palette, intended scale/context, and avoid list. Wait for approval when the workflow requires stage approval.
5. **Choose one route.** Select icon, wordmark, emblem, monogram, or an approved combination. Do not combine unrelated metaphors. If two routes serve genuinely different jobs, create two separately labeled prompt options.
6. **Write the prompt.** Use the template in `references/logo-concept-prompt.md`. Specify one idea, concrete form logic, hierarchy, negative space, silhouette, exact colors/background, ratio and presentation, attachment roles, exclusions, text-rendering fallback, and evaluation tests.
7. **Save or hand off.** In a full branding run, write under `## Logo Design` in `prompts.md`, preserving unrelated sections. Direct prompt requests receive only the requested prompt text. Tell the user what files to attach and how to review the output.
8. **Review returned concepts.** Evaluate brief fit, category distinctiveness, idea clarity, silhouette, reduction, contrast, script legibility, monochrome behavior, and resemblance risk. Recommend one correction per iteration. Call generated raster a concept only.
9. **Lock source files only after approval.** Save or catalogue files only when the user asks. Record exact asset names, formats, approved variants, owner-supplied production constraints, and unresolved vector/trademark needs.

## Hard rules

- Never skip the five-to-six unanswered design decisions just because the prompt can be drafted quickly.
- Never ask the image model to reproduce a reference logo or “make it like” a named brand.
- Never invent an icon meaning that is not connected to the brief, name, or approved story.
- Use exact approved hex values, approved background values, and exact user-approved spelling. If palette is missing, ask or return to identity; do not propose a locked color silently.
- Do not force detailed Arabic or Latin wording into an image model when it is unreliable. Specify clean artwork with a reserved wordmark area and manual vector typesetting.
- Include a single flat, high-contrast silhouette test and a tiny-size test; exclude mockup scenes from the primary concept sheet unless requested.
- Do not claim originality clearance, trademark availability, vector editability, or final production readiness from generated imagery.
- Do not create an image or save a prompt pack unless the user asked for that artifact/file.
