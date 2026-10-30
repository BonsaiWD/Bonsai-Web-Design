# Hero bonsai: growth footage brief (AI video)

The hero prototype grows the juniper photo that's already on the site by
revealing it along its own branches. This brief is for the real footage that
will replace that stand-in. The code keeps the same timeline and particle
dissolve and reads the particles from the video's last frame.

Use: an atmospheric plate only. Never present it as client work or as a
photograph of the studio.

## Prompt

Paste this into the video tool (Veo, Kling, Runway or Sora). Generate several
takes and keep the one whose growth looks most natural.

> Locked-off studio shot, perfectly still camera, a single juniper bonsai in a
> shallow, unglazed dark stoneware pot, centered in frame, on a deep
> green-black seamless backdrop. Time-lapse of the tree growing: it starts as
> bare soil with a small twisted trunk, the trunk thickens and rises with
> natural taper and live bark, branches extend outward along graceful
> S-curves, and dense blue-green juniper foliage pads fill in from the inside
> out until the tree reaches a refined, cloud-pruned informal-upright form.
> One soft key light from the upper left with a faint warm bronze rim light
> from behind right; shadows fall off into black. Muted, film-graded colour,
> photographic realism, sharp detail, shallow depth of field kept on the tree.
> No people, no hands, no text, no camera movement, no zoom, no lens flares,
> no petals or leaves falling, no background changes.

Negative prompt (where the tool supports one): cartoon, illustration, CGI
look, plastic, oversaturated, neon, HDR, morphing, flicker, camera shake,
zoom, text, watermark, people, hands.

## Delivery spec

- 6 to 8 s of growth, then the finished tree held still for at least 1 s.
- Square or 4:5, at least 1440 px on the short edge (2160 px if the tool
  allows), 24 or 30 fps.
- Backdrop as dark and even as possible; it gets matted onto the page
  ground (#0F1410).
- The tree's base in the lower third and the canopy in the upper half, with
  room above the crown. The headline sits over the canopy.
- Send the highest-quality MP4 (or ProRes) the tool exports, plus a PNG of
  the final frame. I'll encode the web versions and keep them under budget.

## What changes in code when it arrives

- A muted, inline `<video>` (with its first frame as the poster) plays the
  growth on the same clock as the text.
- Its poster becomes the hero's LCP image, so the delayed headline stops
  counting against load speed.
- The particles are sampled from the final frame instead of the photo.
