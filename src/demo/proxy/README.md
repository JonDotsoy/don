# donly/demo/http-proxy

A hot-reloading HTTP reverse proxy / mock server driven by a DON file,
built on top of `donly` and [`Bun.serve()`](https://bun.sh/docs/api/http).

## Usage

Create a `.donly` file describing one or more servers:

```don
# my-donly-server-file.donly
server {
  host "0.0.0.0"
  port 8080
  http1 true
  http2 false
  http3 false

  header "X-Powered-By" "donly-demo-proxy"

  route GET /api/health {
    respond 200 "OK"
  }

  route /app {
    proxy_pass "http://localhost:3000"
    header "X-Forwarded-Host" "example.com"
  }
}
```

Then start it:

```ts
import { serve } from "donly/demo/http-proxy";

const server = await serve("./my-donly-server-file.donly");
```

`serve()` also accepts a `file://` URL:

```ts
const server = await serve(
  new URL("./my-donly-server-file.donly", import.meta.url),
);
```

It returns a `ProxyDemoServer`:

- `servers: Bun.Server[]` — the live server instances, one per `server` block.
- `stop(): Promise<void>` — stops watching the file and stops every server.

## Schema

- `server { ... }` — one per listening instance; declare as many as you need.
  - `host <string>` — optional, defaults to `"0.0.0.0"`.
  - `port <number>` — required, `0`-`65535` (`0` lets the OS assign a free port).
  - `http1 <boolean>` — optional, defaults to `true`.
  - `http2 <boolean>` / `http3 <boolean>` — optional, default `false`. Both
    require TLS. Bun negotiates HTTP/2 over TLS automatically; Bun has no
    native HTTP/3 (QUIC) support, so a `http3 true` server still serves
    HTTP/2 over TLS and a warning is printed.
  - `ssl { cert <path> key <path> }` — optional. When `http2`/`http3` is
    `true` and no `ssl` block is given, the bundled development certificate
    (`certs/dev-cert.pem` / `certs/dev-key.pem`) is used instead — **do not
    use it in production**.
  - `header <name> <value>` — injects a response header on every route.
    Repeatable.
  - `route [method] <path> { ... }` — `method` (`GET`, `POST`, ...) is
    optional; omitting it matches any method. Exactly one of `respond` /
    `proxy_pass` is required inside the block.
    - `respond <status> <body>` — replies immediately with a fixed status
      and body.
    - `proxy_pass <url>` — reverse-proxies the request to `url`, forwarding
      the method, headers, and body, and appending the part of the request
      path past `route`'s own path.
    - `header <name> <value>` — injects a response header for this route
      only (in addition to the server-level ones). Repeatable.

See [`example.donly`](./example.donly) for a complete two-server example
(one plain HTTP server, one HTTP/2 server using the default dev certificate).

## Lint

Every read of the file — the initial one and every reload — is validated
with `donly/lint` against the schema above (`proxyLintRules`, exported from
`donly/demo/http-proxy`). Issues are printed to the console as
`[donly/demo/http-proxy] <file>:<line>:<col> <severity>: <message>`.

- `error` — the file is rejected: on the initial call `serve()` throws; on a
  later edit, the previously running servers are left untouched.
- `warning` / `info` — printed, but the file is still applied (e.g. missing
  routes, or falling back to the bundled dev certificate).

## Hot reload

The file is watched for changes. On every change:

1. The file is re-read and linted.
2. If it has errors, they are logged and the running servers keep serving
   the last valid configuration.
3. Otherwise, each `server` block is compared against its previous version:
   - If only its `route`/`header` directives changed, the update is applied
     in place with `server.reload()` — no dropped connections.
   - If `host`, `port`, `http1`/`http2`/`http3`, or `ssl` changed, that
     server is restarted (`server.stop()` then a new `Bun.serve()` call).
   - If the number of `server` blocks changed, every server is stopped and
     restarted from the new file.
