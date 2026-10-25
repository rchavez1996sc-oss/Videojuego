# Originales (no versionados)

Los FBX de Mixamo pesan demasiado para el repo: están en el Release `assets-v1` de GitHub.
Para regenerar los modelos del juego:

1. Descargar los assets del Release en `assets_src/mixamo/` (el .zip del Pro Rifle Pack descomprimido en `assets_src/mixamo/pack/` y el de Pistol Handgun Locomotion Pack en `assets_src/mixamo/pistolpack/`).
2. `cd client && node scripts/mixamo.mjs` (o `chars`, `anims`, o una clave de personaje).

Salida: `client/public/assets/characters/*.glb` (cerca + `.lod.glb` lejano) y `anims.glb`, listados en `client/public/assets/manifest.json`.

Mascotas (Sketchfab, subidas al Release `assets-v1` como `dog-animated.zip` y `cat.zip`): descomprimir en `assets_src/pets/dog/` y `assets_src/pets/cat/`, luego `cd client && node scripts/pets.mjs` → `client/public/assets/pets/{dog,cat}.glb` (perro: toma partida en `walk` 0–1,33 s e `idle` 1,4–5,37 s).
