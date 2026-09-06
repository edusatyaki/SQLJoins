# How a JOIN actually works

An interactive, keyboard-driven deck that walks through PostgreSQL joins and set
operations **one comparison at a time**, with a three.js stage where depth carries
the meaning: source rows sit on a back plane, and rows that satisfy `ON` fly
**forward** onto the result plane.

Built as a companion to the Lecture 8 class notes.

## Controls

| Key | Action |
| --- | --- |
| <kbd>&rarr;</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd> | Next step |
| <kbd>&larr;</kbd> <kbd>PgUp</kbd> | Previous step |
| <kbd>&darr;</kbd> / <kbd>&uarr;</kbd> | Skip a whole slide |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last step |
| <kbd>F</kbd> | Fullscreen (or the **Full** button in the top bar) |
| <kbd>?</kbd> | Key reference |

Swipe left/right on touch devices. The current step is written into the URL
(`#inner/2`), so you can link straight to any moment in the deck.

## What it covers

1. The dataset, and the two rows planted in it on purpose
2. Why two `SELECT`s and a scalar subquery both fail
3. **`ON`, evaluated pair by pair** — all 12 comparisons, one keypress each
4. `INNER` / `LEFT` / `RIGHT` / `FULL OUTER` — the four keep-rules, each with a
   Venn diagram of the regions it keeps alongside the actual rows
5. **Self join** — the same table under two aliases, shown as two columns of the
   same rows with the referral links drawn between them
6. The Cartesian product trap
7. `WHERE` vs `ON`, and how `WHERE` silently downgrades a `LEFT JOIN`
8. `UNION` / `UNION ALL` / `INTERSECT` / `EXCEPT`
9. Recap

## Running locally

The deck uses ES modules, so `file://` will not work — you need any static
server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Publishing to GitHub Pages

1. Create a repository and push this folder's contents to it:

```bash
git init && git add . && git commit -m "Interactive JOIN deck"
git branch -M main && git remote add origin git@github.com:USER/REPO.git && git push -u origin main
```

2. On GitHub: **Settings → Pages → Source: Deploy from a branch**, branch `main`,
   folder `/ (root)`. Save.
3. The site appears at `https://USER.github.io/REPO/` within a minute or two.

All paths are relative, so it works from a project subpath without changes.
`.nojekyll` is included so GitHub serves the files as-is.

## The SQL

[`joins.sql`](joins.sql) is the whole lesson as one runnable script — schema,
seed data, and every query in the deck with its real output in the comments.

```bash
psql -d yourdb -f joins.sql
```

Verified end to end on PostgreSQL 16: it runs clean, and every result written
in a comment is the actual output of that query against the seed data.

## Files

```
index.html        markup and the three.js import map
css/styles.css    single committed dark "stage" theme
js/data.js        the dataset (no dependencies)
js/slides.js      all deck content: slides, steps, SQL, expected rows
js/scene.js       the three.js stage
js/main.js        state machine, keyboard, URL sync, panel rendering
```

Venn diagrams are inline SVG with the regions masked from the two circles at
render time, so any combination of left / intersection / right is drawn from a
one-line spec rather than from four fixed images.

three.js is loaded from a pinned CDN build via an import map. If it fails to
load, the deck detects it and continues in text-only mode rather than breaking.
