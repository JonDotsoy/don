import type { Directive } from "../../don.js";

export interface HeaderRule {
  name: string;
  value: string;
}

export type RouteAction =
  | { kind: "respond"; status: number; body: string }
  | { kind: "proxy_pass"; target: string };

export interface RouteConfig {
  method: string | null;
  path: string;
  action: RouteAction;
  headers: HeaderRule[];
}

export interface SslConfig {
  cert: string;
  key: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  http1: boolean;
  http2: boolean;
  http3: boolean;
  ssl: SslConfig | null;
  headers: HeaderRule[];
  routes: RouteConfig[];
}

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;

const toHeader = (directive: Directive): HeaderRule => ({
  name: String(directive.args[0]),
  value: String(directive.args[1]),
});

const toRoute = (directive: Directive): RouteConfig => {
  const method = directive.args.length === 2 ? String(directive.args[0]) : null;
  const path = String(directive.args[directive.args.length - 1]);

  const respond = directive.children.find((c) => c.name === "respond");
  const proxyPass = directive.children.find((c) => c.name === "proxy_pass");

  const action: RouteAction = respond
    ? {
        kind: "respond",
        status: Number(respond.args[0]),
        body: respond.args[1] !== undefined ? String(respond.args[1]) : "",
      }
    : {
        kind: "proxy_pass",
        target: String(proxyPass!.args[0]),
      };

  const headers = directive.children
    .filter((c) => c.name === "header")
    .map(toHeader);

  return { method, path, action, headers };
};

/**
 * Turns a validated `server` directive (see `proxyLintRules` for the schema
 * it's expected to satisfy) into a plain `ServerConfig`, filling in defaults
 * for every optional directive.
 */
export const toServerConfig = (server: Directive): ServerConfig => {
  const find = (name: string) => server.children.find((c) => c.name === name);
  const boolOf = (name: string, fallback: boolean): boolean => {
    const directive = find(name);
    return directive ? Boolean(directive.args[0]) : fallback;
  };

  const sslDirective = find("ssl");
  const ssl: SslConfig | null = sslDirective
    ? {
        cert: String(
          sslDirective.children.find((c) => c.name === "cert")?.args[0],
        ),
        key: String(
          sslDirective.children.find((c) => c.name === "key")?.args[0],
        ),
      }
    : null;

  return {
    host: String(find("host")?.args[0] ?? DEFAULT_HOST),
    port: Number(find("port")?.args[0] ?? DEFAULT_PORT),
    http1: boolOf("http1", true),
    http2: boolOf("http2", false),
    http3: boolOf("http3", false),
    ssl,
    headers: server.children.filter((c) => c.name === "header").map(toHeader),
    routes: server.children.filter((c) => c.name === "route").map(toRoute),
  };
};

/** Extracts every `server` block from a parsed document root. */
export const toServerConfigs = (root: Directive): ServerConfig[] =>
  (root.name === "server"
    ? [root]
    : root.children.filter((c) => c.name === "server")
  ).map(toServerConfig);

/**
 * Two `ServerConfig`s only differ in their routes/headers (safe for
 * `server.reload()`) when their network-level settings — host, port, HTTP
 * version flags, and TLS — are identical.
 */
export const sameListenTarget = (a: ServerConfig, b: ServerConfig): boolean =>
  a.host === b.host &&
  a.port === b.port &&
  a.http1 === b.http1 &&
  a.http2 === b.http2 &&
  a.http3 === b.http3 &&
  a.ssl?.cert === b.ssl?.cert &&
  a.ssl?.key === b.ssl?.key;
