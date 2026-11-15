# Modelo de prompt — revisión y depuración completa de *Tierra Quemada*

Cópialo entero (o solo las secciones que te interesen) y reemplaza lo que está entre `<…>`. Funciona mejor si
adjuntas capturas o videos del problema y dices en qué capítulo, en qué punto y con qué calidad ocurrió.

---

## 0. Contexto y reglas

> Trabaja en `/home/user/videojuego` (cliente en `client/`). Lee `CLAUDE.md` antes de tocar nada y respeta sus reglas:
> archivos < 300 líneas, un sistema por archivo, contenido en `client/src/data/*.json`, assets solo vía
> `public/assets/manifest.json`, `npm run build` sin errores, una línea en `CLAUDE.md` por cambio, commit y push
> después de cada cambio. Respóndeme en español y en corto.
>
> Objetivo de esta sesión: **<describe el objetivo: p. ej. “que el cap. 2 cargue en < 15 s y corra a 60 FPS en MEDIA
> sin perder calidad visual”>**.
>
> Prioridad: 1) que nada se rompa ni se congele, 2) rendimiento (carga y FPS), 3) realismo, 4) contenido nuevo.
> Si algo de esta lista no aplica o ya está bien, dilo y sigue. No me preguntes lo que puedas medir tú mismo.

## 1. Cómo quiero que trabajes

1. **Mide antes de cambiar.** Para cada problema da el número antes y después (ms, MB, FPS, llamadas de dibujo,
   triángulos, vida perdida, etc.). Usa las herramientas que ya existen:
   - Carga: `window.__loadLog` (tiempo por fase) y `scripts/_loadt.mjs <caps>`; bytes descargados por capítulo.
   - Cuadro: línea de stats (`fps`, `cpu N ms`, `err`), `__game.info()`, `drawTally(vista)`, `drawStats()`,
     `breakdown()`, `programs()`, `profile`.
   - Juego automático: `node scripts/playtest.mjs <cap> <partidas> <segundos> <tramo>` (errores de consola, muertes,
     atascos, caídas bajo el terreno).
   - Capturas: `__game.setView(i)`, `__game.look(x,y,z, lx,ly,lz)`, `npm run shot`.
2. **Reproduce el fallo** con un hook de depuración (o crea uno en `core/debug*.ts`) antes de arreglarlo, y vuelve a
   correrlo después para probar que quedó resuelto.
3. **Arregla la causa, no el síntoma.** Si un valor “mágico” tapa el problema, explica por qué existe.
4. **No bajes la calidad visual para ganar FPS** sin decírmelo: primero busca trabajo desperdiciado (cosas que se
   dibujan, animan, simulan o descargan sin verse ni usarse).
5. Al final: tabla “problema → causa → arreglo → medición”, lo que quedó pendiente y por qué.

## 2. Carga de los capítulos

- [ ] ¿Cuánto tarda cada fase (`__loadLog`)? ¿Qué se descarga (MB por tipo: personajes, autos, modelos,
      texturas, murales, HDRI) y qué de eso no se usa en este capítulo?
- [ ] Caché: cada asset con huella de contenido (`?v=` de `virtual:asset-hashes`); que nada fuerce volver a bajar
      todo. ¿Algún `fetch` con `no-store` innecesario?
- [ ] Tamaño de assets: texturas 2K donde 1K basta, KTX2/Basis para texturas de personajes y autos, mallas con
      `gltfpack` (simplificación, cuantización, meshopt), audio pregenerado que se pueda generar más tarde.
- [ ] Trabajo de CPU al construir el nivel: `Builder.build`, horneado, grafo de calles, coberturas, murales
      (rayos por pared), extras (`crowd`), minimapa. ¿Qué se puede diferir a después del primer cuadro o repartir
      en varios cuadros sin tirones?
- [ ] Shaders: número de programas (`programs()`), compilación en paralelo (`compileAsync`), materiales que
      generan variantes innecesarias.
- [ ] Prólogo: que la carga corra mientras se lee, sin tirones en la máquina de escribir.
- [ ] Meta: **<p. ej. < 15 s en una conexión de 50 Mb/s con caché vacía, < 6 s con caché>**.

## 3. FPS y fluidez

- [ ] ¿El límite es CPU o GPU? (`cpu N ms` frente al tiempo de cuadro).
- [ ] GPU: llamadas de dibujo por pasada (color, sombras, AO, DOF), triángulos, sobre-dibujo de transparencias
      (pasto, humo, follaje, vidrio), resolución de sombras y cascadas, AO, bloom, nitidez, profundidad de campo.
- [ ] CPU: simulación por sistema (IA, civiles, tráfico, física Rapier, huesos/mezcladores de animación, extras,
      palomas, basura al viento, cables), consultas de rayos por cuadro, recolección de basura (objetos creados en
      bucles: `new THREE.Vector3` por cuadro).
- [ ] LOD y distancias: personajes, autos, vegetación, letreros, objetos instanciados; frustum culling por
      baldosas; animación a menor frecuencia lejos.
- [ ] Tirones (stutter): primera vez que aparece un material/efecto (compilación), carga perezosa, GC, picos de
      física. Mide el peor cuadro, no solo el promedio.
- [ ] Calidad BAJA / MEDIA / ALTA: qué cambia cada una y que el cambio en caliente funcione.
- [ ] Meta: **<p. ej. 60 FPS estables en MEDIA en una GPU tipo GTX 1060 / Iris Xe; peor cuadro < 33 ms>**.

## 4. Física y vehículos

- [ ] Choques: daño por evento (no por cuadro), según cambio de velocidad, ángulo (frontal/lateral/trasero),
      masa y tipo; que un roce o un sardinel no maten ni inutilicen; que un choque fuerte sí.
      Prueba con `crashTest(tipo, x, z, rumbo, kmh)` a 20/35/50/65/90 km/h y contra otro auto.
- [ ] Conductor: daño solo en impactos serios; motos y mototaxis más expuestos.
- [ ] Manejo: aceleración, punta, frenada, derrape, giro por tipo (`SPECS`, `accelTest`); sardineles y veredas
      (`curbTest`); vuelcos; salir del auto siempre (E, saltar en marcha, auto volcado).
- [ ] Choques entre autos: reparto por masa, giro, abolladuras sin picos, piezas (puertas, ruedas) en su sitio.
- [ ] Atropellos: el cuerpo sale despedido a la velocidad correcta, no atraviesa paredes ni el auto.
- [ ] Explosiones de autos: cuándo, daño alrededor, sin bajas civiles falsas.
- [ ] Personajes: sin hundirse, flotar ni atravesar paredes; trepar, saltar, escaleras, caídas.
- [ ] Objetos sueltos, granadas, cadáveres: reposo estable, sin temblar ni atravesar el suelo.

## 5. Sonido

- [ ] Choques: golpe seco para toques, choque completo para impactos, roce continuo al arrastrarse, vidrio,
      chatarra; volumen y filtro según distancia; sin repeticiones en ráfaga.
- [ ] Armas, explosiones, pasos por superficie, motor por revoluciones y carga, ambiente de ciudad.
- [ ] Nada de tonos “musicales” accidentales, chillidos agudos ni clics; mezcla equilibrada (nada tapa los
      disparos ni los avisos).
- [ ] Rendimiento de audio: nodos que se crean sin parar, fuentes en bucle que nunca se detienen.

## 6. IA y personas

- [ ] Policías: patrulla, alerta, cobertura, flanqueo, asomarse, puntería por dificultad; que no se atasquen ni
      caminen en círculos (`npcWalk`, `route`, `enemyInfo`).
- [ ] Escuadra: formación, fuego, derribo y reanimación, no subirse a autos.
- [ ] Civiles y extras: recados, huida, esconderse, reacción al arma, atropellos; bajas civiles solo del jugador.
- [ ] Animales, tráfico NPC, semáforos.

## 7. Visual y realismo

- [ ] Texturas fotográficas coherentes en todo (sin superficies de color plano), escala correcta, sin repetición
      evidente, desgaste creíble.
- [ ] Z-fighting/parpadeos, objetos flotando o enterrados, huecos en el terreno, grietas entre piezas.
- [ ] Luz: día/atardecer/noche, alumbrado público, bloom sin paredes que brillen, sombras sin saltos.
- [ ] Comparación con referencias reales (Street View / fotos): **<lugar a comparar>**.

## 8. Interfaz y sensación

- [ ] HUD legible, avisos que no se pisan, mapa y minimapa correctos, pausa y menús.
- [ ] Retroalimentación (“dopamina”) sin puntaje: marcador de impacto, registro de bajas, rachas, sonidos de
      recoger, objetivo cumplido; moderada.
- [ ] Muerte, reaparición, misión fallida/completada, paso al siguiente capítulo.

## 9. Robustez

- [ ] Errores de consola en carga y en 10 minutos de juego automático por capítulo (`playtest.mjs`).
- [ ] Ningún error de un sistema congela el cuadro (`safely`); el último error visible en stats.
- [ ] Memoria estable en sesiones largas (texturas, geometrías y nodos de audio liberados).

## 10. Formato de entrega

- Commits pequeños por tema, con `CLAUDE.md` actualizado.
- Resumen final ≤ 15 líneas: qué cambió, cifras antes/después, qué no se pudo y qué recomiendas después.
