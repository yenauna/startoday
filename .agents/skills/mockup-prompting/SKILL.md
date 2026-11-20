---
name: mockup-prompting
description: Interviews about brand mockups, visually researches real global and Arabic references, then writes approved, detailed mockup prompts into prompts.md.
argument-hint: "[brand-name] [mockup-type]"
metadata:
  author: mostafa
  version: "1.1.0"
---

# Mockup Prompting — Research Before Rendering Instructions

Write precise image-generation or compositing prompts that place an approved brand identity on realistic, useful touchpoints. Prompts are file deliverables; do not paste ready-to-run prompt text into chat. The user runs them in an external image tool unless they explicitly request image generation and an image tool is available.

## When to Use

- The user wants to see an approved logo or identity in context
- The mockup section of a brand prompt pack or presentation is being prepared
- Existing mockups need a focused prompt revision

## Step 0 — Audit and lock before writing

Read `references/reference.md`, `../shared-references/research-reference-standard.md`, `../shared-references/brand-intake-interview.md`, `references/mockup-types-by-business.md`, and `references/prompt-patterns.md`. Inspect `brand identity.txt` if present, approved logo files, product imagery, campaign assets, current mockups, and existing `prompts.md`.

- If `brand identity.txt` is missing, use `../brand-identity/SKILL.md` to interview and create it after user approval. Never write a mockup prompt from an incomplete brief.
- If the identity file exists, use it as the source of truth; do not create or overwrite it. Ask about conflicts instead of guessing.
- Confirm which customer touchpoints to cover, whether each should be a clean presentation mockup or a marketing/lifestyle scene, target generator and aspect ratio, required copy, and available assets.
- For every selected mockup, confirm the actual approved logo image/file, the locked palette and any visual palette/design-system board, and relevant product/package artwork or photos. Record exact filenames, approval status, and what each file is for. If the brand system is incomplete or a required logo asset is missing, ask for it or keep the affected mockup prompt open; do not quietly substitute an imagined mark, palette, or style.
- Show a concise input lock and wait for approval before drafting prompts. Do not provide prompt text in chat.

## Step 1 — Research the reference libraries (required)

Before writing any mockup prompt, review and visually inspect at least:

- **Five distinct global projects** linked from `../shared-references/brand-design-reference-library.md`
- **Five distinct Arabic-market projects** linked from `../shared-references/arabic-brand-design-reference-library.md`

Ten distinct projects are required for a complete mockup prompt set. Choose links relevant to the locked industry, touchpoints, and audience. For Arabic projects, prioritize the target country when the library allows it. Do not count the same project twice because it appears on multiple pages.

For every counted reference:

1. Open the direct source page, not only the library table, title, search snippet, or thumbnail.
2. Inspect actual identity and mockup images. Record what is visibly shown: object/touchpoint, logo scale and placement, material, packaging hierarchy, color use, lighting, camera/crop, and context where visible.
3. Separate visible facts from interpretation. Record one transferable method and one recognizable element to avoid copying.
4. Link the source in the research notes inside `prompts.md` and state which prompt decision it informed.

Activate and follow the `agent-reach` skill when reading or accessing reference links, in line with that skill's public-content routing and access limits. When text retrieval alone does not expose images, use an image-capable browser or visual inspection tool. Do not claim to have seen images from a text-only page summary.

If a page is inaccessible, replace it with another relevant link from the same library. If fewer than five visually inspected references in either group remain, do not claim completion and do not invent observations. Add this exact note to `prompts.md`:

> NOTE: Use the Agent Reach skill to access and visually inspect the reference URLs before finalizing these prompts.

List the inaccessible links and the limitation, and leave prompts that depend on those observations provisional. Follow Agent Reach instructions for login, rate limits, platform blocks, and errors; never bypass them or repeatedly retry blocked pages.

## Step 2 — Select useful mockups

Use `references/mockup-types-by-business.md` to propose three to six high-value touchpoints, ranked by customer visibility and business value. Ask the user to select or correct the list if the brand brief does not already define the actual touchpoints. Do not default to a generic pile of bags, cups, shirts, and storefronts.

For each selected touchpoint, connect the prompt to:

- Its real role in the customer journey
- The approved logo version and exact brand colors
- Materials and production constraints from the brief
- One or two general methods learned from the inspected references
- A clear originality boundary so the new design remains distinct

Before drafting, create an attachment manifest for each prompt. Use the exact uploaded logo image as the logo reference; use the supplied palette/design-system board as the visual system reference when one exists; use `brand identity.txt` as the text source of truth; and use product/package photos or artwork only for the real product details they show. State these filenames and roles inside the prompt so the user knows what to upload. Do not attach or describe a logo as a general style reference, and do not let inspiration images replace the user's own identity.

## Step 3 — Match image treatment to the use

- For a guidelines board or identity presentation, default to a clean studio mockup with readable material and controlled, approved background color.
- Use narrative/lifestyle imagery only when the user requests it, the locked brief supports it, and the geography/context are explicit.
- Do not place a flat/minimal mark in a cinematic scene unless the user explicitly wants that contrast.
- If a real setting, person, shop, or street appears, use the country/region in `brand identity.txt`; ask if it is missing.

## Step 4 — Bind every prompt to the actual design system

Every mockup prompt must include a direct, tool-facing reference instruction, not only a written description of the brand:

- **Logo:** `Use the uploaded [exact logo filename] as the exact logo reference. Apply this approved mark visibly at [position] and [approximate scale]. Preserve its spelling, silhouette, proportions, colors, and clear space. Do not redraw, replace, simplify, omit, or invent a logo.`
- **Colors/system:** `Use the uploaded [exact palette/design-system board filename] as the visual reference for this brand's palette and visual language. Follow the locked system in the attached/readable brand identity file. Use these exact HEX values and roles: [list]. Do not substitute colors or introduce a new style.` If no palette image exists, name that fact and repeat the exact HEX/role values in the prompt; never pretend a text file is an image reference.
- **Product/artwork:** `Use the uploaded [exact product/package/artwork filename] as the reference for the actual product and package structure. Preserve the visible approved details; do not invent variants, label copy, ingredients, seals, or package features.`
- **Reference order:** identify each attachment by filename and role. Use the client's assets for identity fidelity. Include external inspiration only when it informs a specific transferable method, and explicitly prohibit copying its recognizable design.

Request all supported relevant source assets in every prompt. Do not say “with the brand logo” while omitting an upload instruction or the asset name. If the image model drops or distorts an available logo/color system, treat that as a failed image-generation route: use an edit/compositing workflow with the actual approved artwork, or mark the prompt as provisional and explain the limitation. Generate a clean unbranded placement area only when the real logo asset is unavailable or the tool cannot preserve it; name that condition clearly and never present it as a finished branded mockup.

## Step 5 — Write prompts to `prompts.md`

Write or update `prompts.md` in the project root. If it already exists, preserve unrelated approved prompts and update only the mockup sections the user requested. Organize the file as:

1. Approved brief/file lock and attach-this-file list
2. Reference review table with five global and five Arabic sources, access/visual-inspection status, observations, transferable methods, and originality boundaries
3. One ready-to-paste prompt per selected touchpoint, each with an exact attachment manifest and direct “use uploaded image as reference” instructions for the logo, palette/design-system reference, and product artwork that apply
4. Open items, failed/inaccessible links, and the exact Agent Reach note when needed

Every prompt must specify one deliverable and, as relevant:

- Exact object, customer use, material, scale, and production method
- Exact approved logo file, logo variant, and position
- Exact approved hex colors and roles, including background/surface colors
- Exact uploaded filenames and an explicit role for every image/file reference; state that the uploaded logo and brand-system/palette reference must be used, not merely mentioned
- Composition, hierarchy, camera angle, lens/scale cues, lighting, crop, and aspect ratio
- Country/region and confirmed scene details for real-world settings
- Copy to include exactly, or blank space for later typesetting
- Negative constraints (no fake logo/text, invented claims, watermark, or unapproved design element)
- Image quality and brand-fidelity checks
- Which references informed the method without imitating their art direction

Do not add a new color, product variant, scene, label, or marketing claim without approval. A generated mockup is not evidence that packaging is manufacturable or that legal/regulatory text is correct.

## Rules

- Use exact approved hex codes; if a needed color is not locked, stop and ask.
- Never produce a mockup prompt whose only logo direction is an unanchored text description when an approved logo image exists. Name the exact file and instruct the image tool to use it as the logo reference and keep the mark visible.
- Treat visual fidelity as a requirement: ask the user to attach the logo and, when available, a palette/design-system board and actual product/package art. If only text palette values exist, repeat each exact HEX and role and label the palette board as unavailable instead of claiming it was attached.
- A blank/unbranded mockup is a fallback for unavailable assets or demonstrated generator limitations, not the default. Mark it provisional and specify how the real logo and system will be composited afterward.
- Never use national or cultural shorthand as a substitute for confirmed audience and setting details.
- Avoid touchpoints unrelated to the business's real service and customer journey.
- Do not generate image files unless the user explicitly requests them and an image-generation capability is available.
- Keep prompt contents in `prompts.md`; in chat, provide only questions, the brief approval summary, or a concise file-completion note.
