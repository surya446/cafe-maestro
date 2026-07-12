---
name: Android launcher icon source-of-truth
description: How the Cafe Maestro Android icon was built from a single flattened logo screenshot, for future icon updates.
---

The official icon source is a small (170x166) flattened screenshot showing the full design
(rounded-square dark-brown background #251F13 + golden coffee-cup glyph) baked into one image —
not separate layers.

**Why it matters:** Android adaptive icons need background and foreground as separate layers, or
the background gets double-drawn / the system mask crops unpredictably. To convert a single
flattened logo into a correct adaptive icon: (1) trim to the tight bounding box of the artwork,
(2) sample the flat background fill color for the adaptive `background` color resource, (3) use
`-fuzz N% -transparent "<bg color>"` to strip the background and isolate the glyph on transparent
for the `foreground` mipmap layers, (4) place the glyph on a transparent canvas scaled to 72/108
of each foreground canvas size (Android's standard safe-zone ratio) to avoid clipping under
circle/squircle masks.

**How to apply:** Legacy `ic_launcher.png`/`ic_launcher_round.png` can use the flattened original
image directly (upscaled with Lanczos if the source is low-res) since those are pre-shaped assets;
only the adaptive-icon mipmap set needs the fg/bg split described above. Values color resource:
`res/values/ic_launcher_background.xml`.
