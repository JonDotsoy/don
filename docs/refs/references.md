---
title: References Across Config Formats
description: What a "reference" is in a configuration format, and how JSON, YAML, Terraform (HCL), and Nginx config each resolve them.
lang: en
---

# References Across Config Formats

## What is a reference?

A **reference** is a way to point at a value defined elsewhere in a document (or in another document) instead of repeating that value inline. Instead of writing the same string, number, or block twice, a reference names the other location and lets some resolution step substitute the real value in its place.

Two things vary between formats:

- **Where resolution happens** — inside the format's own parser (so a generic parser already understands references), or in a separate step performed by the tool that consumes the parsed data (so the bare parser sees only plain values or strings, and "reference" is a convention layered on top).
- **What can be referenced** — a value already known at parse time (static, same-document data), or a value that only exists after some external step runs (e.g. a cloud resource ID assigned at apply time).

The rest of this document looks at four formats through that lens.

## JSON

JSON (RFC 8259) has no reference syntax at all. There are no anchors, aliases, or tags — a JSON parser only ever produces objects, arrays, strings, numbers, booleans, and null. Any notion of "reference" is a convention built on top, resolved by whichever tool reads the parsed result:

- **JSON Reference / JSON Schema `$ref`** — a plain string holding a [JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901), e.g. `{ "$ref": "#/definitions/defaults" }`. A bare JSON parser sees this as an ordinary object with a `$ref` key; a separate resolver library (e.g. `json-schema-ref-parser`) recognizes the convention and substitutes the pointed-to value. Unlike YAML anchors, a JSON Pointer can reach into a different file entirely, not just the current document.
- **Marker objects** (e.g. AWS CloudFormation in JSON mode) — `{ "Fn::GetAtt": ["MyBucket", "Arn"] }`. Since JSON has no tag syntax, the convention is a single-key object that the consuming engine (CloudFormation) recognizes and evaluates after parsing.
- **Interpolation inside a string** (e.g. Terraform's `.tf.json`) — `{ "image": "${docker_image.nginx.image_id}" }`. The JSON parser sees a plain string; the expression syntax inside it is reinterpreted by a second parser belonging to the consuming tool.

In every case, JSON's own grammar stays unaware of references — the format has no data type for them.

## YAML

YAML resolves references natively, inside its own parser, through **anchors** and **aliases**:

```yaml
defaults: &defaults
  timeout: 30
  retries: 3

service_a:
  <<: *defaults
  port: 8080
```

- `&defaults` marks ("anchors") a node.
- `*defaults` is an **alias** — a reference to that node, resolved by the YAML parser itself at parse time. The result is a literal copy of the anchored node's value.
- `<<:` is the "merge key" — a YAML 1.1 extension (not part of the 1.2 spec, but supported by most parsers) that merges the aliased mapping's keys into the current mapping, rather than nesting it under a single key.

This makes YAML's reference model **static and same-document**: aliases are substituted as the document is parsed, before any application logic runs, and they can only point within that same document — there's no dependency graph, no deferred evaluation, and no reaching into another file.

Tools built on top of YAML that need something more (cross-document references, or values unknown until later) don't extend the anchor/alias mechanism — they add their own layer instead: Helm resolves `{{ .Values.foo }}` as a Go template pass *before* the result is parsed as YAML; CloudFormation's YAML mode recognizes custom tags like `!Ref` and `!GetAtt`, resolving them in a step after the YAML parse.

## Terraform (HCL)

Terraform's configuration language, HCL, has references built into the language grammar as first-class expressions, not as a convention layered on top of a data format:

```hcl
resource "docker_image" "nginx" {
  name = "nginx:latest"
}

resource "docker_container" "app" {
  image = docker_image.nginx.image_id
}
```

`docker_image.nginx.image_id` is an **attribute reference**: `<resource_type>.<resource_name>.<attribute>`, parsed by HCL as an expression, not a string. Two properties distinguish this from YAML aliases:

- **Deferred, not copied.** Terraform builds a dependency graph from these references and resolves them at `apply` time, not at parse time. A reference can point at an attribute (like a cloud-assigned resource ID) that doesn't exist until the referenced resource is actually created — something a same-document, parse-time alias (YAML) or a static pointer (JSON `$ref`) can never express.
- **Typed as an expression, not a marker value.** Unlike CloudFormation's `!GetAtt` (a tag) or `Fn::GetAtt` (a marker object bolted onto JSON/YAML), HCL's grammar has real expression syntax — references can be combined with functions, string interpolation (`"${docker_image.nginx.image_id}"`), and conditionals, all resolved by the same evaluator that resolves the reference itself.

## Nginx config

Nginx's configuration format has no reference mechanism of its own — like JSON, its grammar (directives + nested blocks, no key-value pairs) has no syntax for pointing at another part of the file. What looks like reuse in Nginx config is achieved through other means, all resolved by Nginx itself at load/reload time rather than through a dedicated reference syntax:

- **Variables** (`$host`, `$remote_addr`, custom `set $foo bar;`) are runtime values substituted into directive arguments, not references to other configuration blocks:
  ```nginx
  set $backend "http://localhost:8080";
  location /api {
      proxy_pass $backend;
  }
  ```
  This looks like it "points at" a value defined elsewhere, but `$backend` is a variable binding evaluated per-request, not a link between two static blocks the way a YAML alias or an HCL attribute reference is.
- **`include`** pulls the contents of another file in verbatim at the point of the directive, textually, before Nginx parses the result — closer to a preprocessor's file inclusion than a reference to a specific value.

So Nginx has reuse (`include`) and indirection (variables), but neither is "reference resolution" in the sense JSON's `$ref`, YAML's aliases, or HCL's attribute references are: there's no syntax for "this value equals that other value," only textual inclusion and runtime variable substitution.

## Summary

| Format               | Reference resolved by            | When resolved              | Scope                          |
| -------------------- | --------------------------------- | --------------------------- | ------------------------------- |
| **JSON**             | Convention (consuming tool)       | After parsing               | Whatever the convention defines (same document or external) |
| **YAML**              | The YAML parser (anchors/aliases) | At parse time               | Same document only              |
| **Terraform (HCL)**   | HCL's own expression evaluator    | Deferred, at `apply` time   | Same configuration (module graph) |
| **Nginx config**      | Nginx (variables) / textual include | Request time (variables) / load time (`include`) | No true reference — variable substitution or file inclusion |
