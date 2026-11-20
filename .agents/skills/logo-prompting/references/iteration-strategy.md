# Iteration Strategy

The goal is to converge on an approved logo in as few generations as possible, by editing precisely instead of regenerating broadly.

## The core rule: describe the whole current state, then the one change

When asking for a revision to an existing AI-generated image, a prompt that only says "make the red part say the brand name" tends to regenerate everything (colors drift, proportions shift, the basket shape changes slightly). Instead:

1. **Describe the full current logo exactly as it is** (every shape, every color, by hex code, its layout) — "take this exact logo: [full description]..."
2. **Say which ONE part changes and how**, explicit about what must NOT change: "...and modify ONLY the [specific part]. Keep everything else — [list it all] — completely unchanged."
3. **If attaching the actual image is possible, do that instead of re-describing from memory** — far more reliable (see `common-pitfalls.md` #7).

## When to stop iterating on the same shape and try a different direction

If three consecutive targeted edits still haven't produced a usable result for one specific sub-element (e.g. letters-as-shape fusion), stop — that's a sign the technique itself is hitting the tool's limits, not that the prompt needs more tweaking. Switch to the documented fallback for that pattern (see `common-pitfalls.md` #3) rather than burning more generations on the same approach.

## When the user rejects a whole direction, not a detail

If feedback is "I don't like this at all" rather than "fix this one part," don't keep editing — go back to `prompt-patterns.md` and pick a different style pattern (e.g. switch from icon-only to emblem), confirming the change of direction with the user first.

## Keep a visible log of what's been tried

For any brand with more than 2-3 iterations, briefly note what was tried and rejected (and why) so later prompts don't repeat a failed approach. This matters especially in longer sessions — a direction already shown to fail (e.g. "cinematic realistic photos of an employee") shouldn't resurface in a slightly different wording three prompts later.
