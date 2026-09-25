# Ulice Skalice

A realistic open-world browser game of Skalica (Slovakia) that you can walk and drive around in. It runs on three.js and uses only open data and CC0 assets.

## What's inside

- **Map data:** OpenStreetMap, the same data as the paper version. `tools/prep.py` turns it into `public/data/game.json.gz`.
- **Assets:** Poly Haven (CC0): 18 PBR material sets and 4 HDRI skies. `tools/fetch_assets.py` downloads and packs them.
- **Rendering:** three.js r180 with PBR materials, image-based lighting and a full day-night cycle, N8AO ambient occlusion, bloom and a filmic grade.
- **Generated in code:** buildings, roads, cars, people and trees are generated procedurally from the map data.

## Build

```bash
npm install
npm run assets   # optional, re-download Poly Haven assets
npm run build    # dist/index.html + dist/assets + dist/data
npm run serve    # http://localhost:8080
```

## Controls

| Key | Action |
|---|---|
| WASD | walk / drive |
| Shift | run / boost |
| F | get in or out of a car |
| Space | handbrake |
| M | map (click sets a destination, double-click teleports) |
| N | skip time |
| H | horn |
| R | radio |
| C | camera distance |
| Esc | menu |

## Credits and licences

- Map data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).
- Textures and HDRIs: [Poly Haven](https://polyhaven.com), CC0.
- `waternormals.jpg` comes from the three.js examples (MIT).
- Libraries: three.js (MIT), n8ao (MIT), postprocessing (Zlib).
- Car names and brands are fictional.
