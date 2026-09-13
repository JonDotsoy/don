import { argumentLoc, directiveLoc, type LintRule } from "../../lint.js";

/**
 * DON schema for the `donly/demo/http-proxy` example:
 *
 * ```don
 * server {
 *   host "0.0.0.0"
 *   port 8080
 *   http1 true
 *   http2 false
 *   http3 false
 *
 *   ssl {
 *     cert "./certs/server.crt"
 *     key "./certs/server.key"
 *   }
 *
 *   header "X-Powered-By" "donly-demo-proxy"
 *
 *   route GET /api/health {
 *     respond 200 "OK"
 *   }
 *
 *   route /app {
 *     proxy_pass "http://localhost:3000"
 *     header "X-Forwarded-Host" "example.com"
 *   }
 * }
 * ```
 *
 * - `server { ... }` — one per listening instance; the document may declare
 *   more than one.
 * - `host <string>` — optional, defaults to `"0.0.0.0"`.
 * - `port <number>` — required.
 * - `http1 <boolean>` — optional, defaults to `true`.
 * - `http2 <boolean>` / `http3 <boolean>` — optional, default `false`. Both
 *   require TLS (Bun negotiates HTTP/2 over TLS automatically); when either
 *   is `true` and no `ssl` block is given, the bundled dev certificate is
 *   used instead.
 * - `ssl { cert <path> key <path> }` — optional TLS certificate/key pair.
 * - `header <name> <value>` — injects a response header; valid at server
 *   level (applied to every route) or nested inside a `route` (applied to
 *   that route only).
 * - `route [method] <path> { ... }` — `method` is optional (matches any
 *   method when omitted). Exactly one of `respond`/`proxy_pass` is required
 *   inside its block.
 * - `respond <status> <body>` — replies immediately with a fixed status and
 *   body.
 * - `proxy_pass <url>` — reverse-proxies the request to `url`.
 */

const HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "CONNECT",
  "OPTIONS",
  "TRACE",
  "PATCH",
]);

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

export const proxyLintRules: LintRule[] = [
  {
    // At least one `server` block must exist. A document with exactly one
    // top-level directive is unwrapped by `DON.parse()`, so `directive`
    // itself may already be the (only) `server` block.
    *evaluation({ directive }) {
      const hasServer =
        directive.name === "server" ||
        directive.children.some((c) => c.name === "server");
      if (!hasServer) {
        yield {
          message: "el documento debe declarar al menos un directive `server`",
          severity: "error",
          loc: directiveLoc(directive),
        };
      }
    },
  },
  {
    path: "/server",
    *evaluation({ directive }) {
      const hasPort = directive.children.some((c) => c.name === "port");
      if (!hasPort) {
        yield {
          message: "`server` requiere un directive `port`",
          severity: "error",
          loc: directiveLoc(directive),
        };
      }

      const hasRoute = directive.children.some((c) => c.name === "route");
      if (!hasRoute) {
        yield {
          message: "`server` debería declarar al menos un `route`",
          severity: "warning",
          loc: directiveLoc(directive),
        };
      }

      const http2 = directive.children.find((c) => c.name === "http2");
      const http3 = directive.children.find((c) => c.name === "http3");
      const hasSsl = directive.children.some((c) => c.name === "ssl");
      if (
        !hasSsl &&
        ((http2 && http2.args[0] === true) || (http3 && http3.args[0] === true))
      ) {
        yield {
          message:
            "http2/http3 requieren TLS; no se declaró `ssl`, se usará el certificado de desarrollo por defecto",
          severity: "info",
          loc: directiveLoc(http2 ?? http3!),
        };
      }
    },
  },
  {
    path: "/server/host",
    *evaluation({ directive }) {
      if (typeof directive.args[0] !== "string") {
        yield {
          message: "`host` debe ser un string",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
    },
  },
  {
    path: "/server/port",
    *evaluation({ directive }) {
      const value = directive.args[0];
      if (typeof value !== "number") {
        yield {
          message: "`port` debe ser un número",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
        return;
      }
      if (value < 0 || value > 65535) {
        yield {
          message:
            "`port` debe estar entre 0 y 65535 (0 asigna un puerto libre)",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
    },
  },
  ...(["http1", "http2", "http3"] as const).map(
    (name): LintRule => ({
      path: `/server/${name}`,
      *evaluation({ directive }) {
        if (!isBoolean(directive.args[0])) {
          yield {
            message: `\`${name}\` debe ser un boolean`,
            severity: "error",
            loc: argumentLoc(directive, 0),
          };
        }
      },
    }),
  ),
  {
    path: "/server/ssl/cert",
    *evaluation({ directive }) {
      if (typeof directive.args[0] !== "string") {
        yield {
          message: "`ssl/cert` debe ser un string (ruta al certificado)",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
    },
  },
  {
    path: "/server/ssl/key",
    *evaluation({ directive }) {
      if (typeof directive.args[0] !== "string") {
        yield {
          message: "`ssl/key` debe ser un string (ruta a la llave privada)",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
    },
  },
  ...(["/server/header", "/server/route/header"] as const).map(
    (path): LintRule => ({
      path,
      *evaluation({ directive }) {
        if (directive.args.length !== 2) {
          yield {
            message:
              "`header` requiere exactamente 2 argumentos: nombre y valor",
            severity: "error",
            loc: directiveLoc(directive),
          };
          return;
        }
        if (typeof directive.args[0] !== "string") {
          yield {
            message: "el nombre del header debe ser un string",
            severity: "error",
            loc: argumentLoc(directive, 0),
          };
        }
        if (typeof directive.args[1] !== "string") {
          yield {
            message: "el valor del header debe ser un string",
            severity: "error",
            loc: argumentLoc(directive, 1),
          };
        }
      },
    }),
  ),
  {
    path: "/server/route",
    *evaluation({ directive }) {
      if (directive.args.length !== 1 && directive.args.length !== 2) {
        yield {
          message: "`route` acepta `<path>` o `<method> <path>`",
          severity: "error",
          loc: directiveLoc(directive),
        };
        return;
      }

      const path = directive.args[directive.args.length - 1];
      if (typeof path !== "string" || !path.startsWith("/")) {
        yield {
          message: "el path de `route` debe ser un string que empiece con `/`",
          severity: "error",
          loc: argumentLoc(directive, directive.args.length - 1),
        };
      }

      if (directive.args.length === 2) {
        const method = directive.args[0];
        if (typeof method !== "string" || !HTTP_METHODS.has(method)) {
          yield {
            message: `método HTTP inválido, esperado uno de: ${[...HTTP_METHODS].join(", ")}`,
            severity: "error",
            loc: argumentLoc(directive, 0),
          };
        }
      }

      const respond = directive.children.filter((c) => c.name === "respond");
      const proxyPass = directive.children.filter(
        (c) => c.name === "proxy_pass",
      );
      if (respond.length + proxyPass.length === 0) {
        yield {
          message: "`route` requiere `respond` o `proxy_pass`",
          severity: "error",
          loc: directiveLoc(directive),
        };
      }
      if (respond.length + proxyPass.length > 1) {
        yield {
          message: "`route` no puede declarar más de un `respond`/`proxy_pass`",
          severity: "error",
          loc: directiveLoc(directive),
        };
      }
    },
  },
  {
    path: "/server/route/respond",
    *evaluation({ directive }) {
      const [status, body] = directive.args;
      if (typeof status !== "number") {
        yield {
          message:
            "`respond` requiere un status numérico como primer argumento",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
      if (body !== undefined && typeof body !== "string") {
        yield {
          message: "el cuerpo de `respond` debe ser un string",
          severity: "error",
          loc: argumentLoc(directive, 1),
        };
      }
    },
  },
  {
    path: "/server/route/proxy_pass",
    *evaluation({ directive }) {
      const target = directive.args[0];
      if (typeof target !== "string") {
        yield {
          message: "`proxy_pass` requiere una URL como string",
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
        return;
      }
      try {
        new URL(target);
      } catch {
        yield {
          message: `\`proxy_pass\` no es una URL válida: ${target}`,
          severity: "error",
          loc: argumentLoc(directive, 0),
        };
      }
    },
  },
];
