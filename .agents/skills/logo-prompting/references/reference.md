# Reference Instructions — `logo-prompting` (Existing-Logo Revision)

Read this file, `../../shared-references/research-reference-standard.md`, the locked identity, the actual current logo, `common-pitfalls.md`, and `iteration-strategy.md` before correcting a logo prompt. This compatibility skill is for a revision or a failed generation, not the first new-logo direction.

**Approval gate:** Inspect the supplied mark read-only, ask for the single requested correction and what must remain unchanged only if unclear, and wait for the user to confirm this one-change scope before researching revision examples or drafting/editing the prompt.

## Route and interview

- No approved logo and new concept needed → `../../logo-guidelines/SKILL.md` → user-approved direction → `../../logo-design/SKILL.md`.
- Name-only mark → `../../logo-text/SKILL.md`.
- Color variant → `../../logo-colors/SKILL.md`.
- Logo-derived pattern → `../../logo-pattern/SKILL.md`, only after logo approval.
- A specific correction to an existing logo → continue here.

Audit the user's full current mark and approved sources. Ask only for the single intended change, the parts that must stay untouched, the exact output/use, and any changed palette/text/file. Do not ask them to reselect a settled logo route. If several changes are requested, ask which is priority or split them into separate prompts. Confirm the current-state lock and one-change scope before writing.

## Research and edit analysis

Inspect at least five distinct actual logo-revision/rebrand examples relevant to the issue (e.g. distorted type, color drift, weak reduction, unclear silhouette, or structure change). Use before/after images when available. Record only the visible change and its effect; do not lift a “redesign” as inspiration for the user's mark. Compare the user's asset against the approved brief and identify whether the reported failure is concept, image-model rendering, vector craft, or application/context.

## Revision prompt structure

1. Name exact master file and say immutable parts to preserve (full geometry, spelling, proportions, palette, orientation, counters, components).
2. State one visual change and its reason from the locked brief.
3. Re-describe the entire existing mark so the tool doesn't regenerate from a fragmentary change request.
4. Name exact HEX/roles and background; no new palette or treatment unless approved.
5. Specify composition, crop, size, output route, source/reference roles and exclusions.
6. State a proof checklist: requested change only; everything else unchanged; exact text; silhouette; contrast; small-size behavior; no competitor likeness.

If the problem is illegible Arabic/Latin text, don't ask the model to patch intricate lettering in raster pixels. Keep symbol and wordmark separate, reserve a clean typesetting area, and route final lettering to a vector editor or `logo-text`. Never certify vector quality, originality clearance, or trademark availability from a generated revision.
