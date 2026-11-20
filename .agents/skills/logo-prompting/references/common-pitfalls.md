# Common Pitfalls (learned from real generation attempts)

## 1. "Abstract" without an anchor produces unrelated shapes

Asking for an "abstract geometric mark" with no concrete reference reliably produces shapes that look nice but have zero connection to the brand — a shape nobody would ever guess is "a grocery store" or "a bakery." **Fix:** always name one concrete object to simplify into geometry (a basket, a cup, a loaf, a building silhouette). Even a stylized/simplified version of a concrete thing reads as intentional; a fully invented abstract shape reads as random.

## 2. Realistic/cinematic requests fight a flat logo's style

If the logo is flat and geometric, asking for "cinematic lighting," "realistic photography," or "a real person wearing it" in a *follow-up mockup* prompt produces a visual clash — a simple flat mark pasted into a moody photoreal scene looks like two different brands. **Fix:** match the mockup's photography style to the logo's own style (see `../mockup-prompting/references/prompt-patterns.md`) — simple/flat logos get clean, plain, well-lit product-mockup treatment, not cinematic editorial photography.

## 3. Letters fused into a complex shape often fail, especially non-Latin scripts

Asking an image model to make a word's letters *become* the silhouette of another shape (e.g. Arabic text shaped like a crystal) is a genuinely hard rendering task. Expect garbled, half-formed, or wrong characters, especially in Arabic, Hebrew, or other non-Latin scripts. **Fix:** try it once if the user wants it, but immediately offer the standard fallback — icon and wordmark as two separate, cleanly legible elements placed together, not fused — and don't burn many generations chasing the fused version if early attempts come out illegible.

## 4. Vague color language causes drift between generations

"Warm brown," "a nice red," "modern colors" will produce a different actual color every single generation. **Fix:** always give exact hex codes from the locked brief.

## 5. Geography/context left unstated defaults to the AI's most common training example

A request for "a small neighborhood grocery store" with no country specified will often default to a US/European visual default (different architecture, different street furniture, different "neighborhood" look entirely). This matters most in `mockup-prompting` and `banner-design` (storefronts, streets, people), but logo-adjacent context (e.g. "a stamp typical of X region") needs it too. **Fix:** always state the country/region explicitly when the prompt involves any real-world setting, and additionally state the economic tier (upscale/ordinary/budget) if that matters to the brief — a single vague "local street" prompt can otherwise swing from run-down to resort-upscale between generations.

## 6. Over-broad single words carry baggage the user didn't intend

A single word like "apron" alone pulls in whatever the model's most common training association is for that word — which skewed toward a boutique/restaurant-staff look in real testing, not a casual grocery-store work shirt. **Fix:** describe the actual real-world object in full ("a plain, practical, everyday grocery-store work shirt, not a boutique apron") instead of relying on one category word to carry the whole intent.

## 7. Reusing the full logo description in every follow-up prompt, instead of attaching the actual logo image

If the tool in use supports image attachments/references, always attach the actual approved logo file to mockup/banner prompts instead of re-describing it in words each time — re-describing it from text alone means the model redraws it slightly differently every time, which is the #1 cause of "why does my logo look different in every mockup?"

## 8. Asking one image to show a whole identity system hides logo quality

Contact sheets that mix the logo, colors, stationery, packaging, storefronts, and lifestyle photography can make weak marks look finished. **Fix:** evaluate the logo alone first on a plain background, then test it separately at one-color and smallest-use sizes before presenting applications.

## 9. “Vector” in a prompt does not make an editable production file

Image models can return raster artwork that only looks vector-like; edges, counters, symmetry, or lettering may be inconsistent. **Fix:** call it a concept image, verify the geometry, and prepare a real vector master using a suitable design tool before claiming it is a production asset.

## 10. A visual reference can become an accidental imitation

Naming a popular brand or copying a project image as a prompt reference can pull its distinctive mark, palette, layout, or trade dress into a new concept. **Fix:** extract one general method (such as a modular grid or product-variant coding), remove the reference's brand-specific features, then adapt it to the locked brief and run an originality check.

## 11. One prompt tries to solve unrelated directions at once

Combining several styles (“minimal, vintage, futuristic, playful”) produces a vague middle ground and makes revision hard. **Fix:** pick one clear territory, state the single idea, and change one decision per iteration.
