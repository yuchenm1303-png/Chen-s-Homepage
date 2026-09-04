# Galaxy Homepage Lab

This directory is an isolated composition prototype for the `feat/galaxy-homepage-redesign` branch. It does not replace the existing homepage.

## Current intent

The galaxy is treated as the spatial backbone of the future homepage rather than as decorative wallpaper. The first prototype intentionally includes the major UI surfaces so the field can be judged together with real layout pressure.

- Hero copy stays in a quiet left-side zone.
- The dense galaxy stream is biased toward the right side of the first viewport.
- Selected Work deliberately places primary glass surfaces across the star stream.
- About / Now, Writing and Contact progressively reduce information density.
- Primary, secondary and micro glass tiers are already separated so V29.5 optics can be introduced selectively later.

## Galaxy renderer

`galaxy.js` is a custom WebGL2 point-field renderer with no external library dependency.

Field composition:

- 5,000 far background stars
- 4,300 primary-stream stars
- 1,450 secondary-filament stars
- 620 soft haze particles
- 650 mid-brightness structural stars
- 52 bright stars
- 8 manually placed hero stars

The main stream uses hand-authored Catmull-Rom control points plus a separate secondary filament. A probabilistic dust lane removes particles from a moving band inside the primary stream so the galaxy does not read as a uniformly bright ribbon.

Star appearance intentionally avoids Astra's symmetric cross-shaped bright-star language. Bright stars use soft circular cores, halos and a restrained randomized photographic streak.

Interaction is also intentionally different: mouse movement produces subtle depth parallax and a weak local dust disturbance, while scroll behaves like a restrained camera drift rather than global galaxy rotation.

## Glass integration path

The current cards use CSS backdrop blur only as a composition placeholder.

The planned optical path is:

1. Render galaxy into a shared GPU render target.
2. Feed that texture to a page-level glass compositor.
3. Port the V29.5 unified-perimeter mapping / body refraction / shoulder / Fresnel model into that compositor.
4. Use strong refraction only on `data-optics="primary"`, weaker refraction on `secondary`, and CSS-only treatment for micro glass.
5. Keep text/content in DOM above the optical pass.

The design goal is one galaxy renderer + one shared glass compositor, not one WebGL canvas per card.
