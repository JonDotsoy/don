import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DON } from "../../don.js";
import { lint } from "../../lint.js";
import { proxyLintRules } from "./schema.js";
import { toServerConfigs } from "./config.js";
import { serve, type ProxyDemoServer } from "./http-proxy.js";

describe("donly/demo/http-proxy schema", () => {
  it("accepts a valid document without errors", () => {
    const issues = lint(
      `
server {
  port 8080
  route GET /health {
    respond 200 "OK"
  }
}
`,
      proxyLintRules,
    );

    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("reports a missing port", () => {
    const issues = lint(
      `
server {
  route /health {
    respond 200 "OK"
  }
}
`,
      proxyLintRules,
    );

    expect(
      issues.some(
        (i) => i.severity === "error" && i.message.includes("`port`"),
      ),
    ).toBe(true);
  });

  it("reports a route with neither respond nor proxy_pass", () => {
    const issues = lint(
      `
server {
  port 8080
  route /health
}
`,
      proxyLintRules,
    );

    expect(
      issues.some(
        (i) =>
          i.severity === "error" &&
          i.message.includes("requiere `respond` o `proxy_pass`"),
      ),
    ).toBe(true);
  });

  it("reports an invalid proxy_pass URL", () => {
    const issues = lint(
      `
server {
  port 8080
  route /app {
    proxy_pass "not-a-url"
  }
}
`,
      proxyLintRules,
    );

    expect(
      issues.some(
        (i) => i.severity === "error" && i.message.includes("proxy_pass"),
      ),
    ).toBe(true);
  });
});

describe("donly/demo/http-proxy config", () => {
  it("normalizes a document into ServerConfig[]", () => {
    const root = DON.parse(`
server {
  host "127.0.0.1"
  port 8080
  header "X-Powered-By" "donly"
  route GET /health {
    respond 200 "OK"
  }
  route /app {
    proxy_pass "http://localhost:3000"
  }
}
`);

    const [config] = toServerConfigs(root);
    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 8080,
      http1: true,
      http2: false,
      http3: false,
      ssl: null,
      headers: [{ name: "X-Powered-By", value: "donly" }],
    });
    expect(config!.routes).toEqual([
      {
        method: "GET",
        path: "/health",
        action: { kind: "respond", status: 200, body: "OK" },
        headers: [],
      },
      {
        method: null,
        path: "/app",
        action: { kind: "proxy_pass", target: "http://localhost:3000" },
        headers: [],
      },
    ]);
  });
});

describe("donly/demo/http-proxy serve()", () => {
  let dir: string | undefined;
  let running: ProxyDemoServer | undefined;

  afterEach(async () => {
    await running?.stop();
    running = undefined;
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("serves an immediate response and hot-reloads on edit", async () => {
    dir = await mkdtemp(join(tmpdir(), "donly-demo-proxy-"));
    const file = join(dir, "server.donly");
    await writeFile(
      file,
      `
server {
  port 0
  route GET /health {
    respond 200 "one"
  }
}
`,
    );

    running = await serve(file);
    const [server] = running.servers;
    expect(server).toBeDefined();

    const before = await fetch(`http://127.0.0.1:${server!.port}/health`);
    expect(await before.text()).toBe("one");

    await writeFile(
      file,
      `
server {
  port 0
  route GET /health {
    respond 200 "two"
  }
}
`,
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const after = await fetch(`http://127.0.0.1:${server!.port}/health`);
    expect(await after.text()).toBe("two");
  });

  it("keeps serving the last valid config when an edit introduces a lint error", async () => {
    dir = await mkdtemp(join(tmpdir(), "donly-demo-proxy-"));
    const file = join(dir, "server.donly");
    await writeFile(
      file,
      `
server {
  port 0
  route GET /health {
    respond 200 "ok"
  }
}
`,
    );

    running = await serve(file);
    const [server] = running.servers;

    await writeFile(file, `server {\n  route GET /health\n}\n`);
    await new Promise((resolve) => setTimeout(resolve, 200));

    const response = await fetch(`http://127.0.0.1:${server!.port}/health`);
    expect(await response.text()).toBe("ok");
  });
});
