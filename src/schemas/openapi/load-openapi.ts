import { readFile } from "node:fs/promises";
import { DON, type Directive } from "../../don.js";
import { ROOT_DIRECTIVE_NAME } from "../../root-directive-name.js";

/**
 * A subset of the OpenAPI 3.0 Schema Object — just what
 * {@link openapiFromDirective} produces from a DON `schema`/`property`
 * block. `$ref` and every other JSON Schema keyword are also allowed
 * through, since `parseSchemaLike` copies unrecognized child directives
 * straight into the object.
 */
export interface OpenAPISchema {
  $ref?: string;
  type?: string;
  format?: string;
  items?: OpenAPISchema;
  required?: string[];
  properties?: Record<string, OpenAPISchema>;
  allOf?: OpenAPISchema[];
  [key: string]: unknown;
}

export interface OpenAPIInfo {
  title: string;
  description?: string;
  version: string;
}

export interface OpenAPIServer {
  url: string;
}

export interface OpenAPIParameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: OpenAPISchema;
}

export interface OpenAPIMediaType {
  schema: OpenAPISchema;
}

export interface OpenAPIRequestBody {
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  description?: string;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIOperation {
  summary?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
}

export interface OpenAPIComponents {
  schemas: Record<string, OpenAPISchema>;
}

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: OpenAPIComponents;
}

const topLevelChildren = (root: Directive): Directive[] =>
  root.name === ROOT_DIRECTIVE_NAME ? root.children : [root];

const findChild = (directive: Directive, name: string): Directive | undefined =>
  directive.children.find((child) => child.name === name);

const findChildren = (directive: Directive, name: string): Directive[] =>
  directive.children.filter((child) => child.name === name);

const stringArg = (directive: Directive | undefined): string | undefined =>
  directive?.args[0] === undefined ? undefined : String(directive.args[0]);

const schemaRefPath = (name: string): string => `#/components/schemas/${name}`;

const isRefDirective = (directive: Directive): boolean =>
  directive.args.length === 2 && directive.args[0] === "ref";

/**
 * Reads a `schema`/`property`/`allOf`/`items` directive into a Schema
 * Object. A directive shaped `<name> ref <Target>` (`schema ref Pet`,
 * `allOf ref NewPet`, `items ref Pet`) becomes a `$ref`; otherwise its
 * children are folded in: `type`/`format` set the matching key, `items`
 * and `allOf` recurse, `required`/`property` accumulate into
 * `required`/`properties`, and any other child copies through as
 * `{ [child.name]: child.args }` (or the single arg itself, unwrapped).
 */
const parseSchemaLike = (directive: Directive): OpenAPISchema => {
  if (isRefDirective(directive)) {
    return { $ref: schemaRefPath(String(directive.args[1])) };
  }

  const schema: OpenAPISchema = {};

  for (const child of directive.children) {
    switch (child.name) {
      case "type":
        schema.type = stringArg(child);
        break;
      case "format":
        schema.format = stringArg(child);
        break;
      case "items":
        schema.items = parseSchemaLike(child);
        break;
      case "required":
        schema.required = [
          ...(schema.required ?? []),
          ...child.args.map((arg) => String(arg)),
        ];
        break;
      case "property": {
        const properties = schema.properties ?? {};
        properties[String(child.args[0])] = parseProperty(child);
        schema.properties = properties;
        break;
      }
      case "allOf":
        schema.allOf = [...(schema.allOf ?? []), parseSchemaLike(child)];
        break;
      default:
        schema[String(child.name)] =
          child.args.length <= 1 ? child.args[0] : child.args;
        break;
    }
  }

  return schema;
};

/** `property <name> <type> { ... }` — like {@link parseSchemaLike}, plus its own `<type>` argument. */
const parseProperty = (directive: Directive): OpenAPISchema => {
  const schema = parseSchemaLike(directive);
  const typeArg = directive.args[1];
  if (schema.type === undefined && typeof typeArg === "string") {
    schema.type = typeArg;
  }
  return schema;
};

const parseInfo = (directive: Directive): OpenAPIInfo => {
  const info: OpenAPIInfo = {
    title: stringArg(findChild(directive, "title")) ?? "",
    version: stringArg(findChild(directive, "version")) ?? "",
  };
  const description = stringArg(findChild(directive, "description"));
  if (description !== undefined) info.description = description;
  return info;
};

const parseServer = (directive: Directive): OpenAPIServer => ({
  url: stringArg(findChild(directive, "url")) ?? "",
});

const parseParameter = (directive: Directive): OpenAPIParameter => {
  const parameter: OpenAPIParameter = {
    name: String(directive.args[0]),
    in: stringArg(findChild(directive, "in")) ?? "query",
  };

  const description = stringArg(findChild(directive, "description"));
  if (description !== undefined) parameter.description = description;

  const requiredChild = findChild(directive, "required");
  if (requiredChild) parameter.required = Boolean(requiredChild.args[0]);

  const schemaChild = findChild(directive, "schema");
  if (schemaChild) parameter.schema = parseSchemaLike(schemaChild);

  return parameter;
};

const parseContent = (
  directive: Directive,
): Record<string, OpenAPIMediaType> => {
  const content: Record<string, OpenAPIMediaType> = {};
  for (const contentDirective of findChildren(directive, "content")) {
    const schemaChild = findChild(contentDirective, "schema");
    if (!schemaChild) continue;
    content[String(contentDirective.args[0])] = {
      schema: parseSchemaLike(schemaChild),
    };
  }
  return content;
};

const parseRequestBody = (directive: Directive): OpenAPIRequestBody => {
  const requestBody: OpenAPIRequestBody = { content: parseContent(directive) };
  const requiredChild = findChild(directive, "required");
  if (requiredChild) requestBody.required = Boolean(requiredChild.args[0]);
  return requestBody;
};

const parseResponse = (directive: Directive): OpenAPIResponse => {
  const response: OpenAPIResponse = {};

  const description = stringArg(findChild(directive, "description"));
  if (description !== undefined) response.description = description;

  const content = parseContent(directive);
  if (Object.keys(content).length > 0) response.content = content;

  return response;
};

const parseOperation = (directive: Directive): OpenAPIOperation => {
  const responses: Record<string, OpenAPIResponse> = {};
  for (const responseDirective of findChildren(directive, "response")) {
    responses[String(responseDirective.args[0])] =
      parseResponse(responseDirective);
  }

  const operation: OpenAPIOperation = { responses };

  const summary = stringArg(findChild(directive, "summary"));
  if (summary !== undefined) operation.summary = summary;

  const operationIdChild = findChild(directive, "operationId");
  if (operationIdChild)
    operation.operationId = String(operationIdChild.args[0]);

  const parameters = findChildren(directive, "param").map(parseParameter);
  if (parameters.length > 0) operation.parameters = parameters;

  const requestBodyChild = findChild(directive, "requestBody");
  if (requestBodyChild)
    operation.requestBody = parseRequestBody(requestBodyChild);

  return operation;
};

/** A top-level `schema <Name> { ... }` component definition, vs. an inline `schema ref X` / `schema { ... }` usage. */
const isComponentSchemaDirective = (directive: Directive): boolean =>
  directive.name === "schema" && directive.args.length === 1;

/**
 * Translates a parsed DON `Directive` tree — following the `openapi`/
 * `info`/`server`/`route`/`schema` grammar documented in
 * `src/schemas/openapi/README.md` — into a plain OpenAPI 3.0 document
 * object. Used internally by {@link loadOpenapi}; exported separately so
 * an already-parsed `Directive` (e.g. from `DON.parse`) can be converted
 * without re-reading a file.
 */
export const openapiFromDirective = (root: Directive): OpenAPIDocument => {
  const children = topLevelChildren(root);

  const openapiDirective = children.find((child) => child.name === "openapi");
  const infoDirective = children.find((child) => child.name === "info");
  const serverDirectives = children.filter((child) => child.name === "server");
  const routeDirectives = children.filter((child) => child.name === "route");
  const schemaDirectives = children.filter(isComponentSchemaDirective);

  const document: OpenAPIDocument = {
    openapi: stringArg(openapiDirective) ?? "3.0.3",
    info: infoDirective ? parseInfo(infoDirective) : { title: "", version: "" },
    paths: {},
  };

  if (serverDirectives.length > 0) {
    document.servers = serverDirectives.map(parseServer);
  }

  for (const routeDirective of routeDirectives) {
    const method = String(routeDirective.args[0]).toLowerCase();
    const path = String(routeDirective.args[1]);
    document.paths[path] ??= {};
    document.paths[path]![method] = parseOperation(routeDirective);
  }

  if (schemaDirectives.length > 0) {
    const schemas: Record<string, OpenAPISchema> = {};
    for (const schemaDirective of schemaDirectives) {
      schemas[String(schemaDirective.args[0])] =
        parseSchemaLike(schemaDirective);
    }
    document.components = { schemas };
  }

  return document;
};

/**
 * Reads a `.donly`/`.don` file describing an API (see
 * `src/schemas/openapi/README.md` for the grammar) and translates it
 * into an OpenAPI 3.0 document — the JSON-serializable object form, not
 * a JSON string.
 */
export const loadOpenapi = async (
  filePath: string | URL,
): Promise<OpenAPIDocument> => {
  const text = await readFile(filePath, "utf8");
  const root = DON.parse(text);
  return openapiFromDirective(root);
};
