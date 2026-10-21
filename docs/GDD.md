# PROMPT MAESTRO v2 — "TIERRA QUEMADA: Crónicas de la Sierra"

> En cada sesión basta con: *"Lee CLAUDE.md y docs/GDD.md §[secciones]. Ejecuta la Fase N."*

---

## 0. Rol y reglas de trabajo (CLAUDE.md)

Eres un ingeniero senior de videojuegos y technical artist. Construimos un TPS de mundo abierto para **PC en navegador** con calidad visual de **gama media** (referencia: *Counter-Strike 2* en mapas de día, *Insurgency: Sandstorm* en ambientación). **Prohibido el look low-poly/arcade/mobile.**

Reglas:
- **Stack fijo:** Vite + TypeScript + **Three.js r170 (`WebGLRenderer`, WebGL2; migrar a WebGPU más adelante si aporta)** + **Rapier** (física) + **pmndrs/postprocessing** + Web Audio API. Backend: Node + Fastify + SQLite (better-sqlite3).
- **Assets reales con licencia libre**, cargados vía `assets/manifest.json` (nunca rutas sueltas en el código):
  - Texturas PBR y HDRIs: **Poly Haven** (CC0, tiene API pública) y **ambientCG** (CC0).
  - Modelos de props/edificios/vehículos: Poly Haven, Quaternius "Ultimate" packs, Sketchfab CC0/CC-BY (registrar créditos en `CREDITS.md`).
  - Personajes y animaciones: **Mixamo** (soldados + locomoción, apuntar, recargar, cobertura, muerte), retargeteados a un solo esqueleto.
  - Sonido: **Sonniss GDC bundles** y Freesound CC0 para disparos, explosiones, ambiente. Síntesis procedural solo como respaldo.
- Pipeline: glTF/GLB con **meshopt/Draco**, texturas **KTX2 (Basis)**, script `npm run assets` que descarga, convierte y optimiza (gltf-transform).
- Todo contenido (capítulos, armas, enemigos, vehículos, edificios) es **data-driven** en `src/data/*.json`.
- Archivos <300 líneas, un sistema por archivo. Sin comentarios obvios.
- Responde solo con código nuevo/cambiado + resumen ≤5 líneas. No reescribas archivos enteros por cambios puntuales.
- Cierre de fase: `npm run build` sin errores, captura con Playwright (`npm run shot`) de 3 vistas del mapa y checklist.

---

## 1. Visión
TPS táctico en campos de batalla abiertos de **mínimo 500 × 500 m** por nivel (algunos hasta 800 × 800). El jugador es el protagonista absoluto: **≥75 % de las bajas y de los objetivos los logra el jugador**; los aliados acompañan, distraen y aportan el 20–25 %. Vehículos militares conducibles y usables como cobertura. Ritmo: infiltración/tensión → combate intenso → recompensa.

## 2. Calidad visual (prioridad alta)

**Render**
- PBR completo (albedo, normal, roughness, metalness, AO), **iluminación por HDRI** por bioma + sol direccional.
- **Sombras en cascada (CSM, 3–4 cascadas)**, sombras de contacto, PCF suave.
- Tone mapping **ACES/AgX**, espacio de color correcto, exposición por bioma.
- Postproceso: **SSAO/GTAO**, **bloom** selectivo (fogonazos, explosiones, luces), **SMAA/TAA**, aberración cromática y viñeta sutiles, **profundidad de campo** al apuntar con mira, **motion blur** suave opcional, corrección de color (LUT) por capítulo.
- **Niebla volumétrica/altura** y dispersión atmosférica (cielo físico tipo Preetham/Hosek) con hora del día por capítulo (amanecer, mediodía, atardecer, noche con luna, tormenta).
- Reflejos: SSR en agua y superficies mojadas; agua con normales animadas, espuma en orillas.

**Terreno y vegetación**
- Heightmap de 1025² o mayor por mapa (procedural con ruido + erosión, o importado), **splatting de 4–8 materiales PBR** (tierra, roca, pasto, arena, nieve, barro) mezclados por pendiente/altura con triplanar en acantilados.
- Pasto con **GPU instancing** y viento (vertex shader), árboles/arbustos con LOD + impostores a distancia, rocas grandes como mallas reales.
- Distancia de visión ≥ 600 m con niebla atmosférica; montañas de fondo como skirt fuera del área jugable.

**Detalle y vida**
- **Decals**: impactos de bala por material, quemaduras, sangre, grafitis del FLS, marcas de neumáticos.
- Partículas GPU: fogonazos con luz puntual de 1 frame, casquillos con física, chispas en metal, polvo en tierra, humo de vehículos dañados, fuego, lluvia/nieve/arena según bioma, insectos y hojas.
- Destrucción ligera: vidrios que se rompen, barriles que explotan, cajas que se rompen, vehículos que quedan calcinados.
- Animaciones: blending de locomoción en 8 direcciones, IK de pies en terreno, apuntado con aim-offset, ragdoll al morir (Rapier).
- Primer plano cuidado: arma del jugador con modelo detallado, retroceso animado, sway, mira con lente reflejada.

**Presupuesto de rendimiento**: 60 fps en GPU media (GTX 1660 / RTX 3050) a 1080p. Ajustes Bajo/Medio/Alto/Ultra (sombras, SSAO, densidad de pasto, distancia, resolución de render escalable). Medir con `stats-gl` y un modo benchmark.

## 3. Historia (ambientada en el Perú, facciones ficticias, 10 capítulos)

**Contexto:** Perú, 2031 (ucronía). El general **Aurelio Castañeda** da un golpe de Estado, disuelve el Congreso y entrega la sierra a la minera extranjera **Ferrum Andes**. Su brazo armado: la **Policía Nacional (PNP)** y los mercenarios de **Blackridge Security**. Todas las facciones, personajes y lugares concretos son ficticios; no se usan grupos armados reales.
**Protagonista:** **Lucía "Ceniza" Morales**, exsargento nacida en un cono de Lima, que deserta tras ver a la PNP disparar contra su barrio. Funda el **Frente de Liberación Socialista (FLS)**, que renuncia a la vía electoral por la lucha armada.
**Compañeros:** *Tomás "Profe" Ibarra* (profesor de colegio nacional, estratega), *Nena Quispe* (francotiradora ayacuchana, 19 años), *Padre Elías* (párroco y médico), *Rocco* (mecánico, ex-PNP).
**Tema:** el precio de la libertad. A partir de la mitad, el FLS se divide entre justicia y venganza.

| # | Capítulo | Mapa / bioma (≥500×500 m) | Objetivo | Giro |
|---|---|---|---|---|
| 1 | **Ceniza** | Cono de Lima: A.H. ficticio "Nueva Esperanza", avenida, manzanas de ladrillo, cerros con escaleras, cielo gris | Romper el retén de la PNP y sacar a los vecinos | Nace el FLS |
| 2 | **La Ruta del Polvo** | Pampa costera y quebradas (estilo Nazca), grifo en ruinas | Emboscar convoy, robar camioneta | Rocco deserta |
| 3 | **Montaña Negra** | Puna nevada, campamento minero, teleférico | Sabotear la mina | Fosas comunes |
| 4 | **El Museo** | Centro de Lima de noche, casonas, Museo Nacional (ficticio) | Robar archivos | La prensa internacional se entera |
| 5 | **Río Rojo** | Selva amazónica con lluvia, aserradero | Defender un pueblo aliado | Muere el Padre Elías |
| 6 | **Puerto Libertad** | Puerto industrial (estilo Callao), contenedores | Capturar cargamento | Traición |
| 7 | **La Universidad** | Campus tomado por estudiantes (estilo universidad pública limeña) | Romper el cerco | Apoyo popular |
| 8 | **Base Cóndor** | Base aérea en el altiplano, de noche | Destruir helicópteros | Nena vs Profe |
| 9 | **La Represa** | Represa andina entre cerros | Evitar la inundación del valle | Decisión moral (finales A/B) |
| 10 | **Palacio de Invierno** | Lima nocturna, barricadas, palacio presidencial (ficticio) | Asalto final | Final A / Final B |

La aldea andina construida en la Fase 1 queda como mapa de la sierra (`?ch=2`).
**Civiles:** los mapas urbanos tienen transeúntes que huyen al oír disparos; herir civiles penaliza.

## 4. Mundo y mapas
- Mapas **500×500 m mínimo**, streaming por chunks de 64 m, LOD de 3 niveles, frustum + occlusion culling (por portales en interiores).
- Por capítulo, JSON con: `size`, `heightmap/seed`, `bioma` (HDRI, LUT, niebla, clima, hora), `estructuras[]`, `interiores[]`, `spawns`, `objetivos[]`, `vehículos[]`, `diálogos[]`, `coleccionables[]`.
- **Edificios**: kit modular (muros, ventanas, puertas, techos, escaleras, balcones) con materiales PBR por estilo (adobe, colonial, industrial, militar, brutalista). **25–40 % de los edificios son recorribles** por dentro; el resto tiene fachada detallada con ventanas con interior falso (parallax interior mapping).
- Cada mapa tiene **1 landmark interior grande** (ver tabla) con varios pisos, escaleras, iluminación propia y combate a corta distancia.
- Diseño de niveles: rutas múltiples (flanco, altura, sigilo), líneas de visión largas y zonas de cobertura densa, puntos de referencia visuales.
- Límites naturales + aviso "Regresa a la zona de operaciones" con cuenta regresiva.

## 5. Gameplay

**Jugador (el centro de todo)**: cámara sobre el hombro (Q cambia hombro), apuntar con zoom y DOF, correr, agacharse, cuerpo a tierra, deslizarse, saltar obstáculos bajos (vault), **cobertura** contextual (C) con asomarse y disparo a ciegas, asomarse lateral (Z/X). Salud con regeneración parcial + botiquines, armadura con placas.

**Armas (data-driven)**: pistola, subfusil, rifle de asalto (AK y M4), escopeta, DMR, francotirador, ametralladora ligera, RPG, granadas (fragmentación, humo, incendiaria), cuchillo. Atributos: daño, cadencia, retroceso con patrón, dispersión, cargador, recarga táctica/vacía, alcance, caída de daño, penetración de materiales. Hitscan con trazadoras; RPG y granadas como proyectiles físicos. Headshot ×2.5. Accesorios: miras, silenciador, empuñadura, cargador ampliado.

**Vehículos**: jeep, pickup artillada, camión, APC con torreta, tanque ligero (cap. 8+), lancha (cap. 5–6). E para entrar/salir, cambiar de asiento (conductor/artillero), física con suspensión por raycast, daño por zonas (ruedas, motor), humo al 30 %, explosión con onda de daño, carcasa calcinada como cobertura.

**Aliados (apoyo, no protagonistas)**:
- Autónomos; **sin sistema de órdenes**. Solo un "ping" (botón central) para marcar un enemigo, que los aliados priorizan.
- Rol principal: **supresión** (obligan al enemigo a cubrirse), atraer fuego, marcar enemigos en el minimapa, revivir al jugador una vez por checkpoint, comentarios de radio.
- **Director de participación**: un sistema mide en tiempo real el % de bajas aliadas y ajusta su precisión y agresividad para mantenerse en **20–25 %**. Los aliados nunca completan objetivos principales ni matan oficiales/jefes. Si el jugador está inactivo, los aliados no avanzan solos.
- Los aliados pueden caer heridos (no mueren salvo en guion) y el jugador puede reanimarlos.

**Enemigos**: FSM + utility AI (patrulla → sospecha → alerta → combate → flanqueo → retirada/reagrupación). Usan puntos de cobertura precalculados, se suprimen entre ellos, lanzan granadas para sacarte de la cobertura, oyen disparos (silenciador reduce el radio), investigan. Tipos: fusilero, tirador, ametrallador, granadero, oficial (al morir los demás dudan), mercenario Blackridge (blindado, táctico), francotirador con reflejo de mira, perros (cap. 3/8), helicóptero (cap. 8–10). Dificultad: Recluta / Veterano / Guerrillero.

**Barras de salud**: sobre cada unidad (billboard) — azul aliado, rojo enemigo — visibles al recibir daño o al apuntar, se desvanecen a los 3 s. También en vehículos y objetivos destructibles. Armadura como segmento gris.

## 6. HUD y mini mapa
- **Mini mapa** circular arriba a la derecha: textura cenital pre-renderizada del mapa + iconos en tiempo real; rota con el jugador; aliados (azul), enemigos detectados/marcados (rojo, se desvanecen si se pierde contacto), objetivos (amarillo), vehículos, cono de visión, ping de disparos enemigos no vistos. **M**: mapa táctico completo con marcadores y zoom.
- Salud/armadura, munición, arma e icono, granadas, brújula superior con marcadores y metros, indicadores de daño direccional, indicador de granada cercana, retícula dinámica, objetivos animados, subtítulos con retrato, retratos de escuadra con salud.
- HUD en HTML/CSS (no WebGL), estética militar sobria: tipografía condensada + monoespaciada, esquinas recortadas, transiciones suaves, opción de ocultar HUD.

## 7. Dopamine generators
- **Hitmarker** con sonido seco; en kill, marcador rojo; **headshot** con icono y "ping" metálico.
- Feed de bajas y textos de XP (+100, HEADSHOT +50, DOBLE BAJA, A TRAVÉS DE LA PARED, VEHÍCULO DESTRUIDO, COLATERAL).
- **Rachas** del jugador (no cuentan las aliadas): 3/5/8/12 → mortero, dron que marca enemigos, lanzamiento de suministros, ataque con cohetes.
- Hit-stop de 40 ms en bajas, cámara lenta en la última baja de una oleada, screen shake proporcional, explosiones con onda expansiva y debris.
- Progresión: XP → nivel → armas, accesorios y skins. Pantalla de fin de misión con estadísticas que suben contando, **% de bajas tuyas vs aliados**, medallas (Sin daño, Fantasma, Demoledor, Lobo solitario), rango S/A/B/C.
- Coleccionables (cartas, grabaciones, fotos) que amplían la historia.

## 8. Audio
- Disparos **con samples reales** por arma, en capas: mecánico cercano + cuerpo + cola de eco según entorno (cañón, bosque, ciudad, interior) + versión lejana con paso-bajo a >150 m.
- Audio 3D (PannerNode HRTF), oclusión simple por raycast (paredes amortiguan), zumbido de bala cercana, casquillos que rebotan según superficie, pasos por material, motores con pitch por RPM, ambientes por bioma (viento, selva, ciudad lejana).
- Música adaptativa por capas (ambiente / tensión / combate) con transiciones.
- Mezclador: master, efectos, música, voces, más compresor para que los disparos no saturen.

## 9. Backend
Fastify + SQLite:
- `POST /api/auth/guest` → token · `POST /api/auth/register|login` (bcrypt + JWT, opcional)
- `GET/PUT /api/save` → capítulo, decisiones, XP, desbloqueos, coleccionables, ajustes
- `POST /api/missions/:id/result` → tiempo, bajas, % propio, precisión, rango; validación anti-trampa básica
- `GET /api/leaderboard/:missionId` → top 20
- Migraciones en `server/db/migrations`. Modo offline con localStorage si el servidor no responde.

## 10. Fases (una por sesión, `/clear` entre fases)
1. **Base técnica + look**: Vite/TS, renderer con postproceso, HDRI, CSM, terreno 500×500 con splatting PBR, pasto instanciado, niebla, cámara TPS, controlador del jugador con animaciones Mixamo. Pipeline `npm run assets`. *Meta: que la captura del Cap. 1 ya se vea gama media.*
2. **Combate**: armas, retroceso, trazadoras, decals, partículas, audio de disparos, HUD básico.
3. **IA enemiga** + cobertura + barras de salud + ragdoll.
4. **Aliados + director de participación (20–25 %)**.
5. **Vehículos**.
6. **Edificios modulares + interiores recorribles + oclusión**.
7. **HUD completo, mini mapa, dopamina, pantalla de resultados**.
8. **Misiones y narrativa**: objetivos, radio, cinemáticas, Cap. 1 de principio a fin.
9. **Backend** + guardado + leaderboard.
10. **Contenido**: Cap. 2–10 (una sesión cada 2 capítulos) con su bioma, landmark y clima.
11. **Pulido y rendimiento**: menús, ajustes gráficos, benchmark, finales A/B.

## 11. Estructura
```
client/src/
  core/      (loop, input, loader+manifest, eventos, ajustes)
  render/    (renderer, postfx, sky, shadows, water, decals, particles)
  world/     (terrain, vegetation, buildings, interiors, props, biomes, streaming)
  entities/  (player, soldier, ally, vehicle)
  systems/   (weapons, ai, cover, damage, director, missions, dialogue, progression)
  audio/     (mixer, sfx, music, occlusion)
  ui/        (hud, minimap, healthbars, menus)
  data/      (weapons, enemies, vehicles, buildings, chapters/*.json, story.json)
assets/manifest.json   scripts/assets.ts   server/   docs/GDD.md   CLAUDE.md   CREDITS.md
```
