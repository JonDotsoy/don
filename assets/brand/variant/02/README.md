# Variante 02 — "tittle mark" (lockup cuadrado)

Variación de la marca que cambia únicamente los dos ejes permitidos:
la fuente y la disposición del símbolo punto. Mantiene los mismos
tokens de color y el resto de reglas de `assets/brand/BRAND.md`.

- **Fuente**: `IBM Plex Mono` 800 (en vez de `JetBrains Mono`), mismo
  fallback monoespaciado
- **Disposición del punto**: en vez de ir en línea al final del
  wordmark, el punto se convierte en un círculo suspendido arriba del
  texto (como una tilde/tittle), centrado sobre `donly`
- **Layout**: lockup cuadrado (1:1, lienzo base 720×720) pensado para
  avatar / ícono de app / tile, en vez del cover 1200×630 horizontal

Archivos:

- `cover.html` — lockup cuadrado, soporta `?theme=light|dark`
- `generate-png.mjs` — script Playwright que exporta `cover-light.png`
  y `cover-dark.png`
