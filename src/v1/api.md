# DON Format API v2

## Overview

El módulo v2 proporciona un sistema de análisis léxico (lexer) de bajo nivel para el formato DON. A diferencia de la API v1 que trabaja directamente con objetos JavaScript, v2 expone las primitivas del compilador para análisis y tokenización de texto.

Este módulo es útil cuando necesitas:

- Análisis sintáctico detallado del formato DON
- Construcción de herramientas de desarrollo (syntax highlighting, linters)
- Procesamiento de bajo nivel de documentos DON
- Debugging y análisis de tokens

## Arquitectura

El proceso de análisis se divide en tres etapas:

1. **Part Scanning**: Convierte bytes en partes sintácticas básicas (alfabeto, números, espacios, etc.)
2. **Token Scanning**: Agrupa partes en tokens significativos (keywords, operadores, etc.)
3. **Lexema**: Contenedor de tokens que representa el documento completo

```
Input String → PartSet → Token[] → Lexema
```

---

## Clases

### LexemaEncode

Clase principal para convertir texto en un análisis léxico completo.

#### Overview

`LexemaEncode` es el punto de entrada para analizar documentos DON. Toma una entrada de texto y produce un objeto `Lexema` que contiene todos los tokens identificados.

#### Sintaxis

```ts
import { LexemaEncode } from "@jondotsoy/don/v2/compiler/lexema-encode";

const encoder = new LexemaEncode(options?);
const lexema = encoder.encode(input);
```

#### Constructor

```ts
new LexemaEncode(options?: LexemaEncodeOptions)
```

**Parámetros:**

- `options` (opcional): Objeto de configuración
  - `debug` (boolean): Habilita información de debug. Cuando está activo, almacena el documento original en el lexema para inspección. Por defecto: `false`

#### Métodos

##### `encode(input)`

Analiza el input y retorna un objeto `Lexema` con los tokens identificados.

**Parámetros:**

- `input`: El contenido a analizar. Puede ser:
  - `string`: Texto plano
  - `Uint8Array`: Buffer de bytes
  - `Iterable<number>`: Secuencia de códigos de caracteres
  - `PartSet`: Conjunto de partes pre-procesadas

**Retorna:** `Lexema` - Objeto que contiene el array de tokens

**Ejemplo:**

```ts
const encoder = new LexemaEncode({ debug: true });

// Desde string
const lexema1 = encoder.encode("foo 123");

// Desde Uint8Array
const bytes = new TextEncoder().encode("foo 123");
const lexema2 = encoder.encode(bytes);

// Acceder a los tokens
console.log(lexema1.tokens);
// [
//   Token { type: SyntaxKind.keyword, parts: [...], span: Span {...} },
//   Token { type: SyntaxKind.keyword, parts: [...], span: Span {...} }
// ]
```

---

### Lexema

Contenedor inmutable de tokens que representa un documento analizado.

#### Overview

`Lexema` almacena el resultado del análisis léxico. Contiene un array de tokens y opcionalmente el documento original para debugging.

#### Sintaxis

```ts
import { Lexema } from "@jondotsoy/don/v2/compiler/lexema";

const lexema = new Lexema(tokens);
```

#### Constructor

```ts
new Lexema(tokens: Token[])
```

**Parámetros:**

- `tokens`: Array de tokens identificados en el documento

#### Propiedades

- `tokens` (readonly): Array de objetos `Token` que representan el documento

#### Métodos estáticos

##### `debugSetDocument(ref, body)`

Almacena el documento original asociado a un lexema para debugging.

**Parámetros:**

- `ref`: Instancia de `Lexema`
- `body`: Documento original (string, Uint8Array, Iterable<number>, o PartSet)

##### `debugGetDocument(ref)`

Recupera el documento original asociado a un lexema.

**Parámetros:**

- `ref`: Instancia de `Lexema`

**Retorna:** `Uint8Array | null` - Buffer del documento o null si no existe

**Ejemplo:**

```ts
const encoder = new LexemaEncode({ debug: true });
const lexema = encoder.encode("foo bar");

// Recuperar documento original
const original = Lexema.debugGetDocument(lexema);
console.log(new TextDecoder().decode(original)); // "foo bar"
```

---

### Token

Representa una unidad sintáctica significativa en el documento.

#### Overview

`Token` agrupa una o más `Part` en unidades sintácticas con significado (keywords, operadores, etc.). Cada token tiene un tipo (`SyntaxKind`), las partes que lo componen, y un span que indica su posición.

#### Sintaxis

```ts
import { Token } from "@jondotsoy/don/v2/compiler/token";

const token = new Token(type, parts, span);
```

#### Constructor

```ts
new Token(type: SyntaxKind, parts: Part[], span: Span)
```

**Parámetros:**

- `type`: Tipo de token (ver `SyntaxKind`)
- `parts`: Array de partes que componen el token
- `span`: Posición y longitud del token en el documento

#### Propiedades

- `type` (readonly): Tipo de token (`SyntaxKind`)
- `parts` (readonly): Array de `Part` que componen el token
- `span` (readonly): Objeto `Span` con la posición del token

#### Métodos estáticos

##### `from(type, parts)`

Crea un token a partir de un tipo y un array de partes.

**Parámetros:**

- `type`: Tipo de token (`SyntaxKind`)
- `parts`: Array de `Part`

**Retorna:** `Token`

##### `scan(partSet)`

Escanea un conjunto de partes y genera tokens.

**Parámetros:**

- `partSet`: Objeto `PartSet` con las partes a analizar

**Retorna:** `Token[]` - Array de tokens identificados

**Ejemplo:**

```ts
import { PartSetEncode } from "@jondotsoy/don/v2/compiler/part";
import { Token } from "@jondotsoy/don/v2/compiler/token";

const partSet = new PartSetEncode().encode("foo 123");
const tokens = Token.scan(partSet);

console.log(tokens);
// [
//   Token { type: SyntaxKind.keyword, ... },
//   Token { type: SyntaxKind.keyword, ... }
// ]
```

#### Propiedad estática: `matches`

Array de patrones de coincidencia para identificar tokens. Cada entrada es una tupla:

```ts
[
  kind: SyntaxKind,
  pattern: (partSet: PartSet, fromIndex: number) => Span | null,
  options?: { invisible?: boolean }
]
```

- `kind`: Tipo de token a identificar
- `pattern`: Función que intenta hacer match desde una posición
- `options.invisible`: Si es `true`, el token no aparece en el output (ej: whitespace)

---

### Part

Representa una unidad sintáctica básica (caracteres del mismo tipo).

#### Overview

`Part` es la unidad más pequeña del análisis. Agrupa caracteres consecutivos del mismo tipo (alfabéticos, numéricos, espacios, etc.).

#### Sintaxis

```ts
import { Part } from "@jondotsoy/don/v2/compiler/part";

const part = new Part(type, buffer, span);
```

#### Constructor

```ts
new Part(type: SyntaxKind, buffer: u8, span: Span)
```

**Parámetros:**

- `type`: Tipo de parte (`SyntaxKind`)
- `buffer`: Array de bytes que componen la parte
- `span`: Posición y longitud en el documento

#### Propiedades

- `type` (readonly): Tipo de parte (`SyntaxKind`)
- `buffer` (readonly): Array de bytes (`u8` = `number[]`)
- `span` (readonly): Objeto `Span` con la posición

#### Métodos estáticos

##### `scan(buffer)`

Escanea un buffer de bytes y genera partes.

**Parámetros:**

- `buffer`: Array de bytes (`u8`)

**Retorna:** `Part[]` - Array de partes identificadas

---

### PartSet

Contenedor inmutable de partes.

#### Overview

`PartSet` agrupa un array de `Part` que representan el documento escaneado a nivel de caracteres.

#### Sintaxis

```ts
import { PartSet } from "@jondotsoy/don/v2/compiler/part";

const partSet = new PartSet(parts);
```

#### Constructor

```ts
new PartSet(parts: Part[])
```

**Parámetros:**

- `parts`: Array de objetos `Part`

#### Propiedades

- `parts` (readonly): Array de `Part`

---

### PartSetEncode

Codificador que convierte texto en un `PartSet`.

#### Overview

`PartSetEncode` es el primer paso del análisis. Convierte texto en partes sintácticas básicas.

#### Sintaxis

```ts
import { PartSetEncode } from "@jondotsoy/don/v2/compiler/part";

const encoder = new PartSetEncode();
const partSet = encoder.encode(input);
```

#### Métodos

##### `encode(input)`

Convierte el input en un `PartSet`.

**Parámetros:**

- `input`: Contenido a analizar
  - `string`: Texto plano
  - `Uint8Array`: Buffer de bytes
  - `Iterable<number>`: Secuencia de códigos de caracteres

**Retorna:** `PartSet`

**Ejemplo:**

```ts
const encoder = new PartSetEncode();
const partSet = encoder.encode("foo 123");

console.log(partSet.parts);
// [
//   Part { type: SyntaxKind.alphabet, buffer: [102, 111, 111], span: {...} },
//   Part { type: SyntaxKind.whitespace, buffer: [32], span: {...} },
//   Part { type: SyntaxKind.numeric, buffer: [49, 50, 51], span: {...} }
// ]
```

---

### Span

Representa una posición y longitud en el documento.

#### Overview

`Span` es una estructura simple que indica dónde se encuentra un elemento en el documento original.

#### Sintaxis

```ts
import { Span } from "@jondotsoy/don/v2/compiler/span";

const span = new Span(index, length);
```

#### Constructor

```ts
new Span(index: number, length: number)
```

**Parámetros:**

- `index`: Posición inicial (0-based)
- `length`: Longitud del elemento

#### Propiedades

- `index` (readonly): Posición inicial
- `length` (readonly): Longitud

**Ejemplo:**

```ts
const span = new Span(0, 3); // Representa los primeros 3 caracteres
console.log(span.index); // 0
console.log(span.length); // 3
```

---

## Enumeraciones

### SyntaxKind

Tipos de elementos sintácticos reconocidos por el lexer.

```ts
enum SyntaxKind {
  // Tipos de Part (nivel de caracteres)
  unknown, // Caracteres no reconocidos
  alphabet, // Letras (a-z, A-Z)
  numeric, // Dígitos (0-9)
  whitespace, // Espacios y tabs
  newline, // Saltos de línea
  dot, // Punto (.)
  underscore, // Guión bajo (_)
  openCurlyBrace, // Llave de apertura ({)
  closeCurlyBrace, // Llave de cierre (})

  // Tipos de Token (nivel sintáctico)
  keyword, // Identificadores y palabras clave
  comment, // Comentarios
}
```

---

## Tipos

### u8

Alias de tipo para arrays de bytes.

```ts
type u8 = number[];
```

Representa un array de números donde cada número es un byte (0-255).

---

## Ejemplo completo

```ts
import { LexemaEncode } from "@jondotsoy/don/v2/compiler/lexema-encode";
import { SyntaxKind } from "@jondotsoy/don/v2/syntax-kind";

// Crear encoder con debug habilitado
const encoder = new LexemaEncode({ debug: true });

// Analizar documento DON
const source = `
example.com {
  route /profile/* {
    respond 200 "Ok"
  }
}
`;

const lexema = encoder.encode(source);

// Inspeccionar tokens
for (const token of lexema.tokens) {
  console.log({
    type: SyntaxKind[token.type],
    position: token.span,
    partsCount: token.parts.length,
  });
}

// Recuperar documento original
const original = Lexema.debugGetDocument(lexema);
console.log(new TextDecoder().decode(original));
```

---

## Notas de implementación

- El análisis es **no destructivo**: toda la información de posición se preserva
- Los tokens de whitespace son **invisibles** por defecto (no aparecen en el array de tokens)
- El sistema usa **WeakMap** para almacenar documentos de debug sin crear memory leaks
- Todos los objetos son **inmutables** (readonly properties)
- El análisis es **incremental**: Part → Token → Lexema
