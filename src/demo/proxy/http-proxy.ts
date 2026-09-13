import { watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DON } from "../../don.js";
import { lint, type LintIssue } from "../../lint.js";
import { proxyLintRules } from "./schema.js";

export { proxyLintRules } from "./schema.js";
export type { ServerConfig, RouteConfig, HeaderRule } from "./config.js";
import {
  sameListenTarget,
  toServerConfigs,
  type HeaderRule,
  type RouteConfig,
  type ServerConfig,
} from "./config.js";

const DEV_CERT_URL = new URL("./certs/dev-cert.pem", import.meta.url);
const DEV_KEY_URL = new URL("./certs/dev-key.pem", import.meta.url);

export interface ProxyDemoServer {
  /** The live `Bun.Server` instances, one per `server` block, in document order. */
  readonly servers: readonly Bun.Server<undefined>[];
  /** Stops watching the file and stops every listening server. */
  stop(): Promise<void>;
}

const resolveFilePath = (patch: string | URL): string => {
  if (patch instanceof URL) return fileURLToPath(patch);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(patch)) return fileURLToPath(patch);
  return patch;
};

const severityConsole = {
  error: "error",
  warning: "warn",
  info: "log",
} as const;

const logIssues = (payload: string, issues: LintIssue[]): void => {
  for (const issue of issues) {
    const trace = issue.trace ?? payload;
    console[severityConsole[issue.severity]](
      `[donly/demo/http-proxy] ${trace} ${issue.severity}: ${issue.message}`,
    );
  }
};

const matchRoute = (
  routes: RouteConfig[],
  method: string,
  pathname: string,
): RouteConfig | undefined =>
  routes.find((route) => {
    if (route.method !== null && route.method !== method) return false;
    if (route.path === pathname) return true;
    return (
      route.action.kind === "proxy_pass" &&
      pathname.startsWith(
        route.path.endsWith("/") ? route.path : `${route.path}/`,
      )
    );
  });

const applyHeaders = (headers: Headers, rules: HeaderRule[]): void => {
  for (const rule of rules) headers.set(rule.name, rule.value);
};

const buildProxyTarget = (route: RouteConfig, url: URL): URL => {
  if (route.action.kind !== "proxy_pass") throw new Error("unreachable");
  const target = new URL(route.action.target);
  const remainder =
    url.pathname === route.path ? "" : url.pathname.slice(route.path.length);
  target.pathname = target.pathname.replace(/\/$/, "") + remainder;
  target.search = url.search;
  return target;
};

/** Builds the `fetch` handler for one `server` block from its config. */
const buildFetch = (config: ServerConfig) =>
  async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const headers = new Headers();
    applyHeaders(headers, config.headers);

    const route = matchRoute(config.routes, req.method, url.pathname);
    if (!route) return new Response("Not Found", { status: 404, headers });

    applyHeaders(headers, route.headers);

    if (route.action.kind === "respond") {
      return new Response(route.action.body, {
        status: route.action.status,
        headers,
      });
    }

    const target = buildProxyTarget(route, url);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const upstream = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? req.body : undefined,
      redirect: "manual",
      ...(hasBody ? { duplex: "half" as const } : {}),
    });

    const response = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
    applyHeaders(response.headers, config.headers);
    applyHeaders(response.headers, route.headers);
    return response;
  };

const buildTls = (config: ServerConfig) => {
  if (!config.http2 && !config.http3) return undefined;
  const source = config.ssl ?? { cert: DEV_CERT_URL, key: DEV_KEY_URL };
  if (!config.ssl) {
    console.warn(
      "[donly/demo/http-proxy] http2/http3 sin `ssl`, usando el certificado de desarrollo incluido (no usar en producción)",
    );
  }
  if (config.http3) {
    console.warn(
      "[donly/demo/http-proxy] http3 (QUIC) no está soportado por Bun; el servidor atenderá por HTTP/2 sobre TLS",
    );
  }
  return {
    cert: Bun.file(source.cert),
    key: Bun.file(source.key),
  };
};

const startServer = (config: ServerConfig): Bun.Server<undefined> =>
  Bun.serve({
    hostname: config.host,
    port: config.port,
    tls: buildTls(config),
    fetch: buildFetch(config),
  });

/**
 * Reads the DON file at `patch` (a path or a `file://` URL), lints it
 * against the `donly/demo/http-proxy` schema, and starts one `Bun.serve()`
 * instance per `server` block it declares.
 *
 * The file is then watched for changes:
 * - An invalid edit is reported to the console and the running servers are
 *   left untouched.
 * - A valid edit that only changes routes/headers of a `server` block is
 *   applied in place with `server.reload()`.
 * - A valid edit that changes a `server`'s host, port, or TLS/HTTP settings
 *   restarts that server (`server.stop()` + `Bun.serve()`).
 */
export const serve = async (patch: string | URL): Promise<ProxyDemoServer> => {
  const filePath = resolveFilePath(patch);

  let configs: ServerConfig[] = [];
  let servers: Bun.Server<undefined>[] = [];

  const load = async (): Promise<ServerConfig[] | null> => {
    const text = await readFile(filePath, "utf8");
    const root = DON.parse(text);
    const issues = lint(root, proxyLintRules, { payload: filePath });
    logIssues(filePath, issues);
    if (issues.some((issue) => issue.severity === "error")) {
      console.error(
        `[donly/demo/http-proxy] ${filePath}: se detectaron errores, se conserva la configuración anterior`,
      );
      return null;
    }
    return toServerConfigs(root);
  };

  const startAll = (nextConfigs: ServerConfig[]): void => {
    configs = nextConfigs;
    servers = configs.map(startServer);
  };

  const applyUpdate = async (): Promise<void> => {
    const nextConfigs = await load();
    if (!nextConfigs) return;

    if (nextConfigs.length !== configs.length) {
      for (const server of servers) server.stop();
      startAll(nextConfigs);
      return;
    }

    nextConfigs.forEach((nextConfig, index) => {
      const server = servers[index]!;
      if (sameListenTarget(nextConfig, configs[index]!)) {
        server.reload({ fetch: buildFetch(nextConfig) });
      } else {
        server.stop();
        servers[index] = startServer(nextConfig);
      }
    });
    configs = nextConfigs;
  };

  const initial = await load();
  if (!initial || initial.length === 0) {
    throw new Error(
      `[donly/demo/http-proxy] ${filePath}: no se pudo iniciar, revisa los errores de lint reportados`,
    );
  }
  startAll(initial);

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const watcher: FSWatcher = watch(filePath, { persistent: true }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      applyUpdate().catch((error) => {
        console.error(`[donly/demo/http-proxy] error al recargar:`, error);
      });
    }, 50);
  });

  return {
    get servers() {
      return servers;
    },
    async stop() {
      clearTimeout(debounce);
      watcher.close();
      await Promise.all(servers.map((server) => server.stop()));
    },
  };
};
