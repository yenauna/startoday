---
name: brand-compass
description: Gives strategy-based do/don't advice on a proposed brand decision, idea, partnership, product, message, or experience. Use when the user asks whether something is on-brand or what direction to take.
argument-hint: "[decision or idea]"
metadata:
  author: mostafa
  version: "1.0.0"
---

# Brand Compass — Make Decisions That Fit the Brand

Use this skill to translate an approved brand strategy into a practical recommendation for one decision. It works independently; the user can ask “does this fit?”, “what should we do?”, or “what should we avoid?” without starting `lets-brand`.

## Read first

Read `references/reference.md`, `../shared-references/research-reference-standard.md`, and `../shared-references/subagent-collaboration-protocol.md`. Audit `brand strategy.md`, `brand identity.txt`, applicable guidelines, and the proposal or asset. Do not change the strategy or execute the recommendation unless asked.

## Workflow

1. Identify the actual decision and the person it affects. Inspect the relevant approved strategy, identity, guidelines, and source asset before asking.
2. Ask only missing facts that could change the advice: intended audience, customer situation, desired outcome, context/channel, timing, factual claim or proof, cost/operational constraint, and which parts are already committed. Skip questions answered by project files.
3. If no approved strategy exists, explain the missing foundation briefly and route to `brand-strategy`; if the user asks for a design deliverable, route to the relevant specialist. Do not invent a strategy to make the decision easy.
4. Evaluate the proposal against the approved audience, position, promise, proof, pillars, personality, identity rules, and explicit trade-offs. Separate a strategy conflict from a craft issue or a merely unfamiliar idea.
5. Return a clear recommendation: **fits**, **fits with changes**, **conflicts**, or **insufficient evidence**. Explain the strongest supporting rule, customer/business consequence, risks, and specific do/don't actions.
6. Offer one revised route or up to two alternatives only if they materially improve fit. State the smallest useful change. Leave final approval with the user.
7. If the user approves execution, hand off to the matching skill; otherwise stop at advice.

## Boundaries

- Do not turn one decision into a full rebrand or strategy rewrite.
- Do not equate “on-brand” with repeating the logo, palette, or tone everywhere; judge the purpose and context.
- Do not reject a novel idea solely because no precedent exists. Test it against strategy, proof, customer value, and risks.
- Do not claim customer preference, legal compliance, performance, or commercial success without evidence.
- Do not execute media buying, campaign targeting, budgets, ad bidding, or channel operations.
