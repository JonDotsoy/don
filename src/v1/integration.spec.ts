import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ALLOW_INTEGRATION_TEST = process.env.ALLOW_INTEGRATION_TEST==='1'

describe.if(ALLOW_INTEGRATION_TEST)("SyntaxEncode Integration Tests - Package Installation", () => {
  let tempDir: string;
  let packagePath: string;

  beforeAll(() => {
    // Crear directorio temporal
    tempDir = mkdtempSync(join(tmpdir(), "don-integration-test-"));
    
    // Empaquetar el proyecto con npm pack
    console.log("Empaquetando el proyecto...");
    const packOutput = execSync("npm pack", { 
      cwd: process.cwd(),
      encoding: "utf-8" 
    });
    
    // Extraer solo el nombre del archivo .tgz (última línea del output)
    const lines = packOutput.trim().split("\n");
    const tgzFileName = lines[lines.length - 1].trim();
    packagePath = join(process.cwd(), tgzFileName);
    console.log(`Paquete creado: ${packagePath}`);
  });

  afterAll(() => {
    // Limpiar directorio temporal
    // rmSync(tempDir, { recursive: true, force: true });
    
    // // Limpiar el archivo .tgz si existe
    // if (existsSync(packagePath)) {
    //   rmSync(packagePath, { force: true });
    // }
  });

  test("should install package and run integration test", () => {
    // Crear package.json en el directorio temporal
    const packageJson = {
      name: "don-integration-test",
      version: "1.0.0",
      type: "module"
    };
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );

    // Instalar el paquete empaquetado
    console.log("Instalando el paquete...");
    execSync(`npm install ${packagePath}`, {
      cwd: tempDir,
      stdio: "inherit"
    });

    // Crear archivo de prueba
    const testScript = `
import { SyntaxEncode } from "@jondotsoy/don";

const e = new SyntaxEncode().encode(\`tar biz {lop 32}   \`);

// Verificaciones
if (!e) {
  console.error("Error: e is undefined");
  process.exit(1);
}

if (!e.children || e.children.length === 0) {
  console.error("Error: No children found");
  process.exit(1);
}

const firstDirective = e.children[0];
if (firstDirective.name.text() !== "tar") {
  console.error(\`Error: Expected name 'tar', got '\${firstDirective.name.text()}'\`);
  process.exit(1);
}

if (firstDirective.args.length === 0 || firstDirective.args[0].text() !== "biz") {
  console.error("Error: Expected first arg 'biz'");
  process.exit(1);
}

if (firstDirective.children.length === 0) {
  console.error("Error: Expected children");
  process.exit(1);
}

const innerDirective = firstDirective.children[0];
if (innerDirective.name.text() !== "lop") {
  console.error(\`Error: Expected inner name 'lop', got '\${innerDirective.name.text()}'\`);
  process.exit(1);
}

console.log("✓ Todas las verificaciones pasaron");
console.log("Estructura parseada:");
console.log(JSON.stringify(firstDirective.toJSON(), null, 2));
process.exit(0);
`;

    writeFileSync(join(tempDir, "test.js"), testScript, "utf-8");

    // Ejecutar el archivo de prueba con node
    console.log("Ejecutando prueba de integración...");
    const output = execSync("node test.js", {
      cwd: tempDir,
      encoding: "utf-8"
    });

    console.log(output);

    // Verificar que la salida contiene el mensaje de éxito
    expect(output).toContain("✓ Todas las verificaciones pasaron");
    expect(output).toContain("Estructura parseada:");
  });

  test("should handle package import and export correctly", () => {
    // Crear otro test que verifica las exportaciones
    const testScript = `
import { SyntaxEncode, DON, Directive } from "@jondotsoy/don";

// Verificar que las exportaciones existen
if (typeof SyntaxEncode !== "function") {
  console.error("Error: SyntaxEncode is not a function");
  process.exit(1);
}

if (typeof DON !== "function") {
  console.error("Error: DON is not a function");
  process.exit(1);
}

if (typeof Directive !== "function") {
  console.error("Error: Directive is not a function");
  process.exit(1);
}

console.log("✓ Todas las exportaciones están disponibles");
process.exit(0);
`;

    writeFileSync(join(tempDir, "test-exports.js"), testScript, "utf-8");

    const output = execSync("node test-exports.js", {
      cwd: tempDir,
      encoding: "utf-8"
    });

    expect(output).toContain("✓ Todas las exportaciones están disponibles");
  });
});
