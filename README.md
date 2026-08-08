# OLS Plotter

A single-page PWA that draws obstacle limitation surfaces over satellite imagery for
**multi-runway** aerodromes, with every dimension editable by category.

Open `index.html` from any static web server (or install it to a home screen). No build step,
no API keys — imagery comes from Esri World Imagery raster tiles and the map engine is
MapLibre GL JS from a CDN.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: UI, ruleset tables, geometry engine, map |
| `sw.js` | Service worker — caches the shell and recently viewed tiles for offline use |
| `manifest.webmanifest` | Install metadata |
| `icon-192.png`, `icon-512.png` | App icons |

Serve over `http://` or `https://` for the service worker to register. From `file://` the app
still runs; it just won't install or work offline.

## What it draws

Per runway end: approach surface (up to three sections), inner approach, transitional,
inner transitional, balked landing, take-off climb. Aerodrome-wide: inner horizontal and
conical.

Three rulesets ship in the box, switchable at the top of the Runways tab:

- **ICAO Annex 14 (current)** — Tables 4-1 / 4-2, keyed to code number 1–4 and approach type.
- **ICAO Annex 14 Amendment 18** — keyed to Aeroplane Design Group I–V. Applicable
  21 Nov 2030; treat as a preview and verify against the published amendment.
- **FAA 14 CFR Part 77** — imperial, keyed to utility/non-utility and approach precision.

## How the multi-runway parts work

**Inner horizontal and conical are aerodrome-wide, not per runway.** The engine collects the
disc about every runway strip end (radius from that runway's dimensions) and takes the
**convex hull** of those discs. That is exactly the "swing arcs from each runway end and join
adjacent arcs with tangent lines" construction in 14 CFR 77.19(a)(4), and it makes small arcs
enveloped by tangents between larger ones drop out automatically. The conical surface is the
same hull offset outward by `conicalHeight / conicalSlope`.

**Where surfaces overlap, the lowest governs.** Tap anywhere on the map and the readout lists
every surface covering that point, sorted by height, with the governing one highlighted. Type
an object elevation and it tells you the margin. This is the lower-envelope rule from ICAO
Doc 9137 Part 6 applied pointwise, and it is what makes crossing and parallel runway
configurations behave correctly without any special-casing.

## How the geometry is represented

Everything reduces to **planar facets**: a polygon in a local tangent-plane projection
(metres, referenced to the mean of all runway ends) plus a plane `z = a·x + b·y + c`.

Surfaces are built in a local frame and then transformed once:

- **End frame** — origin at the threshold, `+s` outward along the extended centreline,
  `t` lateral. Used for approach, inner approach, balked landing (negative `s`), take-off climb.
- **Runway frame** — origin at pavement end A, `u` along the centreline, `v` lateral.
  Used for the strip and for transitional / inner transitional, whose lower edge and
  height both vary linearly with `u`, keeping each segment planar.

For a facet built at origin `O` with orthonormal axes `ex`, `ey` and a local plane
`z = A·s + B·t + C`, the world plane is:

```
a = A·ex.x + B·ey.x
b = A·ex.y + B·ey.y
c = C − O.x·a − O.y·b
```

## Known simplifications

- Local tangent-plane projection about the aerodrome; error grows past roughly 50 km.
- Centreline elevation is interpolated linearly between thresholds, so a curved runway
  profile is approximated.
- The transitional lower edge follows the outer of the strip edge and the approach splay.
- Inner transitional and balked landing surfaces are capped at the inner horizontal height.
- Take-off climb inner-edge elevation uses the runway end elevation rather than a surveyed
  high point in the clearway.
- Approach surfaces are straight; offset and curved approach tracks are not modelled.
- PANS-OPS / Doc 8168 procedure surfaces are a different thing and are not included.

This is a planning and visualisation aid, not a certified obstacle assessment.

## Data in and out

The **Data** tab exports the drawn surfaces as GeoJSON (each polygon carries `t`, `label`,
`zmin`, `zmax`, `slope`) and the full configuration as JSON, which can be re-imported.
The sample aerodrome uses approximate coordinates — replace them with survey data.
