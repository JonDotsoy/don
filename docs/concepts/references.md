---
title: References (design draft)
description: Three experimental, not-yet-implemented proposals for referencing values across a DON document — a "&" splice/join operator, "$"/"${}" variables inherited from Nginx, and a "$ref" directive inherited from JSON Schema.
lang: en
---

# References

> **Status: design draft.** Nothing on this page is implemented. There is
> no `&` splice operator, no `$`/`${...}` variable syntax, no `set`
> directive, and no `SyntaxKind` for any of them in the current parser —
> this document exists to work through the design before any of it is
> built. See [Path Expressions](./path-expression.md) for the one
> reference-like mechanism that *is* implemented today (`find`/`at`,
> read-only, used by application code after parsing — not a syntax
> inside a `.don` file).

DON's grammar has no way, today, for one directive to point at a value
held by another — every value has to be written out in full at every
place it's used. This page sketches two independent, experimental ways to
close that gap, both still open for revision.

## Proposal 1: the `&` join/splice operator

A path expression (see [Path Expressions](./path-expression.md)) prefixed
with `&`, used as a subdirective or in argument position, splices the
referenced directive's `args`/`children` into the place it appears —
resolved once, at load/build time, not deferred like a Terraform
attribute reference.

```don
athorization {
  bearer
  basic
}

ssl_key fanny

route GET /settings {
  athorization {
    &/athorization
  }

  proxy_pass http://10.0.0.1:3000/settings
}

route GET /api {
  athorization {
    &/athorization
    apikey
  }
  ssl {
    load_key &/ssl_key[1]
  }
  header ssl_loaded "key name loaded ${&/ssl_key[1]}"
  proxy_pass http://10.0.0.1:3000/api
}
```

Two positions for `&` appear in the example above, each with different
splice semantics:

- **As a bare subdirective** (`&/athorization` inside `athorization { }`)
  — splices the referenced directive's **children** into the current
  block, in place, alongside any sibling directives already there. This
  is what lets `route GET /api`'s `athorization` block end up with
  `bearer`, `basic`, **and** `apikey` — the spliced children and the
  locally-written `apikey` sit side by side.
- **As an argument** (`load_key &/ssl_key[1]`) — resolves to a single
  value: the argument at position `[1]` of the referenced directive
  (`ssl_key fanny` → `fanny`), following the same `[N]` argument-selector
  syntax `at()` already uses.

Resolving the example document (each `&...` replaced by what it points
at) produces:

```don
route GET /settings {
  athorization {
    bearer
    basic
  }
  proxy_pass http://10.0.0.1:3000/settings
}

route GET /api {
  athorization {
    bearer
    basic
    apikey
  }
  ssl {
    load_key fanny
  }
  header ssl_loaded "key name loaded fanny"
  proxy_pass http://10.0.0.1:3000/api
}
```

Note the last line: `&/ssl_key[1]` also appears *inside a string*
(`"key name loaded ${&/ssl_key[1]}"`), wrapped in `${...}`. That's not
part of this proposal — it's proposal 2's interpolation syntax, applied
to a `&` path instead of a `$variable`. See [Open
questions](#open-questions) below for why mixing the two sigils this way
is exactly the part still unresolved.

## Proposal 2: `$`/`${...}` variables (inherited from Nginx)

A second, independent proposal borrows Nginx's variable model: a `set`
directive binds a name, and `$name` / `${name}` interpolates that
binding's value into a string or bare argument.

```don
set backend http://10.0.0.1:3000

route GET /home {
  proxy_pass ${backend}
}

route GET /settings {
  proxy_pass "${backend}/settings"
}

route GET /api {
  proxy_pass ${backend}/api
}
```

- `set <name> <value>` defines a variable, the same way Nginx's `set
  $foo bar;` does, minus the leading `$` on the declaration itself.
- `$name` or `${name}` reads it back, either as a whole bare argument
  (`proxy_pass ${backend}`) or interpolated inside a quoted string
  (`"${backend}/settings"`).

Unlike proposal 1's `&` splice (resolved once against the static
document tree), this is closer to the string-substitution model — the
value is dropped into a larger string or argument, not spliced as a
directive's children.

## Proposal 3: a `$ref` directive (inherited from JSON Schema)

A third, independent proposal reuses JSON Schema/JSON Reference's idea —
a reserved key whose value is a pointer, e.g. `{ "$ref": "#/definitions/defaults" }`
— but expressed as an ordinary DON directive instead of a new sigil.

This works with **zero grammar changes**: `$` is already a legal
identifier character in DON (see the
[spec](../specs/v1/spec.md#23-identifiers)), so `$ref` is just a keyword
like `host` or `route` — no new `SyntaxKind`, no new lexer rule. The
directive's argument is a path expression (the same syntax
`find`/`at`/proposal 1's `&` already use), not a JSON Pointer, so there's
no `#` involved either:

```don
athorization {
  bearer
  basic
}

ssl_key fanny

route GET /settings {
  athorization {
    $ref "/athorization"
  }
  proxy_pass http://10.0.0.1:3000/settings
}

route GET /api {
  athorization {
    $ref "/athorization"
    apikey
  }
  ssl {
    load_key $ref "/ssl_key[1]"
  }
  proxy_pass http://10.0.0.1:3000/api
}
```

- **As a subdirective** (`$ref "/athorization"` inside `athorization {
  }`) — splices the referenced directive's children into the current
  block, alongside `apikey`. Identical outcome to proposal 1's
  `&/athorization`, but as a plain directive call instead of a sigil
  glued onto the path.
- **As an argument value** (`load_key $ref "/ssl_key[1]"`) — this is
  where the zero-grammar-change advantage runs out: DON arguments today
  are atoms (string/number/boolean/null/heredoc), not nested directive
  calls, so `load_key`'s second "argument" being itself a `$ref`
  invocation is new grammar, not a reuse of an existing rule the way the
  subdirective form is. Confining `$ref` to subdirective position only
  — and letting a directive like `load_key` take a plain path *string*
  as its own argument, resolved by whatever reads `load_key`, without
  any `$ref`/sigil wrapper — sidesteps that, at the cost of `$ref` no
  longer being usable everywhere proposal 1's `&` is.
- **Inside a string template** (the `header ssl_loaded "key name loaded
  ${...}"` case from proposal 1) — unresolved for the same reason as
  proposal 1: JSON's `$ref` always replaces a whole node, never lives
  *inside* a string, so this proposal doesn't have an answer for
  interpolation either — whatever proposal 2 settles on for templates
  would still need its own way to embed a `$ref`-style pointer, if that
  combination is wanted at all.

## Open questions

Neither proposal is settled. Known problems with the design as sketched
above, to resolve before either is implemented:

- **Mixing sigils inside a template is confusing.**
  `"${&/ssl_key[1]}"` combines three things at once: the `${...}`
  interpolation syntax from proposal 2, the `&` reference sigil from
  proposal 1, and a path expression's own `[N]` argument selector. Using
  a template (`${...}`) to read the *value* of a `&` reference — instead
  of giving `&` its own value-reading form — is likely one sigil too
  many, and it's not yet decided whether `&...` should be legal at all
  inside a `${...}` template, or whether reading a single argument out of
  a `&` reference needs a form of its own that never has to nest inside
  `${...}`.
- **`#` collides with comments.** JSON-like formats often use `#` for a
  reference/pointer sigil, but DON already uses `#` for line comments
  (see the [spec](../specs/v1/spec.md#29-comments)), so it's not
  available here without a lexer-level disambiguation rule (e.g. by
  position) that doesn't currently exist.
- **`${...}` needs an escape sequence.** Once `${` is meaningful inside a
  string, a document that needs the literal two characters `${` — for
  example, a `header` value or `proxy_pass` target containing template
  syntax meant for the *upstream* system, not for DON — needs a way to
  write it without triggering interpolation. No escape form has been
  chosen yet (candidates include a backslash escape like `\${`, or a
  doubled sigil like `$${`).
- **How `set` variables and infrastructure-provided variables interact
  is undecided.** Some values Nginx-style variables would carry
  (`$host`, `$remote_addr`-equivalents) aren't declared by a `set` at
  all — they're supplied by the runtime the DON document is compiled
  against. It isn't decided whether `set` and runtime-supplied variables
  share one namespace (and if so, who wins when both define the same
  name), or whether `set` should instead work as a **default value** —
  used only when the runtime doesn't already provide that name — making
  the two complementary rather than competing.
- **Resolution order between the two proposals isn't defined.** The
  `route GET /api` example resolves a `&` reference *before* handing the
  result to a `${...}` template. If both features ship, the document
  needs a defined pass order (splice `&` references first, then
  interpolate `$`/`${...}`, or some other order) — otherwise a document
  mixing both, like the example above, is ambiguous about what runs
  first.
- **`$ref` and `&` overlapping is redundant, not complementary.**
  Proposal 3's subdirective form and proposal 1's `&` splice do the
  exact same thing (`$ref "/athorization"` vs. `&/athorization`) with
  no semantic difference — shipping both means picking one as the "real"
  syntax and the other as a deprecated alias, or dropping one before
  implementation. Nothing here decides which.
- **`$ref` reads as a value-position form, which invites nesting DON
  doesn't support.** Because `$ref` looks like every other directive
  call, it's tempting to write it wherever a value is expected (argument
  position, inside a template) the way JSON's `$ref` can appear as the
  value of any key — but DON arguments aren't nested calls, so `$ref`
  only cleanly reuses existing grammar in subdirective position. Whether
  it's worth having at all if it can't generalize past that one position
  is still open.
