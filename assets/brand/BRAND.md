# Marca "donly."

**Texto**

- Wordmark: `donly` + punto suelto `.`
- Todo en minúsculas, sin subtítulo ni claim adicional
- El punto funciona como acento de color, separado del texto principal

**Estilo**

- Tipográfico puro (sin isotipo/ícono): la marca es el lettering en sí
- Peso extra bold (800), trazo grueso y compacto
- Letter-spacing ligeramente negativo (-0.02em) para un bloque tipográfico denso
- Fondo con textura sutil de grilla (grid overlay) + degradado radial suave en las esquinas
- Bordes redondeados (20px) y sombra suave para dar sensación de "tarjeta"/cover

**Fuente**

- Familia: `JetBrains Mono`, peso 800 (extra bold)
- Fallback: `ui-monospace, SFMono-Regular, Menlo, monospace`
- Monoespaciada — refuerza el origen técnico/dev del paquete (npm, código)

**Dimensiones**

- Lienzo base: 1200×630 px (formato estándar cover / social/og-image)
- Responsive: escala manteniendo aspect-ratio 1200/630 a cualquier ancho
- Tamaño del wordmark: `clamp(64px, 15vw, 168px)` — fluido entre mobile y desktop

**Colores**

| Token        | Claro                | Oscuro                  | Uso                                |
| ------------ | -------------------- | ----------------------- | ---------------------------------- |
| `--bg-1`     | `#f6f4ef`            | `#0d1117`               | fondo base (arriba del degradado)  |
| `--bg-2`     | `#eae6dc`            | `#141a22`               | fondo base (abajo del degradado)   |
| `--text`     | `#181511`            | `#e6edf3`               | color del wordmark "donly"         |
| `--accent`   | `#c1611f`            | `#ffa657`               | color del punto `.`                |
| `--accent-2` | `#1f5fa8`            | `#79c0ff`               | acento secundario (glow del fondo) |
| `--line`     | `rgba(20,17,10,.10)` | `rgba(255,255,255,.09)` | bordes y grilla                    |

- Paleta con soporte dual light/dark vía `prefers-color-scheme` + toggle manual (`data-theme`)
- El punto (`--accent`) es el único color "vivo" de la marca; el resto es monocromo

## Archivos

- `cover.html` — cover de la marca (1200×630), soporta `?theme=light|dark` en la query string
- `generate-png.mjs` — script Playwright que renderiza `cover.html` a PNG (light y dark)
