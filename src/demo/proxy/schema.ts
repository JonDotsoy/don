import type { Directive } from "../../don.js";
import { argumentLoc, directiveLoc } from "../../lint/types.js";
import type { LintIssue } from "../../lint/types.js";
import type { LintRuleDocument, RuleBody } from "../../lint/schema.js";

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
 *
 * Written as a declarative `LintRuleDocument` (see `docs/lint/rules.md`),
 * evaluated with `lintSchema` from `donly/lint`. A handful of checks — a
 * `route`'s path sitting at a variable argument position, and the
 * respond/proxy_pass mutual exclusivity — have no declarative primitive, so
 * they use the `evaluation` escape hatch documented there.
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

const booleanRule = (name: string): RuleBody => ({
  "[1]": { type: "boolean", message: `\`${name}\` debe ser un boolean` },
});

const stringRule = (message: string): RuleBody => ({
  "[1]": { type: "string", message },
});

const headerRule: RuleBody = {
  *evaluation(directive) {
    if (directive.args.length !== 2) {
      yield {
        message: "`header` requiere exactamente 2 argumentos: nombre y valor",
        severity: "error",
        loc: directiveLoc(directive),
      };
    }
  },
  "[1]": { type: "string", message: "el nombre del header debe ser un string" },
  "[2]": { type: "string", message: "el valor del header debe ser un string" },
};

export const proxyLintRules = {
  "/server": {
    required: true,
    message: "el documento debe declarar al menos un directive `server`",

    *evaluation(directive: Directive): Iterable<LintIssue> {
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

    "/host": stringRule("`host` debe ser un string"),

    "/port": {
      min: 1,
      message: "`server` requiere un directive `port`",
      "[1]": {
        type: "number",
        gte: 0,
        lte: 65535,
        message:
          "`port` debe ser un número entre 0 y 65535 (0 asigna un puerto libre)",
      },
    },

    "/http1": booleanRule("http1"),
    "/http2": booleanRule("http2"),
    "/http3": booleanRule("http3"),

    "/ssl": {
      "/cert": stringRule(
        "`ssl/cert` debe ser un string (ruta al certificado)",
      ),
      "/key": stringRule(
        "`ssl/key` debe ser un string (ruta a la llave privada)",
      ),
    },

    "/header": headerRule,

    "/route": {
      min: 1,
      severity: "warning",
      message: "`server` debería declarar al menos un `route`",

      *evaluation(directive: Directive): Iterable<LintIssue> {
        if (directive.args.length !== 1 && directive.args.length !== 2) {
          yield {
            message: "`route` acepta `<path>` o `<method> <path>`",
            severity: "error",
            loc: directiveLoc(directive),
          };
        } else {
          const path = directive.args[directive.args.length - 1];
          if (typeof path !== "string" || !path.startsWith("/")) {
            yield {
              message:
                "el path de `route` debe ser un string que empiece con `/`",
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
            message:
              "`route` no puede declarar más de un `respond`/`proxy_pass`",
            severity: "error",
            loc: directiveLoc(directive),
          };
        }
      },

      "/respond": {
        *evaluation(directive: Directive): Iterable<LintIssue> {
          const body = directive.args[1];
          if (body !== undefined && typeof body !== "string") {
            yield {
              message: "el cuerpo de `respond` debe ser un string",
              severity: "error",
              loc: argumentLoc(directive, 1),
            };
          }
        },
        "[1]": {
          type: "number",
          message:
            "`respond` requiere un status numérico como primer argumento",
        },
      },

      "/proxy_pass": {
        "[1]": {
          type: "string",
          message: "`proxy_pass` requiere una URL como string",
          *evaluation(argument, position, directive) {
            if (typeof argument !== "string") return;
            try {
              new URL(argument);
            } catch {
              yield {
                message: `\`proxy_pass\` no es una URL válida: ${argument}`,
                severity: "error",
                loc: argumentLoc(directive, position - 1),
              };
            }
          },
        },
      },

      "/header": headerRule,
    },
  },
} satisfies LintRuleDocument;
