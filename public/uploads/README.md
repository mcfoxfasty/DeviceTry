# Uploaded originals

Drop the **original, unedited** image files you want to use on the site into
this folder from the GitHub web UI (Add file → Upload files), then tell me the
filename and where it should appear.

## Why originals live here

The bytes that actually reach the browser are never the file you upload. I
take the original from this folder and produce optimised WebP derivatives in
`public/guides/` (or wherever the article needs them):

- three widths — 480, 768 and 1152 px
- WebP, quality ~78, which is where flat photographic detail starts to show
  visible artefacts
- a light and a dark variant for anything drawn, so a figure never glares on
  the dark theme
- an explicit `width`/`height` on the rendered `<img>` so the page does not
  shift while the bytes load

Keeping the original out of `public/` matters: anything in `public/` is served
verbatim, so a 4 MB JPEG dropped straight in would ship at full size to every
visitor. Once a file has been processed, say so and I will delete it here so
the repository does not keep carrying the full-resolution copy.

## Naming

Please keep the original's own name if it is already descriptive. Otherwise
something like this reads best:

```
microphone-not-working-hero-original.jpg
```

`{guide-or-page}-{what-it-shows}-original.{ext}`

The `original` suffix is what I look for when deciding what is a source file
rather than a generated derivative.

## What not to upload

Please do not upload anything here that is a screenshot of a tool result, a
meter reading, or a specific device you have not been asked to show. The site's
guides commit to never presenting invented evidence, and an image in this
folder is treated as a real, supplied asset.
