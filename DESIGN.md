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
2. **Colors** — seeds `#005A78` (deep cyan), `#AB7100` (deep amber), `#FFF8E7`
   (cosmic latte, light bg) and `#16161D` (eigengrau, dark bg). The site will be very
   symbolic; many more colors will arrive with project symbols and hyperlinks.
   *Open decision:* dark-scheme link/accent values are currently derived
   (`color-mix` toward cosmic latte) pending Shane's chosen hexes.
3. **Layout personality** — subtly ambitious: a two-dimensional, high-resolution but
   visibly pixelated **map** functioning as an asymmetrical grid. Areas linking to each
   section (projects, writings, music, …) carry assigned patterns and colors that bleed
   into one another across a gradient. Element positions to be decided later; this is
   the standing framework for layout development.
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
- Dark-scheme link/accent hexes (derived values in `tokens.css` marked DERIVED).
- Deep amber `#AB7100` measures 3.89:1 on cosmic latte — below the 4.5:1 WCAG-AA
  threshold for normal-size text (fine for large text and non-text uses). It is
  currently confined to hover states (underline persists) and selection. If amber
  ever carries standing text, Shane may want to pick a text-safe darker variant.
- Whether body prose commits fully to the pixel grid (`--font-body` token).
- Everything in brief items 3–4 (map geometry, section patterns/colors, symbol motif).
