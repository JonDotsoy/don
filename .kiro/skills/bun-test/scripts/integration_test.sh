#!/bin/bash
set -e

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Prueba de Integración ===${NC}"

# 1. Empaquetar el proyecto
echo -e "${BLUE}[1/5] Empaquetando proyecto...${NC}"
npm pack

# Obtener el nombre del paquete generado
PACKAGE_NAME=$(node -p "require('./package.json').name.replace('@', '').replace('/', '-')")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
PACKAGE_FILE="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"

if [ ! -f "$PACKAGE_FILE" ]; then
    echo -e "${RED}Error: No se encontró el archivo $PACKAGE_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Paquete creado: $PACKAGE_FILE${NC}"

# Guardar el directorio actual
ORIGINAL_DIR="$(pwd)"

# 2. Crear carpeta temporal
TMP_DIR="/tmp/${PACKAGE_NAME}-integration-test"
echo -e "${BLUE}[2/5] Creando directorio temporal: $TMP_DIR${NC}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# 3. Inicializar proyecto
echo -e "${BLUE}[3/5] Inicializando proyecto de prueba...${NC}"
cd "$TMP_DIR"
npm init -y > /dev/null
# Configurar como módulo ES
node -e "const pkg = require('./package.json'); pkg.type = 'module'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));"

# 4. Instalar el paquete
echo -e "${BLUE}[4/5] Instalando paquete...${NC}"
PACKAGE_PATH="$ORIGINAL_DIR/$PACKAGE_FILE"
npm install "$PACKAGE_PATH"

echo -e "${GREEN}✓ Paquete instalado${NC}"

# 5. Validar con script de prueba
echo -e "${BLUE}[5/5] Ejecutando script de prueba...${NC}"

# Crear script de prueba si se proporciona como argumento
if [ -n "$1" ]; then
    TEST_SCRIPT="$1"
else
    # Script de prueba por defecto
    cat > testscript.js << 'EOF'
// Script de prueba de integración por defecto
import { SyntaxEncode } from '@jondotsoy/don';

console.log('✓ Importación exitosa');

// Verificar que SyntaxEncode existe y es una clase
if (typeof SyntaxEncode === 'function') {
    console.log('✓ SyntaxEncode es una clase/función');
    
    // Probar instanciación básica
    const encoder = new SyntaxEncode();
    console.log('✓ Instanciación exitosa');
    
    // Probar encoding básico
    const result = encoder.encode('test');
    if (result) {
        console.log('✓ Encoding básico funciona');
    }
} else {
    throw new Error('SyntaxEncode no está disponible');
}

console.log('\n✅ Todas las pruebas de integración pasaron');
EOF
    TEST_SCRIPT="testscript.js"
fi

node "$TEST_SCRIPT"

echo -e "${GREEN}✓ Prueba de integración completada exitosamente${NC}"

# Limpiar
cd "$ORIGINAL_DIR"
echo -e "${BLUE}Limpiando archivos temporales...${NC}"
rm -rf "$TMP_DIR"
rm -f "$PACKAGE_FILE"

echo -e "${GREEN}=== Prueba de Integración Finalizada ===${NC}"
