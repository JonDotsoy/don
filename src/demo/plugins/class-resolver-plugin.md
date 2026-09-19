# donly/demo/plugins/class-resolver

A third demo `DonPlugin` (after `variablesPlugin` and
`createResourcesPlugin`, see [`docs/concepts/plugins.md`](../../../docs/concepts/plugins.md)):
resolves a parsed DON document straight into **your own class
instances**, instead of the generic `Directive` tree `DON.parse()`
returns by default.

```don
app "foo" {
  server {
    host "0.0.0.0"
    port 8080
  }
}
```

```ts
class App {
  server!: Server;
  constructor(public name: string) {}
}
class Server {
  host!: string;
  port!: number;
}

const app = parseAsClasses<App>(text, { app: App, server: Server });
// app instanceof App        -> true
// app.name                  -> "foo"
// app.server instanceof Server -> true
// app.server.host           -> "0.0.0.0"
// app.server.port           -> 8080
```

## Why not `DON.parse(text, { plugins: [...] })` directly?

`DON.parse()`'s return type is always `Directive` — a plugin can
transform the tree it's built from (`onDirective`), but it can never
change what `DON.parse()` itself hands back (see
[`docs/concepts/plugins.md`](../../../docs/concepts/plugins.md)). So
`createClassResolverPlugin` builds its class instances into its own
`ctx` as a side effect while parsing runs, and you read the finished
result back out of `ctx` once `DON.parse()` returns. `parseAsClasses`
below wires that up for you in one call, matching the shape the rest of
this doc uses.

## Usage

```ts
import { parseAsClasses } from "donly/demo/plugins/class-resolver";

class App {
  server!: Server;
  constructor(public name: string) {}
}
class Server {
  host!: string;
  port!: number;
}

const app = parseAsClasses<App>(text, { app: App, server: Server });
```

`parseAsClasses<T>(text, classes, extraPlugins?)`:

- `text` — the DON source to parse.
- `classes: Record<string, new (...args) => any>` — a directive name →
  constructor map. Only directives whose name is a key here become class
  instances; see [Resolution rules](#resolution-rules) for everything
  else.
- `extraPlugins?: DonPlugin[]` — other plugins to run **before** the
  class resolver, in the same `DON.parse()` call (e.g.
  `variablesPlugin`, so a `$var` reference is already resolved to its
  value by the time the class resolver sees it).

Returns the resolved root instance directly — `T`, not a `Directive`.

For lower-level control (e.g. you also want the `Directive` tree
`DON.parse()` returns, or you're composing several plugins by hand),
use the two pieces `parseAsClasses` is built from:

```ts
import { DON } from "donly";
import {
  createClassResolverPlugin,
  resolveClasses,
  type ClassResolverContext,
} from "donly/demo/plugins/class-resolver";

const ctx: ClassResolverContext = { stack: [[]] };
const plugin = {
  ...createClassResolverPlugin({ app: App, server: Server }),
  initContext: () => ctx, // keep a reference to read back after parsing
};

const directiveTree = DON.parse(text, { plugins: [plugin] });
const app = resolveClasses<App>(ctx);
```

## Resolution rules

Every directive resolves bottom-up (its children are resolved before it
is):

1. **Registered directive** (`node.name` is a key in `classes`) →
   `new classes[node.name](...node.args)`, with each child directive
   assigned onto the instance as a same-named property:
   - **one** child of that name → the child's own resolved value.
   - **two or more** (a repeated directive) → an array of them, in
     document order.
2. **Unregistered directive, no children** → unwraps to its own args:
   - **one** arg → that scalar value (`host "0.0.0.0"` → `"0.0.0.0"`).
   - **zero or several** args → an array (`route GET /health` →
     `["GET", "/health"]`).
3. **Unregistered directive, with children** (a plain `{ ... }` block
   with no matching class, e.g. `feature-flags { sso true }`) → a plain
   object of its own children, grouped the same way as rule 1 (single →
   scalar, repeated → array): `{ sso: true }`.

These three rules combine recursively, so a deeply nested document (an
`app` of several `module`s, each with its own `feature-flags` and
`routes`) resolves in one call — see the spec's "complex" tests for a
full example.

## Combining with other plugins

`extraPlugins` run first, in the same `DON.parse()` call, so their
output is what the class resolver actually sees:

```ts
import { variablesPlugin } from "donly/demo/plugins/variables";

class Container {
  constructor(public name: string) {}
}

const container = parseAsClasses<Container>(
  'set project "checkout"\ncontainer $project\n',
  { container: Container },
  [variablesPlugin],
);
// container.name -> "checkout"
```

## Notes

- Argument types (`number | string | boolean | HeredocValue`) are passed
  through to the constructor as-is — no coercion.
- A directive not covered by any rule above because the document has no
  top-level directive at all (`resolveClasses`/`parseAsClasses` on an
  empty or comment-only document) throws — there is nothing to resolve.
- A class you register is never required to declare every property the
  resolver might assign — it assigns dynamically, so `!`-asserted or
  optional fields (as in every example above) are the natural fit.
