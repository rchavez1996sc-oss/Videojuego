# Originales (no versionados)

Los FBX de Mixamo pesan demasiado para el repo: están en el Release `assets-v1` de GitHub.
Para regenerar los modelos del juego:

1. Descargar los assets del Release en `assets_src/mixamo/` (el .zip del Pro Rifle Pack descomprimido en `assets_src/mixamo/pack/` y el de Pistol Handgun Locomotion Pack en `assets_src/mixamo/pistolpack/`).
2. `cd client && node scripts/mixamo.mjs` (o `chars`, `anims`, o una clave de personaje).

Salida: `client/public/assets/characters/*.glb` (cerca + `.lod.glb` lejano) y `anims.glb`, listados en `client/public/assets/manifest.json`.
