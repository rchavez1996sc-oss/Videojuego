# Tierra Quemada: Crónicas de la Sierra

Shooter en tercera persona de mundo abierto para navegador (Three.js + Rapier).

- **Jugar:** https://rchavez1996sc-oss.github.io/videojuego/ (se publica solo en cada push a `main`).
- **Diseño completo:** [`docs/GDD.md`](docs/GDD.md) · **Reglas del proyecto:** [`CLAUDE.md`](CLAUDE.md)

## Controles
WASD mover · Shift correr · Ctrl/C agacharse · Espacio saltar · Clic derecho apuntar · Q cambiar hombro

Calidad gráfica por URL: `?q=low`, `?q=medium`, `?q=high` (por defecto), `?q=ultra`.

## Desarrollo
```bash
cd client
npm install
npm run dev      # servidor local
npm run build    # compilación de producción
npm run shot     # capturas automáticas en client/shots/ (Playwright)
```

## Assets
Originales sin procesar en `assets_src/` (personajes y animaciones de Mixamo, etc.). Créditos en [`CREDITS.md`](CREDITS.md).
