# Design brief — shanesparks.com

Decisions by Shane (2026-07-06). This file is the durable record; `src/css/tokens.css`
implements it; `/styleguide/` renders it.

## Philosophy: truth to mediums

Analogous to truth to materials: something on a digital medium should be inherently
digital in its expression and appearance, and should not present as another aesthetic.
The site is holistic, honest expression through its medium. No depiction of anything
that exists in physical reality — only the abstract. Pages should evoke environments
the way music does. **Use this to resolve any design ambiguity.**

## Decisions

1. **Typefaces** — inherently pixelated, quantitative quality; not campily retro or
   arcadey. Implemented: **Departure Mono** (display/labels/code) + **Space Grotesk**
   (body prose). Alternatives on file in `/styleguide/`; swapping is one woff2 + one token.
2. **Colors** — seeds `#005A78` (deep cyan), `#75D1D9` (bright cyan), `#AB7100`
   (deep amber), `#FFF8E7` (cosmic latte, light bg) and `#16161D` (eigengrau, dark bg).
   Rules (clarified 2026-07-06): non-link text is always eigengrau on cosmic latte or
   the inverse; links are deep cyan on cosmic latte and bright cyan on eigengrau; the
   cyans and amber are **highlights** — text never sits on them; amber may be text on
   cosmic latte only, never on eigengrau. The site will be very symbolic; many more
   colors will arrive with project symbols and hyperlinks.
3. **Layout personality** — subtly ambitious: a two-dimensional, high-resolution but
   visibly pixelated **map** functioning as an asymmetrical grid. Areas linking to each
   section (projects, writings, music, …) carry assigned patterns and colors that bleed
   into one another across a gradient. Element positions to be decided later; this is
   the standing framework for layout development.
   *Implemented v0 (2026-07-06):* homepage centerpiece grown from a seeded cellular
   automaton (`src/js/pixelmap.js`), one region (Projects), whole area links to
   `/projects/` with a real-text label; pixels are a mixture of the two cyans with
   amber glints in dense cores (Shane's spec), identical in both schemes; pointer
   proximity displaces cells with spring-back, disabled under reduced-motion; no-JS
   fallback is a quantized checker with the label link still functional. Structure
   is the deliverable — visual tuning and subsections are placeholders for Shane.
   *Revised per Shane (2026-07-06):* the field is a filled, patterned disc (angular
   lobes × spiral ripple, soft boundary) at 128×128 rather than a perimeter ring;
   glints use a map-local brightened amber `#E69800` (seed amber ×1.35 — it read
   brown at pixel scale) held near full alpha.
4. **Signature element** — baked into the layout; a recurring motif of symbols in a
   digital landscape / cyberspace. Exploit the medium maximally; each page corresponds
   in vivid style to its content's "environment."
5. **Type scale & rhythm** — modest; distinction without excess. Ratio 1.2.
6. **Links** — intuitive to find, in line with the vision. Currently: deep cyan,
   2px underline, amber on hover.

## Standing process rule

All aesthetic choices are made by Shane firsthand. Implementation may propose and
placeholder, but must flag open decisions rather than silently deciding them.

Open decisions currently flagged:
- Whether body prose commits fully to the pixel grid (`--font-body` token).
- Everything in brief items 3–4 (map geometry, section patterns/colors, symbol motif).

Measured facts on record (not blockers): deep amber is 3.89:1 on cosmic latte — under
the 4.5:1 AA threshold for normal-size text, though Shane permits it as text there;
currently it appears only as hover underlines. Bright cyan is 10.18:1 on eigengrau;
deep cyan is 7.26:1 on cosmic latte; amber as decoration on eigengrau is 4.37:1
(passes the 3:1 non-text minimum).
