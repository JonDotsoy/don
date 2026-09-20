# Variante 01 — "terminal corners"

Variación de la marca base (`assets/brand/variant/00/cover.html`) que
mantiene la tipografía, paleta y proporciones definidas en
`assets/brand/BRAND.md`, pero cambia la composición:

- Wordmark alineado abajo a la izquierda en vez de centrado
- El punto `.` se reemplaza por un bloque cuadrado (`--accent`), como un
  cursor de terminal, en lugar del carácter tipográfico
- Se agrega un kicker `npm i donly` en `--accent-2`, con un marcador
  cuadrado como bullet
- Corner brackets tipo "viewfinder" en las esquinas superior-izquierda e
  inferior-derecha (`--accent-2`), a modo de acento gráfico adicional
- Se retira la grilla de fondo del original; solo queda el glow radial

Archivos:

- `cover.html` — cover 1200×630, soporta `?theme=light|dark`
- `generate-png.mjs` — script Playwright que exporta `cover-light.png` y
  `cover-dark.png`
