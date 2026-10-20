# Make the hero stripe match the DARB logo

## What changes
The thin rainbow stripe (under heroes, on the apply success screen and in the footer) currently uses six soft colours (blue, green, yellow, orange, pink, purple) that are not in the logo. It will be redrawn to mirror the logo mark itself:

```text
Logo:    ====== navy bar ======  (gold) (red) (purple) (teal)
Stripe:  [ navy  ~60%         ][gold][red][purple][teal]
```

- Navy takes the long first part, like the bar under "DARB".
- Then four equal segments in the logo's dot colours, in the same order: gold, red, purple, teal.
- Small gaps between the colour segments so they read as the logo's dots, not a blended rainbow.
- In Arabic/Hebrew the stripe mirrors, so navy starts on the right, just as the reading direction flips.
- The short accent underline beneath headings uses the same pattern.

## Logo colours (sampled from the logo file)
Navy #052462, gold #F5B300, red #C8262A, purple #6A45C2, teal #0597B0.

## Not changing
Where the stripe appears, its thickness, the rest of the colours on the site, and the dashboards.

## Verification
Screenshot the homepage hero, an inner page hero and the footer at phone and desktop sizes, in Arabic and English, and compare against the logo.

## Technical details
- `src/styles.css`: add `--darb-logo-navy/gold/red/purple/teal` tokens; rewrite `.darb-spectrum` gradient as hard stops (navy 0–60%, then 4 x 10% segments with 2px transparent gaps). Existing RTL `scaleX(-1)` rule stays. Old `--tint-*` tokens remain for other uses.
