# Brand Prompt Pack Template

Use after the user completes `brand-intake-interview.md` and approves the compact brand lock. For a full new-brand or repositioning workflow, create or reuse `brand strategy.md` first, translate its approved choices into `brand identity.txt`, and save the selected prompt pack in `prompts.md`. Preserve existing approved files. Keep prompt contents in the file; in chat, ask interview questions, show the brief approval summary, and give a concise final file-status note only. This template does not assume the current agent can generate images.

## Pack cover / input lock

```text
STRATEGY FILE: [project-root/brand strategy.md; created only for full new brand/repositioning or when requested]
IDENTITY FILE: [project-root/brand identity.txt; created only if absent]
PROMPT FILE: [project-root/prompts.md]
Brand:
Approved name and exact spelling by script:
Offer and category:
Market, priority audience, language/dialect:
Approved story, promise, proof, supplied copy:
Approved strategic position, pillars, trade-offs, architecture:
Locked palette: #HEX — role; #HEX — role; ...
Locked typography / script behavior:
Approved logo files and variants:
Approved visual system/palette board file (if supplied):
Product/package artwork or photographs (if supplied):
Selected modules:
Target tools, aspect ratios, placements, output format:
Must preserve:
Must avoid:
Open items (do not fill with guesses):
```

## Reference research record

For every selected design module, inspect at least five relevant, distinct real project pages and visually inspect their actual images as described in that skill's `references/reference.md`. For a new-logo pack, use logo/wordmark/guideline sources from `logo-design-reference-library.md`. For a complete branding pack that includes mockups, also inspect five distinct global projects from `brand-design-reference-library.md` and five distinct Arabic-market projects from `arabic-brand-design-reference-library.md`. Do not count titles, snippets, image-search captions, text-only summaries, or thumbnails alone as visual inspection. Follow the `agent-reach` skill for supported source access and its read-only/access-limit rules. If any applicable threshold remains unmet, keep the affected prompts provisional and include:

> NOTE: Use the Agent Reach skill to access and visually inspect the reference URLs before finalizing these prompts.

Add one record per distinct project. Mark the study area separately so logo and mockup counts cannot be confused:

| Region | Project and context | Direct URL | Page opened? | Images visually inspected? | Observation | Transferable method | Do not copy |
|---|---|---|---|---|---|---|---|
| Logo / pattern / guidelines; Global / Arabic-market | ... | ... | Yes / No | Yes / No | ... | ... | ... |

Separate visible facts from interpretation. Mark conceptual, self-published, or unclear work. Never claim a project launched or succeeded unless the source proves it.

## One prompt card per deliverable

Use this structure for each ready-to-paste prompt. Duplicate only for a distinct concept, channel, or asset.

```text
PROMPT TITLE:
PROMPT TYPE: image generation / image editing / HTML build / written guideline
TOOL OR RECIPIENT:
PURPOSE:
APPROVED INPUTS: [include only facts and assets from the locked brief]
ATTACH BEFORE RUNNING: [exact filenames; mark required vs optional]
REFERENCE ROLES: [logo = exact mark; palette/system board = colors and visual language; product/package art = only the actual product shown; inspiration = one named transferable method, never artwork to copy]
TEXT SPECIFICATION: [brand identity.txt or exact locked facts to paste when the tool cannot read text attachments]
DELIVERABLE: [what the result should contain]
AUDIENCE AND CONTEXT:
STORY / MESSAGE:
VISUAL IDEA: [one specific direction with reason; no reference imitation]
COMPOSITION AND HIERARCHY:
MATERIALS / ENVIRONMENT / LIGHT / CAMERA: [only as relevant]
BRAND COLOR SPECIFICATION: [exact approved hex values and roles]
TYPE AND COPY: [exact approved text; if the generator cannot render it, leave a clean area for later typesetting]
LOGO FIDELITY: [name the exact attached logo file and tell the image tool to use the uploaded image as the exact, visible logo reference; preserve spelling/shape/proportions. If the actual mark cannot be rendered faithfully, request an edit/compositing step or clearly provisional placement area; never present a missing or fabricated logo as final]
SIZE / ASPECT RATIO / SAFE AREA:
OUTPUT AND TECHNICAL REQUIREMENTS:
NEGATIVE CONSTRAINTS: [relevant errors only; include no fake logo/text/watermark as needed]
QUALITY CHECK: [legibility, crop, script, contrast, brand fit, originality, asset fidelity]
```

## Image prompt rules

- A prompt must be specific enough to run without the agent inventing context, but it must not contain unsupported facts. Keep unresolved fields visible and ask before completing the affected prompt.
- Use exact hex values from the approved brief. If the generator may drift, specify both palette roles and the surfaces on which each color appears.
- Attach an approved logo as an image/reference input where supported and name the exact file in each relevant prompt. If exact Arabic/Latin lettering cannot be preserved, use image editing/compositing with the approved asset or request a clearly provisional, accurately placed blank area. Do not present an unbranded output or fabricated logo as the final branded result.
- For mockups, state inside each prompt: `Use the uploaded [exact logo filename] as the exact logo reference and keep it visibly applied`; name the uploaded palette/design-system board as the visual system reference when available; repeat the exact HEX values and roles in text. Do not merely mention the brand or logo without identifying the file to attach.
- If the palette exists only in `brand identity.txt`, do not claim an image was attached. Paste the exact approved HEX/role specification into the prompt; if the image tool cannot accept text attachments, include those values directly. Ask for a palette/system board if its visual guidance is important and absent.
- Give every attached reference one clear role. Do not let an inspiration image override the user's logo, palette, package artwork, or design rules.
- For a new logo, follow the staged route: research-led pre-design guidelines → user approval → at least five or six unanswered logo-specific questions → confirmed route → logo concept/wordmark prompt. A text-only wordmark has no icon unless requested. A logo-derived pattern requires an approved master; logo color prompts use approved HEX values only.
- Tell the model what to render, what should remain blank, where the focal point sits, how the crop works, and what is excluded. Avoid huge keyword piles and contradictory adjectives.
- For real people and locations, specify the approved country/region and user-confirmed details. Do not use cultural stereotypes as shortcuts.
- Keep image generation separate from production claims: a visual mockup does not validate print mechanics, materials, safety, or regulatory copy.

## Code-agent prompt rules

- State whether the recipient should create a file or return a plan only. The prompt-only default is to return an implementation prompt, not execute it.
- For HTML assets, request one standalone HTML/CSS/vanilla JS file with no framework or build step, and name exact approved asset paths. Ask the user before substituting absent assets or copy.
- Include responsive, accessibility, exact-copy, asset-integrity, and local-open checks as requirements inside the downstream prompt. Do not claim those checks have run unless they actually have.

## Pack closeout

List prompts delivered, attached inputs required, remaining open items, and which prompt should be run first **inside `prompts.md`**. Keep user approval checkpoints visible between identity, logo, mockup, presentation, campaign, and guideline stages. Do not paste the prompts into chat.
