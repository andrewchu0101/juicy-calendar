# Juicy Calendar — Design

Direction: **Juicy Minimalism**. The calendar stays calm; the things you touch feel alive.

## Hard rules

- Template balls are one flat colour: no gradients, gloss, glass, textures or inset highlights.
  An outer soft shadow is the only depth allowed. Enforced by an end-to-end test.
- Water droplets are separate flat shapes, shown only for the brief drop splash.
- No continuous decorative animation, with one exception: the hovered ball of the radial picker shows a
  same-colour wave running around its circumference (decided 2026-11-05, Q-05) and stops when the cursor leaves.
  `prefers-reduced-motion` turns all motion off, the wave included.
- Animation never changes geometry used for hit-testing or time calculation.

## Tokens

Defined in `src/app/index.css`.

| Token | Value | Use |
| --- | --- | --- |
| canvas | `#FBF8F3` | App background |
| surface | `#FFFFFF` | Calendar, cards |
| ink | `#2E2A26` | Primary text, selection outline |
| muted | `#8C857C` | Secondary text |
| line | `#EDE7DD` | Grid and borders |

Palette: Coral `#E98B87`, Peach `#E9B96E`, Sage `#A9C98D`, Sky `#83B9D0`,
Lavender `#9C91CE`, Pink `#E5A5BD`, Lemon `#D6C47B`, Mint `#83B9A7`.

Text on a coloured block is ink or white, whichever has the higher WCAG contrast.

## Motion

| Interaction | Animation | Duration |
| --- | --- | --- |
| Ball hover | Scale to 1.1 with overshoot | 160 ms |
| Ball drag | Stretch along the direction of travel, by pointer speed | live |
| Drop | Squash-and-stretch on the block, flat droplet splash | 320–420 ms |
| Resize / move | Block follows the pointer with no easing (precision first) | live |
| Selection | Ink outline and soft glow | 120 ms |

## Layout

Dropping a ball does not select the new block, and starting a ball drag clears the selection. The inspector
opens on click, so it never covers drop targets during repeated placement.

- Left: compact 104 px palette.
- Centre: the calendar, always at full width.
- Right: a floating inspector card that overlays the calendar. It deliberately does not push the
  grid: reflowing columns on selection would shift events under the pointer between the two clicks
  of a double-click, or at the start of a drag.

- Radial picker: 220 ms outward entrance; hit targets stay at final positions.
- Radial hover: a short same-colour arc (`.radial-wave`, 3 px ring, one turn per 1.1 s) circles the hovered ball; the ball stays flat
  and the ring takes no hits. Holding the button and leaving the ball picks it up.
- Invalid ball drops: 18 flat circular fragments disperse and fade over 560 ms.
- Half-hour lines are faint and dashed. The toolbar exposes the persistent 30 min magnet toggle.

- Event blocks in columns dated before the local current day retain 40% saturation.
  Today and future columns keep the original colour; cross-column segments follow their column date.
  Text contrast uses the displayed colour. Template balls and stored colours stay unchanged.
