# Reference Instructions — `lets-brand`

This is the orchestration guide for the complete brand strategy and identity workflow. Read it before asking questions or starting research, then read `../../shared-references/research-reference-standard.md` and `../../shared-references/subagent-collaboration-protocol.md`. Also read each selected specialist's own `references/reference.md` before invoking it. Do not activate all 15 skills by default; every specialist can also be invoked directly without this orchestrator.

## Before doing project work

1. Inspect the project directory, `brand strategy.md`, `brand identity.txt`, `prompts.md`, logo/design-system files, previous decisions, and any source links. Do not edit or create output files yet.
2. Ask which outcomes the user wants: brand strategy/repositioning, identity, brand audit, one decision check via Brand Compass, or selected design/application prompts. Ask about target tools only when that changes the output.
3. Ask only missing pivotal facts: business objective, offer/differentiator, priority audience and market, approved story/claims, exact name/script, palette status, actual logo status, must-keep/avoid, and selected modules. Skip supplied facts and keep this batch to 3–6 questions.
4. Present one concise strategy/identity lock, selected modules, and unresolved questions. Wait for approval before project-specific research, drafting, or file changes unless the exact scope is already approved. Create `brand strategy.md` only for a full new-brand/repositioning flow or when requested; create `brand identity.txt` only if absent; preserve existing approved content otherwise.

## Research plan by module

Create a research row for every selected module before searching. Each row names the user decision, library/query, at least five distinct real project pages, image type to inspect, and what will be learned. Reuse a source across modules only when the exact relevant image was inspected and actually answers both questions.

| Selected module | Research focus | Inspect |
|---|---|---|
| Brand strategy | Five real brands/cases in the target category/market plus credible category/customer evidence | Stated audience, category, offer, promise, proof, strategic choices, and actual customer-facing identity where relevant |
| Brand audit | Evidence from the agreed brand touchpoints; external benchmarks only when they change a finding | Strategy-to-experience gaps, message consistency, identity use, sample coverage, and confidence |
| Brand Compass | Start from the approved strategy; research only if a current fact or requested benchmark could change the advice | The specific decision, affected audience, proof, consequences, and source-backed alternatives |
| New logo | Five distinct logo projects, script/category/market-relevant | Actual marks, variants, guideline pages; use logo reference library |
| Wordmark | Five actual Arabic/Latin/bilingual lettering projects | Glyph forms, joins, rhythm, proportions, text hierarchy |
| Logo colors | Five logo/guideline color examples | Logo/background pairings, reversals, monochrome behavior, labels/roles |
| Logo pattern | Five actual repeat systems | Mark derivation, tile, density, scale, color, application |
| Mockups | Five global plus five Arabic-market projects | Exact touchpoints, asset placement, materials and scene choices |
| Posters/banners | Five relevant campaign/ad/poster projects plus current official specs | Message order, crop, copy area, focal image, placement size |
| Presentation | Five identity case-study/presentation pages | Story sequencing, hierarchy, whitespace, pacing and mobile reading |
| Written guidelines | Five relevant guidelines/system documents | Evidence vs rule, ownership, actionable examples, governance |
| Brand identity | Five real identities in relevant categories/markets | Positioning reflected in logo, palette, type, imagery and applications |

Use Agent Reach for supported public channels and follow its read-only/login/block rules. If it returns text only, use a visual-capable browser/viewer for actual pixel inspection. Record images not seen; never call a search caption “visual analysis.” Apply the full direct-source card from the shared research standard. The exact note for an unmet visual threshold belongs in `prompts.md` when that file is requested.

## Stage gates and routing

1. **Strategy gate:** For a full new brand or repositioning without an approved strategy, run `../../brand-strategy/SKILL.md` first. Lock the evidence-based audience, category, position, promise, proof, pillars, and trade-offs. Preserve any approved strategy.
2. **Identity gate:** Run `../../brand-identity/SKILL.md` after strategy when a design system or identity file is needed. Users may also invoke identity alone for a scoped task.
3. **Audit/advice routes:** Use `../../brand-audit/SKILL.md` only when a broad diagnosis is requested; use `../../brand-compass/SKILL.md` for one proposed decision against an approved strategy. Neither is automatic in every new-brand project.
4. **No-logo gate:** Run `../../logo-guidelines/SKILL.md` in pre-design mode. Analyze at least five relevant actual logo images, present a short Logo Direction Guide, and wait for approval.
5. **Logo decision gate:** For an approved symbol/combination, route to `../../logo-design/SKILL.md`; for a name-only route, use `../../logo-text/SKILL.md`. Ask 5–6 unanswered pivot questions after the guide. Existing-mark edits go to `../../logo-prompting/SKILL.md`.
6. **System extensions:** `../../logo-colors/SKILL.md` requires approved HEX roles; missing palette returns to identity. `../../logo-pattern/SKILL.md` requires an approved master/vector and permitted component use. Neither is automatic.
7. **Applications:** `../../mockup-prompting/SKILL.md` covers product/touchpoint scenes, `../../banner-design/SKILL.md` campaign placements/copy, `../../brand-presentation/SKILL.md` the HTML case study, and `../../brand-guidelines-doc/SKILL.md` written rules/checklists. Select only requested modules.
8. **Subagents and review:** The main `lets-brand` agent owns intake, approval, integration, and files. Delegate one subagent per selected specialist, then run the evidence-based review round in the shared protocol. If delegation is unavailable, disclose the fallback and review directly.
9. **Stage approval:** Show each stage summary and wait for approval before dependent work. One “Let's brand” request does not approve every downstream direction.

## Evidence-to-prompt chain

For each selected output, put a compact trace in `prompts.md`: approved brand fact → source observation (URL + visual status) → transferable design method → prompt instruction → quality check. Keep examples relevant to the user's market and channel. Use each source to learn one method, explicitly state what not to copy, and don't mix unrelated designs into a style collage.

Each prompt lists exact user assets to attach and their role, exact Arabic/Latin spelling, approved HEX values and roles, layout/hierarchy, ratio/placement, environment/materials as relevant, exclusions, unresolved inputs, and a concrete pass/fail review checklist. Keep the approved logo immutable in mockups. Keep prompts in the requested project file; do not paste the full pack into chat.
