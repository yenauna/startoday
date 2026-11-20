# Subagent Collaboration Protocol

This protocol applies whenever the host agent supports subagents or equivalent delegated workers. The active skill remains usable on its own; delegation is an execution pattern, not a prerequisite for invoking a specialist.

## Roles

- **Main agent / lead:** owns the user conversation, intake, approval gates, project source of truth, scope, integration, and final response.
- **Specialist subagent:** performs one explicitly scoped skill module, reads that skill's `SKILL.md` and `references/reference.md`, follows the shared research/access rules, and returns a result to the lead.
- **Critic/reviewer:** when available, independently checks a material recommendation against the approved brief, evidence, constraints, and adjacent stages. It does not replace the specialist or make user approvals.

## Full `lets-brand` workflow

1. The main agent reads `lets-brand` and this protocol, audits local files, interviews the user, and locks only the selected modules. It never delegates user questions, consent, or the approval decision.
2. Create one specialist subagent for each **selected** skill module. Give each the approved brief snapshot, exact task, source files/paths, relevant decisions already settled, allowed output, open questions, and required evidence. Do not launch agents for unselected skills or ask them to invent missing facts.
3. Run dependency-bound stages in order: `brand-strategy` → `brand-identity` → research-based logo direction → selected logo route → approved applications. Parallelize only independent research/review tasks; never let parallel drafts silently approve downstream work.
4. A specialist returns its draft/recommendation, evidence/source log, observed facts versus interpretation, assumptions, unresolved questions, risks, correct next-skill handoff, and whether any visual/source requirement was unmet. The specialist does not write/overwrite project files unless the lead explicitly delegates that exact file edit.
5. The main agent integrates the result, checks it against the locked brief and other modules, and handles the review round below. The main agent remains accountable for final file changes and approval gates.

## Standalone specialist invocation

Every skill can be called directly without `lets-brand`. If the host supports delegation, the active specialist acts as the lead and asks one helper subagent to perform a bounded independent task—usually reference research or a quality review—then compares the returned result to the skill's rules. Keep the user's request narrow; do not turn a one-skill task into a full workflow. Do not recursively spawn agents unless the user or host explicitly requests it.

## Evidence-based debate and review

Use one concise review round for material outputs:

1. **Specialist proposal:** state the recommendation, evidence, fit with the approved brief, assumptions, and uncertainty.
2. **Lead challenge:** check for unsupported claims, wrong skill routing, missing evidence, conflict with approved decisions, copying risk, and whether the work answers the user's actual task.
3. **Specialist response:** defend with specific evidence, revise, or explicitly disagree and explain the evidence gap.
4. **Lead resolution:** accept, request a bounded revision, or present the unresolved choice to the user. The lead must not hide a disagreement that changes the recommendation.

This is an evidence review, not a vote or a request to expose private chain-of-thought. Keep discussion focused on claims, sources, constraints, trade-offs, and corrections. Share a concise decision and material uncertainty with the user, not internal deliberation transcripts.

## Limits and fallback

- Subagents inherit no extra permission. They must follow the same read-only reference access, approval, privacy, rate-limit, and source-rights rules as the lead.
- Never ask a subagent to bypass a block, sign in for the user, publish, contact someone, or change external systems.
- If the runtime does not support subagents, continue in the main agent with a separate critic pass. State that no subagent was available; never claim a delegated review happened.
- If agents disagree because the brief is missing, ask the user one targeted question. Do not settle a consequential client decision by majority vote.
