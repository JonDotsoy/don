#!/bin/bash
set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio temporal para las pruebas
TEST_DIR="/tmp/don-integration-test"

# Flag para evitar limpiar el directorio (usar --no-clean)
NO_CLEAN=false
if [[ "$1" == "--no-clean" ]]; then
  NO_CLEAN=true
fi

echo -e "${BLUE}🧪 Preparando entorno de pruebas...${NC}"

# Limpiar directorio temporal si existe (a menos que se use --no-clean)
if [ -d "$TEST_DIR" ] && [ "$NO_CLEAN" = false ]; then
  echo "🧹 Limpiando directorio temporal existente..."
  rm -rf "$TEST_DIR"
elif [ -d "$TEST_DIR" ] && [ "$NO_CLEAN" = true ]; then
  echo "⏭️  Saltando limpieza (--no-clean activado)"
fi

# Crear directorio temporal
echo "📁 Creando directorio temporal: $TEST_DIR"
mkdir -p "$TEST_DIR"

# Cambiar al directorio temporal
cd "$TEST_DIR"

# Inicializar proyecto npm
echo "📦 Inicializando proyecto npm..."
npm init -y > /dev/null 2>&1

# Configurar como módulo ES
echo "⚙️  Configurando módulo ES..."
npm pkg set type=module

echo -e "${GREEN}✅ Entorno preparado en: $TEST_DIR${NC}"
echo ""
echo "Directorio actual: $(pwd)"
