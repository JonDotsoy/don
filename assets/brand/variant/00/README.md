# Variante 00 — base

Implementación de referencia de `assets/brand/BRAND.md`, tal cual está
especificada: wordmark centrado en JetBrains Mono 800, punto `.` en
línea como acento de color, grilla sutil + glow radial en las
esquinas, tarjeta con bordes redondeados (20px) y sombra suave.

El resto de variantes (`01`, `02`, `03`, …) parten de esta base y
cambian composición, fuente o disposición del punto.

Archivos:

- `cover.html` — cover 1200×630, soporta `?theme=light|dark`
- `generate-png.mjs` — script Playwright que exporta `cover-light.png`
  y `cover-dark.png`
