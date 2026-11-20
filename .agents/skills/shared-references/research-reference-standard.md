# Research Reference Standard — Required by Every Skill

This is the shared operating method for all 15 `branding-skills` skills. Before acting, read this file, the active skill's `references/reference.md`, and `subagent-collaboration-protocol.md`; then read any specialist files those references point to. Do not use research as decoration after a direction is already chosen: use it to make the active skill's decisions more specific and evidence-based.

## 1. Audit first; ask only questions that change the result

1. Inspect the user brief, existing `brand identity.txt`, `prompts.md`, approved logo, palette/system board, copy, product files, guidelines, previous directions, and approvals before asking anything.
2. Mark inputs as **confirmed**, **conflicting**, **missing but required**, or **optional**. Reuse confirmed facts. Never ask users to repeat them.
3. Local read-only file inspection may happen first so known facts are not asked again. **Before project-specific web research, image retrieval/download, prompt writing, generation, HTML execution, file creation, or asset changes, ask a compact set of high-impact questions and wait for answers.** Ask only when the answer could change the strategy, visual direction, research scope, requested deliverable, source asset, market/script, exact text/color, or production constraints. Don't ask easy, obvious, purely decorative, or already-answered questions.
4. Use no more than 3–6 pivotal questions in one round. When the user is unsure, give 2–3 genuinely different routes, explain the trade-offs in plain language, and leave the decision open until they select one. Do not turn every design detail into a question; infer low-risk execution details from the approved route, state them as recommendations, and ask only when the choice is consequential.
5. Show a concise decision lock before starting the confirmed research scope or drafting the dependent prompt, creating files, generating images, writing HTML, or changing approved assets. Wait for the user's approval when the scope has not already been explicitly requested or approved. If the same brief and deliverable are already approved and no consequential detail changed, carry that approval forward instead of asking again. A prompt request authorizes writing that prompt once its missing high-impact inputs are resolved. The prompt-first default still applies.

## 2. Work as a design strategist and evidence-led art director

Act as a senior brand strategist, design researcher, and art director for the active specialty. Start from the brand's offer, audience, market, category expectations, differentiation, and actual use—not from a style trend or a pile of adjectives. Translate “premium,” “modern,” “bold,” “Arab,” “minimal,” and similar words into observable design behavior only after connecting them to the approved brief. Keep Arabic-speaking countries and audiences distinct; don't treat cultural context as a generic visual asset.

Every recommendation must be traceable to one of two inputs: **(a)** an approved brand fact/constraint, or **(b)** a documented observation from a source. Label interpretations and recommendations as such. If evidence is weak or unavailable, say so and keep the direction provisional. Do not invent business facts, campaign claims, colors, names, cultural meanings, licensed fonts, logo dimensions, platform specifications, or commercial results.

## 3. Research real projects and inspect actual images

For each design-facing skill, inspect at least **five distinct, relevant real-world brand/project pages and their actual images** before finalizing a direction or prompt. Prefer credited, commissioned/official work where its status is verifiable. Conceptual or student projects can supplement the scan when useful, but label them clearly and never call them real client work. Use a suitable mix of sector, market, audience, script, and application. Five near-identical logo galleries are not useful coverage.

1. Start with the skill-specific reference library and the shared global/Arabic libraries. Search the open web as needed using the exact decision to research (for example: bilingual identity packaging, identity-derived repeat, campaign poster hierarchy, or brand case-study pacing). Google Images, Behance, studio portfolios, official brand guidelines, and design publications are discovery routes; the **canonical source page** is the citation and status record.
2. At the start of a research pass, briefly tell the user you are following the Agent Reach skill's public-source access rules. Follow that skill's routing: use native public search/read tools first when they work, and use Agent Reach for supported channels when native access is missing or incomplete. If that installed channel explicitly supports image retrieval, request the actual relevant image for inspection. Agent Reach is read-only and may return text without image pixels or downloading; do not claim it fetched or visually analyzed an image unless the installed capability actually did so. Use Google Images for discovery, open the canonical project page, then use an image-capable browser/viewer or another permitted image tool for pixels. If a public direct image must be downloaded to inspect, retrieve only a small relevant set when access and source terms allow it, keep it temporarily in a task-local cache, and remove it after review. Never commit, embed, rehost, redistribute, or attach third-party reference art to a generation prompt without rights.
3. Google Images and search-result previews are for discovery only. Open the original project/source page, resolve the original creator/brand, and check that the image belongs to that project. A title, snippet, alt-text, generated caption, thumbnail, or page text does **not** count as visual inspection.
4. Follow Agent Reach login, rate-limit, and platform-block rules. Never sign in for the user, bypass a login/CAPTCHA, evade a block, scrape in bulk, or repeatedly retry a timed-out page. A blocked page is inaccessible, not dead. Replace it with another relevant project where allowed.
5. Record at least five distinct project URLs and separate **page opened?** from **relevant image inspected?** Count a source only when its image was actually visible and assessed. If five cannot be inspected, stop at the access boundary, list inaccessible URLs/reasons, mark the affected direction provisional, and add the exact note below to `prompts.md` whenever that file is part of the output:

   `NOTE: Use the Agent Reach skill to access and visually inspect the reference URLs before finalizing these prompts.`

For any prompt pack that contains mockups, the additional requirement remains **five global + five Arabic-market projects**. The five-logo/image minimum is separate unless the same exact project image genuinely informs both decisions; record that reuse and do not double-count it within a five-plus-five market count.

For `brand-strategy`, inspect at least five relevant public brand cases and the actual customer-facing material that supports each strategic observation; combine those cases with credible category/customer evidence. For `brand-audit`, inspect five relevant external benchmarks when they materially support the audit judgment, and clearly separate them from the user's own evidence. `brand-compass` should prefer the user's approved strategy for a scoped decision and research externally only when a current fact or requested benchmark could change the recommendation.

## 4. Record evidence in a repeatable visual-analysis card

Create one compact card per distinct project in `prompts.md` or the selected research log:

| Field | What to record |
|---|---|
| Source | Exact project/brand, credited studio/creator, canonical direct URL, date if stated |
| Context | Category, real offer, audience, market/script, project type, source-stated client/concept/student/unclear status |
| Access | Search result found? page opened? original image visible? file temporarily downloaded? Never conflate these states |
| Observation | Concrete visual evidence only: composition, proportions, color relationships, type/script, materials, imagery, hierarchy, repeated forms, variants, or placement actually seen |
| Interpretation | What the observed choice might do for its own brief; phrase as a hypothesis, not source fact |
| Transfer | One generalizable design method that could be tested for the user's brand |
| Boundary | The identifiable logo, letterform, motif, palette, layout, copy, or signature detail that must not be copied |
| Relevance | Which user decision/prompt field this source informs and why |
| Confidence | High (actual image plus source context), medium (image seen/context incomplete), low (metadata only—do not count toward visual minimum) |

Analyze each selected image **at full useful resolution**. Note exact colors only if the source labels them or the source file allows reliable measurement; otherwise describe the relationship (dominant/accent/neutral/contrast) and mark exact values unknown. Examine, as relevant: visual thesis; mark silhouette, negative space and reduction; Arabic/Latin script joins and rhythm; color roles and contrast; hierarchy/alignment/grid; scale/crop; texture/material/light/camera; pattern repeat logic; logo variants; touchpoint fit; accessibility/legibility; and consistency across applications. Distinguish “seen” from “inferred.”

## 5. Turn evidence into the right prompt—not a reference collage

1. Compare projects by the decision at hand, not by whether they look fashionable. Extract one or two transferable principles per selected source; combine principles only when they support the same user-approved direction.
2. Write the reasoning chain: **approved brand fact → observed design problem/method → chosen direction → prompt instruction → quality check**. Each important prompt instruction must be grounded in the locked brief or in a clearly cited observation.
3. Use reference links to teach the agent what to inspect, but do not attach reference artwork as a target to imitate. Never write “same style as [brand]” or request a recreation. State what is forbidden to copy.
4. Build prompts from specific decisions: exact assets and filenames; their role; approved text/scripts; exact HEX values and roles; composition and hierarchy; material/environment; ratio/placement; exclusions; and measurable quality checks. Use a blank/manual-typesetting fallback for unreliable text. Keep unknowns open; don't hide them inside vague adjectives.
5. Write only the requested output modules. Preserve existing approved project files and history. Do not generate images, HTML, or an actual guideline document unless explicitly requested.

## 6. Decision routing across the 15 skills

| User need / current state | Route and required handoff |
|---|---|
| Full new brand, repositioning, or complete prompt pack | `lets-brand` orchestrates the intake, approved strategy, identity, selected skills, staged approvals, and requested files; every selected specialist can also be invoked alone |
| New brand or positioning/architecture decision | `brand-strategy`; establish audience, category, value, promise, proof, strategic pillars, trade-offs, and architecture when needed; then hand off approved choices to `brand-identity` |
| Translate approved strategy into visual/verbal system | `brand-identity`; create/update `brand identity.txt` only when absent or specifically approved; preserve strategic choices |
| Diagnose an existing brand across agreed touchpoints | `brand-audit`; provide evidence, scope limitations, prioritized findings, and specialist handoffs; do not silently remediate |
| Decide whether one idea or action fits an approved brand | `brand-compass`; give a concise do/don't recommendation traced to approved strategy; use `brand-strategy` if the baseline is missing |
| New logo, no existing mark | `logo-guidelines` pre-design research → user approves direction → `logo-design` asks pivotal logo questions → concept prompt; branch to `logo-text` only if name-only is approved |
| Existing approved logo needs usage rules | `logo-guidelines` post-design mode using authoritative asset and owner-approved/measured rules |
| A logo generation came out wrong or one edit is needed | `logo-prompting` revision only; preserve all approved logo facts and state the entire existing mark plus one requested change |
| Brand name itself is the complete logo | `logo-text`; no symbol or badge unless user explicitly changes route |
| Exact logo palette/reverse/one-color variants | `logo-colors`; return to `brand-identity` if palette is missing/unapproved |
| Pattern derived from the mark | `logo-pattern`; requires approved logo geometry and use constraints; if absent, route back to logo work |
| Product/application shown in context | `mockup-prompting`; requires exact approved logo, palette/system reference and real product assets where available; full prompt pack adds 5 global + 5 Arabic visual references |
| Campaign/social/ad/print poster or hero visual | `banner-design`; lock exact copy and placement, research relevant campaign images, verify current official output specs before exporting |
| One-page HTML case-study/presentation | `brand-presentation`; return a build prompt by default; create HTML only when explicitly asked |
| Written voice/messaging/identity guide or checklist | `brand-guidelines-doc`; use approved claims/copy and factual rules; use `logo-guidelines` for logo-specific technical usage rules |

When the user's words can map to two routes (e.g. “logo text” vs symbol logo, logo usage sheet vs written brand manual), explain the distinction in one sentence and ask the single routing question. Never silently send a wordmark request into symbol-logo prompting or a pre-design brief into a post-design usage guideline.

## 7. Research log template and final gate

```text
RESEARCH TRACK / ACTIVE SKILL:
USER DECISION THIS RESEARCH SUPPORTS:
REQUIRED SOURCES: 5 distinct; mockups additionally 5 global + 5 Arabic
VISUALLY INSPECTED COUNT:
INACCESSIBLE COUNT / REASONS:
OBSERVATIONS:
INTERPRETATIONS (label them):
TRANSFERABLE METHODS:
COPY BOUNDARIES:
OPEN DECISIONS / PROVISIONAL PROMPT FIELDS:
USER APPROVAL RECEIVED FOR:
```

Do not finalize until the locked brief, chosen route, research evidence, prompt modules, attachments, exact text/color, output format, exclusions, and quality checks agree. If a required decision remains open, ask one targeted question; if research access is the only blocker, preserve the limitation and note instead of inventing evidence.
