# Banner Sizes & Art Direction Styles Reference

## Common Design Canvases — Verify Before Export

These values are starting canvases for composition, not a guarantee of the current platform upload specification. Before a real deliverable, check the platform's official documentation for the exact product, placement, crop, file type, and limits. A social cover canvas, an ad-slot size, and an uploaded responsive-ad asset are different things.

### Social Media
| Platform | Type | Size (px) | Aspect Ratio |
|----------|------|-----------|--------------|
| Facebook | Cover (desktop) | 820 × 312 | ~2.6:1 |
| Facebook | Cover (mobile) | 640 × 360 | ~16:9 |
| Facebook | Event cover | 1920 × 1080 | 16:9 |
| Twitter/X | Header | 1500 × 500 | 3:1 |
| Twitter/X | Ad banner | 800 × 418 | ~2:1 |
| LinkedIn | Company cover | 1512 × 256 | ~5.9:1 |
| LinkedIn | Personal banner | 1584 × 396 | 4:1 |
| YouTube | Channel art | 2560 × 1440 | 16:9 |
| YouTube | Safe area at 2560 × 1440 recommended canvas | ~1544 × 423 | ~3.7:1 |
| Instagram | Stories | 1080 × 1920 | 9:16 |
| Instagram | Post | 1080 × 1080 | 1:1 |
| Pinterest | Pin | 1000 × 1500 | 2:3 |

### Web / Display Ads (Google Display Network)
| Name | Size (px) | Notes |
|------|-----------|-------|
| Medium Rectangle | 300 × 250 | Highest CTR |
| Leaderboard | 728 × 90 | Top of page |
| Wide Skyscraper | 160 × 600 | Sidebar |
| Half Page | 300 × 600 | Premium |
| Large Rectangle | 336 × 280 | High performer |
| Mobile Banner | 320 × 50 | Mobile default |
| Large Mobile | 320 × 100 | Mobile hero |
| Billboard | 970 × 250 | Desktop hero |

### Website
| Type | Size (px) |
|------|-----------|
| Full-width hero | 1920 × 600–1080 |
| Section banner | 1200 × 400 |
| Blog header | 1200 × 628 |
| Email header | 600 × 200 |

### Print
| Type | Size |
|------|------|
| Roll-up | 850mm × 2000mm |
| Step-and-repeat | 8ft × 8ft |
| Vinyl outdoor | 6ft × 3ft |
| Trade show | 33in × 78in |

## 22 Art Direction Styles

1. **Minimalist** — White space dominant, single focal element, 1-2 colors, clean sans-serif
2. **Bold Typography** — Type IS the design; oversized, expressive letterforms fill canvas
3. **Gradient / Color Wash** — Smooth transitions, mesh gradients, chromatic blends
4. **Photo-Based** — Full-bleed photography with text overlay; hero lifestyle imagery
5. **Illustrated / Hand-Drawn** — Custom illustrations, bespoke icons, artisan feel
6. **Geometric / Abstract** — Shapes, lines, grids as primary visual elements
7. **Retro / Vintage** — Distressed textures, muted palettes, serif type, halftone dots
8. **Glassmorphism** — Frosted glass panels, blur backdrop, subtle border glow
9. **3D / Sculptural** — Rendered objects, depth, shadows; product-centric
10. **Neon / Cyberpunk** — Dark backgrounds, glowing neon accents, high contrast
11. **Duotone** — Two-color photo treatment; bold brand color overlay on image
12. **Editorial / Magazine** — Grid-heavy layouts, pull quotes, journalistic composition
13. **Collage / Mixed Media** — Cut-paper textures, photo cutouts, layered elements
14. **Retro Futurism** — Space-age nostalgia, chrome, gradients, optimism
15. **Expressive / Anti-Design** — Chaotic layouts, mixed fonts, deliberate "wrong" composition
16. **Digi-Cute / Kawaii** — Rounded shapes, pastel gradients, pixel art, playful characters
17. **Tactile / Sensory** — Puffy/squishy textures, hyper-real materials, embossed feel
18. **Data / Infographic** — Stats front-and-center, charts, numbers as heroes
19. **Dark Mode / Moody** — Near-black backgrounds, rich jewel tones, high contrast
20. **Flat / Solid Color** — Single background color, clean icons, no gradients
21. **Nature / Organic** — Earthy tones, botanical motifs, sustainable brand feel
22. **Motion-Ready / Kinetic** — Designed for animation; layered elements, loopable

## Recently Verified Official Specifications

Checked 15 November 2026. These examples show how to record a current requirement; recheck the platform's official page when producing a new banner because specifications can change.

| Placement / asset | Current official value in the checked source | Source |
|---|---|---|
| YouTube channel banner | Minimum 2048 × 1152 px, recommended 2560 × 1440 px; text/logo safe area 1235 × 338 px at minimum canvas; file up to 6 MB | [YouTube channel branding help](https://support.google.com/youtube/answer/10456525?hl=en) |
| LinkedIn company page cover | 1512 × 256 px recommended; PNG/JPEG, maximum 3 MB | [LinkedIn Page image specifications](https://www.linkedin.com/help/lms/answer/a570368) |
| Google responsive display image assets | 1200 × 628 px landscape, 1200 × 1200 px square, 900 × 1600 px vertical recommended; 5120 KB max; Google may resize/combine assets | [Google Ads image guidelines](https://support.google.com/google-ads/answer/9823397?hl=en) |

Do not present those Google asset sizes as fixed display-ad slot dimensions. For other platforms or placements, search the relevant official help/advertiser documentation and store the URL and check date in the handoff.

## Design Principles

### Visual Hierarchy (3-Zone Rule)
- **Top**: Logo or main value prop
- **Middle**: Supporting message + visuals
- **Bottom**: CTA (button/QR/URL)

### Safe Zones
- Put critical copy and marks inside the safe area verified for the exact placement and crop preview.
- Do not apply a universal central percentage or edge inset; use the actual interface overlays and device behavior.
- YouTube's safe-area values depend on whether the calculation starts from the minimum or recommended canvas; preserve the official ratio and preview on TV, desktop, and mobile.

### CTA Rules
- One CTA per banner
- High contrast vs background
- Placement follows reading direction, visual hierarchy, and crop behavior; lower-right is one possible composition, not a rule.
- When the CTA is an interactive HTML control, maintain a comfortable accessible hit area; a flattened image CTA is not interactive.
- Action verbs: "Get", "Start", "Download", "Claim"

### Typography
- One or two families are a useful starting point; use more only when the brand system supports it.
- Test type size at the actual rendered scale, on the target device, and in the intended script.
- Aim for WCAG contrast for text when the image is used digitally; verify the final foreground/background pair rather than relying on visual intuition.
- Max 7 words/line, 3 lines for ads

### Copy Density
- Do not rely on the outdated universal “20% text” ad rule. Check the current policy and placement guidance.
- Social covers usually need a concise message because profile chrome and crops compete with the canvas.
- For print, size type to viewing distance and verify with the print vendor.

### Print Specs
- Resolution, bleed, trim, color profile, and viewing distance depend on the printer, substrate, size, and installation. Request the vendor's current production specification before final export.

## Pinterest Research Queries

Use these search queries on Pinterest for art direction references:
- `[purpose] banner design [style]` (e.g., "social media banner minimalist")
- `[platform] cover design inspiration` (e.g., "youtube channel art design")
- `creative banner layout [industry]` (e.g., "creative banner layout tech startup")
- `[style] graphic design 2026` (e.g., "gradient graphic design 2026")
- `banner ad design [product type]` (e.g., "banner ad design saas")

## Campaign Banner Prompt Blueprint

Replace every bracket with user-approved content or locked-brief values. Ask about missing facts rather than making them up. Use a separate image prompt for the background/illustration and keep text/logo editable in the final HTML.

“Create a [static / animated-frame] visual asset for a [placement and dimensions verified from official source] campaign for [brand and offer]. The target audience is [audience] in [country/region when a real-world context is shown]. Goal: [single communication goal]. Use [exact hex codes and roles copied from the locked brief] and the approved direction [type/imagery/graphic-device rules]. Composition: reserve [verified crop-safe area], keep [copy area] uncluttered, direct attention to [one focal product/idea], and leave [logo area] clear. Image subject: [specific subject, gesture, material, setting, and camera distance]. Match [lighting, contrast, texture, framing] to the brand and placement. Avoid rendered text, fake logos, invented UI, watermarks, extra products, and unapproved colors. Final headline, CTA, legal copy, and logo will be placed as real HTML/SVG assets after the image is generated.”

Before export, show the crop at the actual target view and verify every word, logo, safe margin, font, contrast pair, and file specification.
