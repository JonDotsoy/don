import { resolve as resolvePath } from "node:path";
import type { DonPlugin, PluginDirectiveNode } from "../../plugin.js";

interface FakeColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
}

interface FakeTable {
  rows: number;
  columns: FakeColumn[];
}

interface FakeSqliteSchema {
  sizeMegabytes: number;
  tables: Record<string, FakeTable>;
}

/**
 * Stands in for actually opening a `.sqlite` file and inspecting its
 * schema (page count for size, `sqlite_master`/`PRAGMA table_info` for
 * tables and columns) — a real implementation would read `path` here.
 * This demo only simulates that read, always "discovering" the same
 * fixed schema, so the plugin's shape (resolve a resource reference,
 * expand it into data) stays the whole point.
 */
const inspectSqliteFile = (_path: string): FakeSqliteSchema => ({
  sizeMegabytes: 34,
  tables: {
    user: {
      rows: 350,
      columns: [
        { name: "user_id", type: "TEXT", primaryKey: true },
        { name: "name", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
    },
    product: {
      rows: 7000,
      columns: [
        { name: "product_id", type: "TEXT", primaryKey: true },
        { name: "name", type: "TEXT" },
        { name: "price", type: "INTEGER" },
      ],
    },
  },
});

const FILE_URL_PATTERN = /^file:\/\/(.+)$/;

const columnToNode = (column: FakeColumn): PluginDirectiveNode => ({
  name: column.name,
  args: column.primaryKey ? [column.type, "primarykey"] : [column.type],
});

const tableToNode = (name: string, table: FakeTable): PluginDirectiveNode => ({
  name: "table",
  args: [name],
  children: [
    { name: "rows", args: [table.rows] },
    { name: "columns", args: [], children: table.columns.map(columnToNode) },
  ],
});

export interface ResourcesPluginOptions {
  /**
   * Directory a `file://` resource URL's relative path resolves against.
   * Defaults to `process.cwd()`.
   */
  cwd?: string;
}

/**
 * A second demo `DonPlugin`: expands a `resource <type> <url>` reference
 * into the data it points at, simulating a read of the actual resource.
 * For a `resource sqlite <file-url>` directive, that means resolving the
 * `file://` URL's path to an absolute one and "inspecting" the database
 * (`inspectSqliteFile` above — a real plugin would open the file for
 * real) to expand it with `size`, `table`, and `columns` children:
 *
 * ```don
 * resource sqlite file://./db.sqlite
 * ```
 *
 * parses (with `DON.parse(text, { plugins: [createResourcesPlugin()] })`,
 * from a document whose only directive is the one above) to a `resource`
 * `Directive` whose first argument is now the resolved absolute path and
 * whose children describe the (simulated) schema — see
 * `docs/concepts/plugins.md` for the full expected shape. A `resource`
 * directive naming any other type, or one without a string URL argument,
 * is returned untouched.
 *
 * A factory rather than a static plugin object (unlike `variablesPlugin`)
 * because resolving a relative `file://` path needs a base directory —
 * `createResourcesPlugin({ cwd })` fixes one instead of always resolving
 * against `process.cwd()`, which matters for reproducible output (e.g. in
 * tests).
 */
export const createResourcesPlugin = (
  options: ResourcesPluginOptions = {},
): DonPlugin => {
  const cwd = options.cwd ?? process.cwd();

  return {
    name: "resources",

    onDirective(node) {
      if (node.name !== "resource") return;

      const [type, url] = node.args;
      if (typeof type !== "string" || typeof url !== "string") return;

      const match = FILE_URL_PATTERN.exec(url);
      if (!match) return;

      const absolutePath = resolvePath(cwd, match[1]!);

      if (type !== "sqlite") return;

      const schema = inspectSqliteFile(absolutePath);

      return {
        name: node.name,
        args: [type, `file://${absolutePath}`],
        children: [
          { name: "size", args: [schema.sizeMegabytes, "megabites"] },
          ...Object.entries(schema.tables).map(([name, table]) =>
            tableToNode(name, table),
          ),
        ],
      };
    },
  };
};
