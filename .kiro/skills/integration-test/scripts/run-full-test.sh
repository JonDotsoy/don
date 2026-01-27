#!/bin/bash
set -e

# Obtener el directorio del workspace
WORKSPACE_DIR=$(pwd)
TEST_DIR="/tmp/don-integration-test"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Iniciando test de integración completo...${NC}"
echo ""

# 1. Preparar entorno
echo "📁 Preparando entorno..."
"$WORKSPACE_DIR/.kiro/skills/integration-test/scripts/prepare-environment.sh"

# 2. Instalar el paquete
echo ""
echo "📥 Instalando paquete desde tarball..."
cd "$TEST_DIR"
bun add "$WORKSPACE_DIR/jondotsoy-don-0.0.8.tgz"

# 3. Ejecutar pruebas
echo ""
"$WORKSPACE_DIR/.kiro/skills/integration-test/scripts/test-runner.sh"

# 4. Volver al workspace
cd "$WORKSPACE_DIR"

echo ""
echo -e "${GREEN}✅ Test de integración completado${NC}"
