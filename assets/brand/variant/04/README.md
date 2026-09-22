# Variante 04 — "DON." (lockup cuadrado 1:1)

Lockup cuadrado pensado para ícono/avatar (favicon, app icon, tile),
usando el acrónimo en mayúsculas `DON` en vez del wordmark `donly` de
la marca base. Mantiene la tipografía y paleta de
`assets/brand/BRAND.md`.

- **Wordmark**: `DON` + punto suelto `.` como acento de color
  (`--accent`), igual que en `variant/00`, pero en mayúsculas
- **Fuente**: `JetBrains Mono` 800 (extra bold), mismo fallback
  monoespaciado que la marca base
- **Layout**: lienzo cuadrado 1024×1024, wordmark centrado, fondo
  transparente (sin card/grilla/glow)

Archivos:

- `cover.html` — lockup 1024×1024, soporta `?theme=light|dark`
- `generate-png.mjs` — script Playwright que exporta `cover-light.png`
  y `cover-dark.png`
