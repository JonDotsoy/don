---
title: References (design draft)
description: Three experimental, not-yet-implemented proposals for referencing values across a DON document — a "&" splice/join operator, "$"/"${}" block-scoped variables inherited from Nginx, and a "$ref" directive inherited from JSON Schema.
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
directive binds a name, and `${name}` interpolates that binding's value
into a string.

```don
set backend "http://10.0.0.1:3000"

route GET /home {
  proxy_pass "${backend}"
}

route GET /settings {
  proxy_pass "${backend}/settings"
}

route GET /api {
  proxy_pass "${backend}/api"
}
```

- `set <name> <value>` defines a variable, the same way Nginx's `set
  $foo bar;` does, minus the leading `$` on the declaration itself.
- **Decided:** interpolation only triggers inside a **double-quoted**
  string (`"${backend}"`). A **single-quoted** string (`'${backend}'`)
  never interpolates — `${backend}` there is four literal characters,
  the same way it would be in a bare keyword argument. This gives every
  document an escape-free way to write a literal `${...}` sequence: use
  `'...'` instead of `"..."` whenever the content must not be
  interpolated.
- **Decided:** the escape character inside a double-quoted string is
  `\` — `\$` escapes to a literal `$`, so `"\${backend}"` reads as the
  literal text `${backend}`, not an interpolation. This is the same
  role `\` already plays for quote escaping in DON's existing string
  literals (see the [spec](../specs/v1/spec.md#25-strings)) — no new
  escape convention, just extending what `\` already escapes.
- There is no bare (unquoted keyword) form of interpolation — `$name`/
  `${name}` only has meaning inside a double-quoted string. A bare
  argument like `proxy_pass ${backend}` (no quotes) is just the literal
  keyword token `${backend}`, exactly as it is today.

Unlike proposal 1's `&` splice (resolved once against the static
document tree), this is closer to the string-substitution model — the
value is dropped into a larger string, not spliced as a directive's
children.

### Decided: `set` is block-scoped

`set` follows lexical scoping over the document's block nesting, the
same way a `let`/`var` declaration is scoped to its enclosing block in
most programming languages: a `set` inside a block is only visible
within that block (and its nested blocks), and it **shadows** — without
overwriting — a `set` of the same name from an enclosing block for the
rest of that inner block. Once the inner block ends, the outer `set`'s
value applies again, unchanged.

```don
set tar "biz"

Foo "${tar}" {
  set tar "boo"

  Lol "${tar}"
}
```

`Foo`'s own argument resolves against the outer `tar` (`"biz"`, not yet
shadowed at that point), while `Lol`'s argument resolves against the
inner `set`, which shadows the outer one for the rest of `Foo`'s block:

```don
Foo "biz" {
  Lol "boo"
}
```

If a directive after the inner `set tar "boo"` but still inside `Foo`'s
block referenced `${tar}` again, it would also see `"boo"` — the shadow
holds for the rest of the enclosing block, not just for the one
directive right after it. A sibling block that never nests inside `Foo`
(e.g. a `route` written after `Foo` closes) would see the outer `tar`
("biz") again, since `Foo`'s inner `set` never escapes `Foo`'s block.

### Extending `set`/`$name` beyond string interpolation

A further sketch keeps `set`'s grammar exactly as above (directive
name is always `set`; first argument is the bound name; everything
after that — zero or more arguments, and optionally a block — is the
value), but lets `$name` appear in four different grammatical
positions, not just inside a `"${...}"` template:

**(a) As a directive name.** `set` binds a name to what becomes the
*effective directive name* at the call site:

```don
set varname "proxy_pass"

$varname http://10.0.0.1:3000
```

reads as if it were written:

```don
proxy_pass http://10.0.0.1:3000
```

**(b) As a bare argument value** — no quotes, no `${...}`:

```don
set backend "http://10.0.0.1:3000"

proxy_pass $backend
```

**(c) As a reference to a whole directive.** `set` binds a name not to
a scalar but to an entire directive shape (name, args, and block); a
bare `$name` (in subdirective/statement position) expands back to that
whole directive:

```don
set cached_api proxy_pass "http://10.0.0.1:3000/api" {
  header X-From "cache"
}

route GET /api {
  $cached_api
}
```

**(d) As an explicit union/splice**, via a `directiveunion` directive
that merges a `set`-bound directive's children into the current block
alongside directives already written there:

```don
set common_auth {
  bearer
  basic
}

route GET /api {
  athorization {
    directiveunion $common_auth
    apikey
  }
}
```

This is the same splice/merge outcome as proposal 1's bare
`&/athorization` and proposal 3's bare `$ref "/athorization"` — here
sourced from a `set`-bound name instead of a path expression.

**Open questions this raises**, beyond the two already tracked below:

- **(b) directly contradicts the "no bare form" decision above.** This
  section's own worked example (`proxy_pass "${backend}"`) explicitly
  decided that `$name` only has meaning inside a double-quoted
  `${...}` template, and that a bare `$backend` is just the literal
  keyword token `$backend`. Form (b) here (`proxy_pass $backend`) is
  exactly that disallowed bare form. Either the earlier decision needs
  to be narrowed to "no bare form *inside running text*, but a bare
  `$name` as an entire, standalone argument is fine," or form (b) needs
  to be dropped in favor of always writing `"${backend}"`.
- **`set`'s value shape is now overloaded.** The original proposal
  only ever bound a scalar (`set backend "http://..."`). Form (c) needs
  `set` to also bind a full directive (name + args + block) as the
  value, which is a different shape of thing to store under the same
  name — nothing here says how a reader of `set varname ...` tells
  which shape it's looking at before reaching the end of the line (or
  the block).
- **Form (a)'s mapping from stored value to call site isn't defined.**
  If the bound value has more than one argument (`set varname "bearer"
  "basic"`), it's unclear whether `$varname arg` uses only the first
  stored argument as the directive name and drops the rest, uses all of
  them as leading arguments before `arg`, or is simply invalid unless
  the stored value is exactly one argument.
- **(a), (c), and (d) overlap with proposals 1 and 3.** Splicing a
  whole directive's children (c, d) restates proposal 1's `&` and
  proposal 3's `$ref` a third time, now sourced from `set` instead of a
  path expression — three different-looking spellings for the same
  operation is a sign one of them should probably not ship, not that
  all three should.

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
    load_key $ref(/ssl_key[1])
  }
  proxy_pass http://10.0.0.1:3000/api
}
```

- **As a subdirective** (`$ref "/athorization"` inside `athorization {
  }`) — splices the referenced directive's children into the current
  block, alongside `apikey`. Identical outcome to proposal 1's
  `&/athorization`, but as a plain directive call instead of a sigil
  glued onto the path.
- **As an argument value** (`load_key $ref(/ssl_key[1])`) — a *call
  form*: `$ref(...)` written as a single argument token, the path
  expression sitting inside the parentheses rather than as a second,
  separate argument. This is new grammar either way — DON arguments
  today are atoms (string/number/boolean/null/heredoc), so a call-shaped
  token is a new argument kind alongside those (parallel to how
  `heredoc` already gets its own `SyntaxKind`), not a reuse of an
  existing rule the way the subdirective form is. It does read closer
  to JSON's `$ref` than the two-atom form (`$ref "/ssl_key[1]"`) would,
  since the reference stays visually inside one token instead of
  looking like `load_key` took two unrelated arguments.
- **Inside a string template** (the `header ssl_loaded "key name loaded
  ${...}"` case from proposal 1) — the call form gives this a plausible
  answer proposal 1 didn't have: `"key name loaded ${$ref(/ssl_key[1])}"`
  nests a `$ref(...)` call inside proposal 2's `${...}` interpolation
  the same way any other value would go there. It's still an open
  question whether that's the right way to spell it (it stacks *two*
  sets of parens/braces for one lookup: `${` `$ref(` `)` `}`), but at
  least the call form means there's something to nest, unlike the bare
  `$ref "/path"` statement form.

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
- ~~**`${...}` needs an escape sequence.**~~ **Resolved.** Interpolation
  only triggers inside a double-quoted string; a single-quoted string
  never interpolates, and `\${` inside a double-quoted string escapes
  to the literal text `${` (reusing the `\` DON's string literals
  already use for quote escaping — see the
  [spec](../specs/v1/spec.md#25-strings)). A document needing literal
  `${...}` — e.g. a `header` value or `proxy_pass` target containing
  template syntax meant for the *upstream* system, not for DON — can
  either switch that one value to single quotes or backslash-escape the
  `$`.
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
- **`$ref` needs two different grammars for its two positions.** The
  subdirective form (`$ref "/path"`) is a plain directive call — zero
  new grammar. The argument form (`$ref(/path)`) is a call-shaped
  argument token — a new argument kind, distinct from the existing
  atoms. Both spell the same idea, but a parser has to recognize `$ref`
  two different ways depending on where it appears, which is a real
  cost `&` doesn't pay (it's one splice form, reused in both
  positions). Whether that inconsistency is worth `$ref`'s closer
  resemblance to the JSON convention is still open.
- **Block scoping's interaction with the whole-directive `set` forms
  (c)/(d) isn't worked out.** The scoping example above only shadows a
  scalar. It isn't decided whether shadowing a `set`-bound whole
  directive works the same way — e.g. a nested `set cached_api ...`
  overriding an outer one for the rest of the inner block — or whether
  splicing a shadowed directive's *children* (form d,
  `directiveunion $name`) resolves against the shadow in effect at the
  `directiveunion` call site or at some other point.
