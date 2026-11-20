# Logo Color Variant Specification

## Start with a palette table

| Color name | Exact HEX | Approved role | Logo element use | Background/surface use | Status |
|---|---|---|---|---|---|
| [name] | `#000000` | [role] | [mark/wordmark/accent] | [approved surface] | approved / proposed / unknown |

Do not fill a row from visual guesswork. If a file, role, or approval status is missing, leave it open and ask.

## Variant matrix

| Variant | Needed when | Specification |
|---|---|---|
| Primary full-color | Palette-approved brand use | Exact role per logo element; approved background; no added effects |
| Single-color | One-ink print, stamp, engraving, or low-cost use | One owner-approved color, exact background/knockout, preserve counters and minimum stroke |
| Reverse | Logo sits on a dark/colored approved surface | Exact approved light mark treatment and background; verify contrast and no edge loss |
| Low-color/production | Process limits inks or materials | Confirmed printer/process limit; do not guess separations or spot-color values |
| Digital dark/light | UI/avatar and variable backgrounds | Test actual smallest size, contrast and antialiasing; provide exact assets if available |

## Copy-ready color-study prompt skeleton

> Create a **logo color-study sheet**, not a new logo, for **[brand]**. Use the attached approved logo master **[exact filename]** as immutable artwork: do not redraw, retype, alter proportions, change letter spacing, add or remove components, or invent a new variant. Use only these approved identity colors: **[HEX — role]**, **[HEX — role]**, **[HEX — role]**. For each requested study **[variant list]**, show the mark on **[exact approved background HEX and role]**, with visible labels **[approved labels or no text]**. Keep every palette mapping explicit and separate alternatives in equal-size panels. If a variant has not been approved, label it “proposal—approval required” and do not imply it is canonical. Use **[ratio/page size]** with clear, neutral layout and adequate margins. Exclude unapproved colors, gradients, metallic effects, shadows, transparency, fake Pantone/CMYK labels, invented text, extra logos, and mockups that obscure the mark. Check exact source-logo fidelity, contrast, small-size readability, one-color reproduction, and spelling. If the image tool cannot preserve source artwork precisely, leave clean panels for the exact logo file to be composited manually.
