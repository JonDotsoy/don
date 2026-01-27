#!/bin/bash
set -e

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio del skill
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOURCES_DIR="$SKILL_DIR/resources"
CASES_FILE="$RESOURCES_DIR/cases.json"

# Verificar que existe el archivo de casos
if [ ! -f "$CASES_FILE" ]; then
  echo -e "${RED}❌ Error: No se encontró $CASES_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 Ejecutando pruebas de integración...${NC}"
echo ""

# Copiar el test runner
echo "📦 Copiando test runner..."
cp "$SKILL_DIR/scripts/test-runner.js" test-runner.js

# Copiar casos de prueba y archivos .don
echo "📋 Copiando casos de prueba..."
cp "$CASES_FILE" cases.json

# Leer casos y copiar archivos .don
while IFS= read -r line; do
  filename=$(echo "$line" | grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  if [ -n "$filename" ] && [ -f "$RESOURCES_DIR/$filename" ]; then
    cp "$RESOURCES_DIR/$filename" .
    echo "  ✓ Copiado: $filename"
  fi
done < "$CASES_FILE"

echo ""

# Ejecutar las pruebas
node test-runner.js
EXIT_CODE=$?

# Limpiar archivos temporales
echo ""
echo "🧹 Limpiando archivos temporales..."
rm -f test-runner.js cases.json *.don

exit $EXIT_CODE
