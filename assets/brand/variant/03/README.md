# Variante 03 — "brutalist tag" (Martian Mono)

Variación construida a partir de una búsqueda de fuentes monoespaciadas
open source con peso 800 real (ver `fonts/OFL.txt`). Cambia la fuente y
la disposición del punto respecto a la marca base, y agrega un layout
tipo "stamp"/tag bordeado.

- **Fuente**: [`Martian Mono`](https://github.com/evilmartians/mono)
  ExtraBold (800). Licencia SIL OFL 1.1 — ver `fonts/OFL.txt`. El
  `.woff2` (subset latin) está auto-hospedado en `fonts/` en vez de
  depender de que el sistema tenga la fuente instalada, a diferencia
  de las variantes 00–02 que usaban `local()`/fallback y por lo tanto
  nunca renderizaban la tipografía real. La familia distribuye estilos
  condensados/wide como fuentes estáticas separadas (no variable en
  este subset), así que aquí se usa el ancho normal.
- **Disposición del punto**: se separa por completo del wordmark y se
  convierte en un chip cuadrado bordeado (`--accent`) con un círculo
  centrado, ubicado al lado derecho dentro del mismo marco
- **Layout**: wordmark + chip del punto encerrados en un marco
  rectangular bordeado (`--text`), como un sello/tag. Sin fondo de
  card ni grilla/glow — el PNG exportado tiene fondo transparente y
  está recortado ajustado al marco, sin margen extra alrededor

Por qué Martian Mono: de las fuentes open source evaluadas (JetBrains
Mono, Martian Mono, Source Code Pro, Maple Mono — todas OFL con peso
800 real), es la que tiene el carácter más "brutalista/dev-tool" y se
diferencia claramente de JetBrains Mono usada en la marca base.

Archivos:

- `cover.html` — marca standalone (sin fondo/canvas fijo), soporta
  `?theme=light|dark`
- `fonts/MartianMono-ExtraBold-latin.woff2` — fuente auto-hospedada
- `fonts/OFL.txt` — licencia SIL Open Font License 1.1
- `generate-png.mjs` — script Playwright que exporta `cover-light.png`
  y `cover-dark.png` (espera a que `document.fonts.ready` para
  asegurar que el woff2 esté cargado antes de capturar)
