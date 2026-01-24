---
name: Spec Documentation Generator
description: Genera documentación de especificaciones técnicas basada en tests existentes, con formato markdown estructurado y ejemplos de código
---

# Spec Documentation Generator

Este skill te ayuda a generar documentación de especificaciones técnicas (specs) basándose en los tests existentes en el proyecto.

## Objetivo

Crear documentación completa y estructurada en formato markdown que describa el comportamiento y características del sistema, utilizando los tests como fuente de verdad.

## Estructura del Documento

### Template Base

El documento de especificación debe seguir esta estructura:

```markdown
# [Nombre del Sistema] Specification v[X]

> **Status**: [Draft | Stable | Deprecated]

## 1. Overview

[Descripción general del sistema y sus objetivos]

### 1.1 Design Goals

- **Goal 1**: Descripción
- **Goal 2**: Descripción
- **Goal N**: Descripción

### 1.2 [Concepto Principal]

[Explicación del concepto]

#### 1.2.1 [Subconcepto]

[Detalles del subconcepto]

## 2. [Siguiente Sección Principal]

[Contenido]

---

**End of Specification v[X]**
```

### Formato Markdown

#### Headers

Usa headers de markdown con el símbolo numeral `#`:

- **H1** (`#`): Título principal del documento
- **H2** (`##`): Secciones principales numeradas (1., 2., 3.)
- **H3** (`###`): Subsecciones numeradas (2.1, 2.2, etc.)
- **H4** (`####`): Sub-subsecciones numeradas (2.1.1, 2.1.2, etc.)

Ejemplo:

```markdown
# DON Specification v1

## 1. Overview

### 1.1 Purpose

#### 1.1.1 Design Philosophy
```

#### Reglas de Markdown

1. **Espaciado**: Deja una línea en blanco antes y después de headers, bloques de código, listas y párrafos
2. **Listas**: Usa `-` para listas no ordenadas, números para listas ordenadas
3. **Énfasis**: Usa `**texto**` para bold, `*texto*` para itálica, `` `código` `` para inline code
4. **Links**: Formato `[texto](url)` o `[texto](#anchor)` para referencias internas
5. **Tablas**: Usa pipes `|` y guiones `-` para crear tablas con headers
6. **Líneas horizontales**: Usa `---` en una línea separada
7. **Blockquotes**: Usa `>` al inicio de la línea para citas o notas importantes

Ejemplo de formato correcto:

````markdown
## 2. Syntax

Esta sección describe la sintaxis del lenguaje.

### 2.1 Identifiers

Los identifiers son tokens alfanuméricos que nombran elementos:

- Deben comenzar con letra o underscore
- Pueden contener letras, números y underscores
- Son case-sensitive

**Ejemplo válido**:

```don
myVariable
_private
user123
```
````

**Ejemplo inválido**:

```don
123invalid
my-var
```

> **Note**: Los identifiers no pueden ser keywords reservados.

Para más información, ver [Strings](#23-strings).

`````

#### Ejemplos de Código

Los ejemplos de código DON deben usar el tag `don`:

````markdown
```don
directive arg1 arg2 {
  subdirective value
}
`````

`````

Para otros lenguajes, usa el tag apropiado:

````markdown
```typescript
const example = "code";
```

```bash
echo "shell command"
```
`````

#### Bloques de Información

Usa blockquotes para información importante:

```markdown
> **Status**: Draft
> **Note**: Información adicional
> **Warning**: Advertencia importante
```

### Tabla de Contenido

Incluye una tabla de contenido al inicio del documento (después del status) para documentos extensos:

```markdown
## Table of Contents

1. [Overview](#1-overview)
   - [Design Goals](#11-design-goals)
   - [Core Concepts](#12-core-concepts)
2. [Syntax](#2-syntax)
   - [Primitives](#21-primitives)
   - [Complex Types](#22-complex-types)
3. [Examples](#3-examples)
```

## Proceso de Generación

### 1. Analizar Tests

Lee todos los archivos `*.spec.ts` en el directorio objetivo:

```bash
# Ejemplo para v1
src/v1/**/*.spec.ts
```

Identifica:

- Nombres de tests (`test("should...")`)
- Grupos de tests (`describe("...")`)
- Casos de uso y ejemplos
- Comportamientos esperados

### 2. Extraer Información

De cada test, extrae:

1. **Funcionalidad**: ¿Qué se está probando?
2. **Entrada**: ¿Qué datos de entrada se usan?
3. **Salida esperada**: ¿Qué resultado se espera?
4. **Casos especiales**: Edge cases, errores, validaciones

### 3. Organizar por Categorías

Agrupa los tests en secciones lógicas:

- **Tipos primitivos**: strings, numbers, booleans, null
- **Tipos complejos**: heredocs, bloques, estructuras anidadas
- **Sintaxis**: delimitadores, espacios, newlines
- **Casos especiales**: caracteres especiales, escape sequences

### 4. Crear Ejemplos

Para cada funcionalidad documentada:

1. Incluye un ejemplo de código usando el tag `don`
2. Explica qué hace el ejemplo
3. Si es relevante, muestra la salida o resultado esperado

Ejemplo:

````markdown
#### String con Comillas Escapadas

Las strings pueden contener comillas escapadas usando backslash:

```don
message "Says: \"Hello world\""
description 'It\'s working'
```

El backslash (`\`) permite incluir el mismo tipo de comilla dentro de la string.
````

### 5. Documentar Reglas y Restricciones

Basándote en los tests, documenta usando terminología técnica:

- **Gramática y sintaxis**: Reglas de producción, precedencia, asociatividad
- **Análisis léxico**: Patrones de tokens, delimitadores, caracteres especiales
- **Análisis sintáctico**: Estructura de árbol, nodos, relaciones jerárquicas
- **Restricciones semánticas**: Validaciones de contexto, tipos, scope
- **Edge cases**: Casos límite, ambigüedades, comportamientos no obvios

Usa listas y ejemplos técnicamente precisos:

````markdown
#### Restricciones Sintácticas

1. **Tokens post-bloque prohibidos**: Después del cierre de un bloque (`}`), no se permiten tokens adicionales en la misma directiva

   ```don
   # ✅ Sintácticamente válido
   container { image "nginx" }

   # ❌ Error de parsing
   container { image "nginx" } extra
   ```
````

2. **Identificadores como tokens válidos**: Los nombres de directivas deben ser identificadores léxicos válidos, no pueden ser punctuadores (`{`, `}`, etc.)

````

## Ejemplo de Uso

Para generar la especificación v1:

1. Lee los tests en `src/v1/syntax.spec.ts`
2. Analiza los grupos `describe()` y casos `test()`
3. Extrae ejemplos de código de los strings de entrada
4. Organiza por categorías (encoding, tipos, sintaxis)
5. Crea el documento en `docs/specs/v1/spec.md`

## Estructura Recomendada para DON v1

```markdown
# DON Specification v1

> **Status**: Draft

## Table of Contents

1. [Overview](#1-overview)
   - [Design Goals](#11-design-goals)
2. [Syntax](#2-syntax)
   - [Identifiers](#21-identifiers)
   - [Numbers](#22-numbers)
   - [Strings](#23-strings)
   - [Booleans](#24-booleans)
   - [Heredocs](#25-heredocs)
   - [Directives](#26-directives)
   - [Nested Structures](#27-nested-structures)
3. [Encoding](#3-encoding)
   - [PartSet Encoding](#31-partset-encoding)
   - [Lexema Encoding](#32-lexema-encoding)
   - [Syntax Encoding](#33-syntax-encoding)
4. [Examples](#4-examples)

## 1. Overview

[Descripción de DON v1 y sus mejoras sobre v0]

### 1.1 Design Goals

[Objetivos de diseño del sistema]

## 2. Syntax

[Descripción general de la sintaxis del lenguaje, sus elementos fundamentales y cómo se combinan para formar estructuras válidas]

### 2.1 Identifiers

[Descripción de qué son los identifiers, sus reglas de formación y uso]

[Basado en tests de identifiers]

### 2.2 Numbers

[Descripción de los formatos numéricos soportados y sus características]

[Basado en tests de numbers]

### 2.3 Strings

[Descripción de las strings, tipos de comillas y reglas de escape]

[Basado en tests de strings]

### 2.4 Booleans

[Descripción de los valores booleanos y su representación]

[Basado en tests de booleans]

### 2.5 Heredocs

[Descripción de heredocs, su sintaxis y casos de uso para texto multilínea]

[Basado en tests de heredocs]

### 2.6 Directives

[Descripción de las directivas, su estructura y cómo se componen con argumentos]

[Basado en tests de directives]

### 2.7 Nested Structures

[Descripción de cómo se anidan estructuras usando bloques y la jerarquía resultante]

[Basado en tests de nested structures y bloques anidados]

## 3. Encoding

[Descripción general del sistema de encoding, su propósito y los diferentes niveles de representación]

```mermaid
graph LR
    A[PartSet] --> B[Lexema]
    B --> C[Syntax AST]
````

### 3.1 PartSet Encoding

[Descripción de cómo se codifican los conjuntos de partes y su estructura interna]

[Basado en tests de PartSetEncode]

### 3.2 Lexema Encoding

[Descripción de la codificación de lexemas y su rol en el análisis léxico]

[Basado en tests de LexemaEncode]

### 3.3 Syntax Encoding

[Descripción de cómo se codifica la sintaxis completa y la representación final]

[Basado en tests de SyntaxEncode]

## 4. Examples

[Ejemplos completos y casos de uso reales extraídos de los tests que demuestran las capacidades del sistema]

[Ejemplos completos extraídos de los tests]

````

## Tips

- **Mantén consistencia**: Usa el mismo formato en todo el documento
- **Sé específico y técnico**: Usa terminología precisa (tokens, lexemas, AST, parsing, etc.)
- **Lenguaje técnico**: Emplea vocabulario de compiladores y lenguajes formales
- **Ejemplos ejecutables**: Los ejemplos deben ser claros y sintácticamente válidos
- **Documenta edge cases**: Los casos límite y comportamientos especiales son críticos
- **Usa la numeración**: Facilita las referencias cruzadas
- **Incluye contexto técnico**: Explica el "por qué" desde una perspectiva de diseño de lenguajes
- **Valida con tests**: Asegúrate de que los ejemplos coincidan exactamente con los tests

## Vocabulario Técnico

Usa terminología específica y consistente en toda la documentación:

### Términos de Análisis Léxico

- **Token**: Unidad léxica mínima reconocida por el lexer
- **Lexeme**: Secuencia de caracteres que forma un token
- **Lexer**: Analizador léxico que convierte texto en tokens
- **Parser**: Analizador sintáctico que construye estructuras a partir de tokens
- **AST (Abstract Syntax Tree)**: Árbol de sintaxis abstracta

### Términos de Sintaxis

- **Identifier**: Nombre o etiqueta alfanumérica que identifica elementos
- **Literal**: Valor constante (string, number, boolean, null)
- **Directive**: Instrucción o comando con nombre y argumentos opcionales
- **Argument**: Valor pasado a una directiva
- **Block**: Estructura delimitada por llaves `{}` que agrupa contenido
- **Nested Structure**: Estructura que contiene otras estructuras en su interior

### Términos de Encoding

- **Part**: Fragmento o componente de una estructura mayor
- **PartSet**: Conjunto ordenado de parts que forman una unidad
- **Span**: Rango de posiciones en el texto fuente
- **Offset**: Posición numérica en el texto fuente
- **Encoding**: Representación binaria o compacta de estructuras sintácticas

### Términos de Strings

- **Escape Sequence**: Secuencia de caracteres que representa un carácter especial (ej: `\n`, `\"`)
- **Delimiter**: Carácter que marca inicio/fin de una estructura (ej: comillas, llaves)
- **Heredoc**: Sintaxis para strings multilínea con delimitador personalizado
- **Quote**: Comilla simple (`'`) o doble (`"`) que delimita strings

### Términos de Validación

- **Valid**: Sintácticamente correcto según las reglas del lenguaje
- **Invalid**: Sintácticamente incorrecto, produce error de parsing
- **Edge Case**: Caso límite o especial que requiere manejo particular
- **Constraint**: Restricción o regla que debe cumplirse

### Ejemplo de Uso en Documentación

```markdown
#### String Literals

String literals are delimited by single (`'`) or double (`"`) quotes. Escape sequences using backslash (`\`) allow including the delimiter character within the string.

```don
message "Hello \"world\""
path 'C:\\Users\\file.txt'
````

The lexer recognizes the escape sequence `\"` as a literal quote character rather than a string delimiter.

```

```
