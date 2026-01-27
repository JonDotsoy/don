---
name: Integration Test
description: Ejecuta pruebas de integración del paquete @jondotsoy/don instalándolo desde un tarball en un entorno temporal aislado para validar su funcionamiento en condiciones reales de uso.
---

# Integration Test Skill

Este skill automatiza el proceso de pruebas de integración para el paquete `@jondotsoy/don`.

## Objetivo

Validar que el paquete se puede instalar y usar correctamente en un proyecto externo, simulando el flujo real de un usuario final.

## Cuándo usar este skill

- Antes de publicar una nueva versión del paquete
- Después de cambios significativos en el código
- Para verificar que el empaquetado funciona correctamente
- Cuando se necesita validar la API pública del paquete

## Proceso

1. **Empaquetar el proyecto**: Ejecuta `npm pack` para generar el tarball
2. **Preparar entorno**: Usa `scripts/prepare-environment.sh` para crear un directorio temporal
3. **Instalar paquete**: Instala el tarball en el entorno temporal usando `bun add`
4. **Ejecutar casos de prueba**: Usa `scripts/test-runner.sh` que carga los casos desde `resources/cases.json` y ejecuta cada archivo `.don`
5. **Validar resultados**: Verifica que todos los casos pasen correctamente
6. **Limpiar**: Elimina archivos temporales

## Recursos incluidos

### Scripts

- `scripts/prepare-environment.sh`: Prepara el entorno de pruebas en `/tmp/don-integration-test`
  - Soporta flag `--no-clean` para evitar limpiar el directorio existente
- `scripts/test-runner.sh`: Orquesta la ejecución de las pruebas
  - Copia `test-runner.js` y archivos de recursos
  - Ejecuta las pruebas y reporta resultados
  - Limpia archivos temporales al finalizar
- `scripts/test-runner.js`: Lógica de ejecución de tests
  - Lee casos desde `cases.json`
  - Parsea cada archivo `.don` usando `DON.parse()`
  - Genera reporte con tabla de resultados
- `scripts/run-full-test.sh`: Script completo que ejecuta todo el flujo
  - Prepara entorno
  - Instala paquete
  - Ejecuta pruebas
  - Retorna al workspace

### Resources

- `resources/cases.json`: Array de objetos con `name` (nombre del archivo .don) y `description`
- `resources/*.don`: Archivos de ejemplo para probar el parser

## Uso

### Opción 1: Script completo (recomendado)

```bash
# Ejecuta todo el flujo automáticamente
.kiro/skills/integration-test/scripts/run-full-test.sh
```

### Opción 2: Paso a paso

```bash
# 1. Empaquetar el proyecto
npm pack

# 2. Preparar entorno
.kiro/skills/integration-test/scripts/prepare-environment.sh

# 3. Instalar paquete (desde /tmp/don-integration-test)
cd /tmp/don-integration-test
bun add /ruta/al/workspace/jondotsoy-don-0.0.8.tgz

# 4. Ejecutar pruebas
/ruta/al/workspace/.kiro/skills/integration-test/scripts/test-runner.sh
```

### Agregar nuevos casos de prueba

1. Crear archivo `.don` en `resources/`
2. Agregar entrada en `resources/cases.json`:
   ```json
   {
     "name": "test-5.don",
     "description": "Descripción del test"
   }
   ```

## Resultado esperado

Todos los casos de prueba deben pasar exitosamente, mostrando:

- ✓ para cada test exitoso
- Una tabla resumen con el estado de cada test
- Total de tests ejecutados, pasados y fallidos
