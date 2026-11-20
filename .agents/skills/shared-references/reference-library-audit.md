# Reference Library Audit — 16 November 2026

## Scope and counts

- Global library: 60 distinct listed projects. Twelve similar food/hospitality entries were replaced with references in aviation, fintech, higher education, healthcare, pet care, sport, museums, and real estate.
- Arabic-market library: 50 distinct Behance project IDs; all 50 entries now link to Behance project pages. The set is Egypt-led and covers 20+ sectors. It contains 40 Egypt-focused cases, 9 Saudi-market cases, and 1 Qatar event identity.
- Logo-design library: 27 distinct Behance project pages for logo guidelines, marks, wordmarks, color variants, and logo-derived patterns. The entries are a discovery shortlist, not a set of visually verified case studies.
- Two projects intentionally appear in both brand-design libraries: Design Doha and Summer 24. Across the three lists, do not add raw counts together as unique projects; de-duplicate by canonical project page where the libraries overlap.

## Research method and access status

Public web search and Behance-indexed project results were used to find and confirm project titles, direct page URLs, stated market/context, and text descriptions. The Agent Reach skill was used as the intended read-only access route, but its local command could not reach Behance in this environment because of DNS/network and local lock-file permission failures. Direct automated page opens also returned HTTP 403 for some Behance pages. Those outcomes are access blocks, not evidence of deleted projects, so they were not treated as broken-link confirmations.

**Visual inspection status:** the existing global and Arabic-market library audit recorded 0 direct page-level image inspections. The logo library was assembled using project metadata and image-search previews; its per-entry preview notes are explicitly provisional, and direct page-level inspection is pending. Search snippets, page text, titles, and image-module metadata do not count as direct visual inspection. Before using a reference to make detailed visual claims or to guide a brand prompt, open the actual project images with Agent Reach or another image-capable browser and record the visual inspection.

## Example source notes: observation vs interpretation

| Direct source | Observation from public project page/text | Interpretation for future review | Access in this audit |
|---|---|---|---|
| [Aether Airlines — Behance](https://www.behance.net/gallery/247355847/Aether-Airlines-Brand-Identity-Campaign-Design) | The creator describes an airline identity concept spanning aircraft, uniforms, cabin, airport, and campaign touchpoints. | A service brand can be studied as an end-to-end journey; visual consistency remains unverified here. | Search result surfaced; image inspection not completed |
| [IPS Fintech — Behance](https://www.behance.net/gallery/236051991/IPS-Fintech-Brand-Identity-Product-Design) | The page describes an identity and product communication system for payments and banking infrastructure. | Useful candidate for studying technical-product explanation once its visuals are inspected. | Search result surfaced; image inspection not completed |
| [The British University in Egypt — Behance](https://www.behance.net/gallery/193600825/The-British-University-In-Egypt) | The page describes a university identity project and names education and wayfinding in its project context. | A suitable education-sector precedent candidate; exact hierarchy and visual rules remain unverified. | Search result surfaced; image inspection not completed |
| [Hakbah App — Behance](https://www.behance.net/gallery/142073601/Hakbah-App-Visual-Brand-Identity) | The page describes a Saudi savings/fintech service and a brand/app project. | A useful Arabic-market fintech candidate; do not generalize from text alone to its look or adoption. | Search result surfaced; image inspection not completed |
| [PLDG Development — Behance](https://www.behance.net/gallery/243087517/PLDG-Development-Rebranding) | The page describes an Egyptian real-estate rebrand focused on trust and delivery. | Candidate for examining how positioning could affect real-estate communication, pending image inspection. | Search result surfaced; image inspection not completed |
| [Egytopia Travel — Behance](https://www.behance.net/gallery/240702621/Egytopia-Travel-Brand-Identity) | The page describes an Egyptian travel agency and an identity framed around trust and cultural travel. | Candidate for travel-service storytelling; specific imagery and symbols must be verified from the page. | Search result surfaced; image inspection not completed |
| [Tailz! — Behance](https://www.behance.net/gallery/233910265/Tailz-Pet-Care-Packaging-Branding) | The page describes pet-care identity and packaging for a creator-built brand project. | Candidate to broaden the global set beyond food and beauty; commercial status is not independently verified. | Search result surfaced; image inspection not completed |

## Maintenance decision

Keep the three canonical libraries unchanged during scheduled audits. The weekly job should write a dated proposal containing candidate sources, direct links, market/category, source-stated project status, de-duplication check, access status, and a clearly separated observation/interpretation. A maintainer reviews and approves the proposal before any entry is added, removed, or replaced. A 403, login wall, or network error must be recorded as blocked/inaccessible rather than “dead”; only a confirmed removed page or not-found response justifies a broken-link label.
