# Cummins Ferry Storybook — Choose Your Own Adventure

A tiny, whimsical trip guide that plays like a storybook for ages **4–80**. It follows your stay at **Cummins Ferry RV Park + Campground** and gently suggests what to do next — coffee, breakfast, history, trails, river views — while keeping the tone light and the UI friendly.

## Highlights
- **Story engine** that spans your whole trip (set start & end dates in **Settings**).
- **Dynamic choices** each chapter; morning coffee/breakfast uses live data from **OpenStreetMap (Overpass)** near your GPS (or the campground).
- **Procedural “AI-style” images** (SVG) on every page in a whimsical storybook style — no API keys.
- **Distance labels** computed from your phone’s GPS.
- No frameworks or build steps — one small, static web app.

## Local use
Open `index.html` in your browser (or host the folder on GitHub Pages).

## Notes
- If Overpass rate-limits, wait a moment and try again.
- You can switch **Distance origin** between *GPS* and *Campground* in Settings.
- Landmarks included: Shaker Village of Pleasant Hill, High Bridge Overlook, Tom Dorman State Nature Preserve.
