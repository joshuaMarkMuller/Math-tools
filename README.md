# Year 9 Maths Toolkit

A collection of interactive maths tools for a Year 9 classroom. Plain HTML, CSS and
JavaScript — no build step and no server code — so it runs on Render's free static hosting.

## Tools

| Tool | Folder | Status |
|---|---|---|
| Quadratic Plotter | `public/quadratic/` | Ready |
| Tools 2–6 | — | Coming soon |

## Project layout

```
public/
  index.html            ← home page listing every tool
  assets/styles.css     ← shared styles used by every tool
  quadratic/
    index.html
    quadratic.js
render.yaml             ← Render deployment settings
```

## Run it on your own computer

Open `public/index.html` in a browser, or for a proper local server:

```
cd public
python -m http.server 8000
```

then visit http://localhost:8000.

## Deploy to Render

1. Put this folder in a GitHub (or GitLab) repository.
2. In Render, choose **New → Blueprint** and select the repository.
   Render reads `render.yaml` and creates a static site automatically.
   *(Or choose **New → Static Site**, leave the build command empty and set the
   publish directory to `public`.)*
3. Every push to the repository redeploys the site.

## Adding a new tool

1. Create a folder in `public/`, e.g. `public/pythagoras/`, with its own `index.html`.
2. Link `../assets/styles.css` for the shared look and include the same header with the
   "← All tools" link.
3. On `public/index.html`, replace one of the "Coming soon" cards with a link to the new folder.
