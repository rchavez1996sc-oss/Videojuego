# Tierra Quemada — reglas del proyecto

TPS de mundo abierto para PC en navegador, calidad visual gama media (referencia: CS2 / Insurgency Sandstorm). Prohibido el look low-poly/arcade/mobile. Diseño completo en `docs/GDD.md` — leer solo las secciones necesarias para la fase en curso.

## Stack
- Cliente (`client/`): Vite + TypeScript + Three.js r170 (`WebGLRenderer`, WebGL2) + pmndrs/postprocessing + N8AO + Rapier (`@dimforge/rapier3d-compat`) + Web Audio.
- Servidor (`server/`, fase 9): Node + Fastify + SQLite (better-sqlite3).

## Reglas
- Contenido data-driven en `client/src/data/*.json`; el código no conoce capítulos concretos.
- Assets externos solo vía `client/public/assets/manifest.json`; originales sin procesar en `assets_src/` (Mixamo FBX, etc.). Créditos en `CREDITS.md`.
- Archivos < 300 líneas, un sistema por archivo. Sin comentarios obvios.
- Responder con código nuevo/cambiado + resumen ≤ 5 líneas. No reescribir archivos enteros por cambios puntuales.
- Cierre de fase: `npm run build` sin errores + `npm run shot` (capturas en `client/shots/`) + checklist.

## Estado
- Fase 1 (base técnica + look): hecha salvo personaje Mixamo (soldado provisional en `entities/mannequin.ts`).
- Fase 1.5 (optimización): terreno por chunks con LOD, rocas de menor detalle, pasto recortado (~10M → ~2,5M tris/frame).
- Fase 2 (combate): AKM data-driven (`data/weapons.json`), balística por raycast cámara→cañón, retroceso con patrón, dispersión, recarga, modos auto/semi, trazadoras, fogonazo, casquillos, decals y partículas por superficie (`world/surfaces.ts`), audio sintetizado con reverb de valle, HUD, blancos de práctica (`world/range.ts`), estamina/deslizamiento/aterrizaje, resolución dinámica.
- Movimiento: trepar/saltar por encima con Espacio (`entities/mantle.ts`), salto 6 m/s, estructuras de prueba data-driven (`world/structures.ts`: puesto de vigía con escalera, cajas). Siguiente: Mixamo (Fase 2.5) o Fase 3 (IA enemiga).
