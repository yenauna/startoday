# Asset Organization

Use the shared project convention from `../../brand-presentation/references/page-structure.md`. Keep the folder structure small enough to use without a build tool or asset database.

## Recommended project structure

    /project-name/
      AGENTS.md or brief.md
      /assets/
        /logo/       approved logo masters and variants
        /mockups/    approved presentation/mockup images
        /banners/    final banner exports, if requested
        /source/     licensed fonts or editable originals, if applicable
      /output/
        brand-presentation.html
        /banners/    standalone HTML or campaign outputs, if requested
      /archive/      superseded drafts, only when the user wants version history

Do not create empty directories or a manifest when the project does not need one. Keep draft and approved files clearly separated so no one mistakes a generated concept for a final logo.

## Naming files

Use a stable, readable name that communicates brand, asset, variant, and version when needed:

    [brand]-[asset]-[variant]-[version].[ext]

Examples:

- `northstar-logo-primary-approved.svg`
- `northstar-logo-icon-dark-v02.png`
- `northstar-mockup-coffee-bag-approved.webp`
- `northstar-banner-instagram-story-v03.html`

Use lowercase kebab-case for new files. Keep the user's existing naming system if one is already in place.

## Record provenance and approval

For important deliverables, record in the project brief or a small `assets/README.md`:

- Relative path and asset name
- Draft / review / approved / superseded status
- Creation date and source (user-provided, designer-created, or generated concept)
- Which prompt/brief version informed an AI-generated concept, where useful
- Approver and approval date when supplied
- Current platform/print requirements and source link when relevant

Keep only enough metadata to prevent mistakes. Do not invent an approver, license, asset dimensions, or client permission.

## Version handling

- Keep approved files stable and refer to the active version in `AGENTS.md`/`brief.md`.
- Save a new version when an approved file changes; explain the change briefly.
- Archive drafts only when comparison or rollback is useful. Never silently replace a user-provided master.
- Remove duplicates only after confirming which file is the active approved source.
- Keep original assets intact when making exports or composites.

## Before sharing a presentation

- Confirm every relative image path resolves from the HTML file's actual location.
- Confirm each image is the intended version and can be displayed locally.
- Keep original editable files and web/print exports distinct.
- Record any network-only font, external image, or licensing dependency.
