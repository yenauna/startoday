---
name: brand-audit
description: Audits an existing brand against its approved strategy across identity, messaging, touchpoints, and experience. Use before a refresh or when the user needs a prioritized diagnosis, not execution.
argument-hint: "[brand-name] [audit scope]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Brand Audit — Diagnose Before Changing

Use this skill for a structured health check of an existing brand. It can work independently on the materials the user provides; it does not require `lets-brand` and does not make changes to approved assets.

## Read first

Read `references/reference.md`, `../shared-references/research-reference-standard.md`, `../shared-references/subagent-collaboration-protocol.md`, and `../shared-references/brand-intake-interview.md`. Inspect strategy, identity, guidelines, current touchpoints, customer evidence, and previous audit decisions before asking questions.

## Workflow

1. **Agree the audit boundary.** Ask which brand, markets, time period, audience, touchpoints, and decision the audit must support. Distinguish strategic audit, identity consistency audit, messaging audit, experience audit, or combined scope.
2. **Set an evidence inventory.** List available approved strategy, identity files, logos, packaging, web/social pages, sales/support materials, customer feedback, and business evidence. Mark missing or inaccessible materials; do not claim comprehensive coverage from a sample.
3. **Confirm the baseline.** Use approved strategy as the standard. If it is missing or disputed, ask whether to create a provisional baseline with `brand-strategy` or limit the audit to factual consistency and asset inventory.
4. **Research the relevant context.** Read the audit reference and inspect a varied sample of real touchpoints. When external benchmarks affect the judgment, inspect at least five relevant real projects and their actual images/pages. Do not confuse competitor conventions with requirements.
5. **Compare evidence to intent.** Assess strategy clarity, differentiation/proof, message consistency, identity-system consistency, audience and market fit, customer journey, accessibility/readability, operational feasibility, and known risk. Use only criteria relevant to approved scope.
6. **Rank findings.** For each finding, give evidence, impact, confidence, scope, and a practical next step. Separate critical contradictions from minor craft inconsistencies and subjective preferences. Prioritize by customer/brand harm, strategic importance, reach, and effort; explain trade-offs rather than claiming false precision.
7. **Present before fixing.** Share the concise findings and ask which recommendations to pursue. Route approved work to `brand-strategy`, `brand-compass`, `brand-identity`, logo specialists, `mockup-prompting`, `banner-design`, `brand-presentation`, or `brand-guidelines-doc` as appropriate.
8. **Create an audit file only when requested.** Save an approved audit to `brand audit.md` if requested; preserve previous versions and label scope, sample, date, evidence gaps, and owner approvals.

## Boundaries

- Do not call a limited sample a complete audit.
- Do not infer customer sentiment from visual polish or social engagement alone.
- Do not fabricate internal metrics, research participants, sales impact, trademark status, accessibility certification, or legal compliance.
- Do not redesign, publish, edit assets, or rewrite approved strategy during diagnosis unless the user separately asks for that work.
- Do not perform media buying, ad account audits, budget allocation, bid management, or campaign optimization.
