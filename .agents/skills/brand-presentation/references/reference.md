# Reference Instructions — `brand-presentation`

Read this file, `../../shared-references/research-reference-standard.md`, `page-structure.md`, `visual-direction.md`, `technical-spec.md`, and `build-prompt.md` before designing the presentation prompt. Default output is a coding-agent prompt; build the standalone HTML only when the user explicitly requests it.

**Approval gate:** Inspect the available project files read-only, ask only missing questions that could change story, sections, audience, language, assets, or prompt-versus-HTML output, and wait for the user to confirm scope before case-study research, prompt drafting, HTML execution, or edits.

## Ask only presentation-defining questions

Inspect existing approved brief, logo, identity assets, mockups, copy and project folder. Ask which case-study story the page must tell; which sections/assets are approved; who will view it; whether the user wants a prompt or actual HTML; target path; preferred language; any missing actual images; and which stage approvals must appear. Do not ask the user to restate colors/type if the identity file contains them. Don't invent mockup or case-study content to fill gaps.

## Study real case-study presentations

Inspect at least five distinct real identity presentations/case-study pages and their actual image sequences. Choose by target audience and market, including Arabic/RTL page examples when relevant. Examine narrative sequence (brief → concept → system → application), section scale, rhythm/whitespace, logo and color display, image/caption balance, typography hierarchy, transitions, responsive reading order and the amount of explanation per visual. Note which details are the source's distinctive artwork and must not transfer. Do not use another case study's section sequence or composition verbatim.

## Evidence-to-structure routes

- **Story/case-study page** → evidence-backed narrative order and process explanation; use only actual user-approved facts.
- **Portfolio/award presentation** → emphasize challenge, approved solution, system proof, applications and credits; never invent client results or performance data.
- **Arabic/bilingual case study** → define RTL reading order, script hierarchy and responsive behavior; never rely on browser auto-direction without checking it.
- **No mockups or images supplied** → ask whether to omit the section, use a specified placeholder, or wait for assets. Don't fabricate product images or content.
- **HTML requested** → one standalone HTML/CSS/vanilla JS file, no framework/build step, exact asset paths, accessibility, responsive/overflow checks, local-open instructions. If only a prompt is requested, do not execute it.

## Prompt acceptance criteria

Name each supplied asset and its role, approved order and section content, type/color values, motion/interaction only if requested, ratio and responsive breakpoints, accessible headings/alt text, allowed and excluded copy, asset integrity, and review steps. Make each visual large enough to evaluate. Never ask CSS or image generation to redraw an existing logo. Don't claim responsive, accessibility, or rendering checks ran unless they did.
