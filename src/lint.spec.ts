import { describe, it, expect } from "bun:test";
import { DON, argLoc } from "./don";
import { lint, findByPath, LintIssue, type LintRule } from "./lint";

const expectLoc = (issue: LintIssue, text: string, expected: string) => {
  expect(issue.loc).toEqual(issue.directive.loc);
  expect(issue.loc).toBeDefined();
  expect(text.slice(issue.loc!.start.offset, issue.loc!.end.offset)).toBe(
    expected,
  );
};

describe("lint", () => {
  const argIsNumberRule: LintRule = {
    path: "/server/port",
    message: "The first argument of /server/port must be a number, not a string",
    validate: (directive) =>
      typeof directive.args[0] === "number"
        ? undefined
        : { loc: argLoc(directive, 0) },
  };

  it("reports no issues when the first argument is a number", () => {
    const root = DON.parse(""
      + "server {\n"
      + "  port 3000\n"
      + "}\n"
    );

    expect(lint(root, [argIsNumberRule])).toEqual([]);
  });

  it("reports an issue when the first argument is a string", () => {
    const text = ""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n";
    const root = DON.parse(text);

    const issues = lint(root, [argIsNumberRule]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toBeInstanceOf(LintIssue);
    expect(issues[0]).toMatchObject({
      path: "/server/port",
      message: "The first argument of /server/port must be a number, not a string",
      severity: "error",
    });
    expect(issues[0]!.directive.args).toEqual(["3000"]);
    // The reported span is just the offending arg's own token, not the
    // whole `port "3000"` directive.
    expect(issues[0]!.loc).not.toEqual(issues[0]!.directive.loc);
    expect(
      text.slice(issues[0]!.loc!.start.offset, issues[0]!.loc!.end.offset),
    ).toBe('"3000"');
  });

  it("supports a custom severity", () => {
    const root = DON.parse(""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n"
    );

    const warningRule: LintRule = { ...argIsNumberRule, severity: "warning" };

    expect(lint(root, [warningRule])[0]).toMatchObject({ severity: "warning" });
  });

  it("validates every directive matching the path, not just the first", () => {
    const text = ""
      + "server {\n"
      + "  port 3000\n"
      + '  port "8080"\n'
      + "}\n";
    const root = DON.parse(text);

    const issues = lint(root, [argIsNumberRule]);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.directive.args).toEqual(["8080"]);
    expect(
      text.slice(issues[0]!.loc!.start.offset, issues[0]!.loc!.end.offset),
    ).toBe('"8080"');
  });

  it("reports nothing when the path has no match", () => {
    const root = DON.parse("name \"my-app\"\n");

    expect(lint(root, [argIsNumberRule])).toEqual([]);
  });

  describe("validate/validateGroup return contract", () => {
    // Both callbacks return `void` for a valid directive, or a
    // `LintViolation` (`{ message?, severity? }`) to report one — each
    // field independently falls back to the rule's own `message` /
    // `severity`, then `"error"`.
    const root = DON.parse('port "3000"\n');

    it("void means valid: no issue is reported", () => {
      const rule: LintRule = { path: "/port", validate: () => undefined };

      expect(lint(root, [rule])).toEqual([]);
    });

    it("an empty violation object falls back to the rule's message and severity", () => {
      const rule: LintRule = {
        path: "/port",
        message: "rule-level message",
        severity: "warning",
        validate: () => ({}),
      };

      expect(lint(root, [rule])[0]).toMatchObject({
        message: "rule-level message",
        severity: "warning",
      });
    });

    it("a violation's own message overrides the rule's message", () => {
      const rule: LintRule = {
        path: "/port",
        message: "rule-level message",
        validate: () => ({ message: "port must be numeric" }),
      };

      expect(lint(root, [rule])[0]).toMatchObject({
        message: "port must be numeric",
        severity: "error",
      });
    });

    it("a violation's own severity overrides the rule's severity", () => {
      const rule: LintRule = {
        path: "/port",
        severity: "warning",
        validate: () => ({ severity: "error" }),
      };

      expect(lint(root, [rule])[0]).toMatchObject({ severity: "error" });
    });

    it("with neither a violation nor a rule message, a generic message names the path", () => {
      const rule: LintRule = { path: "/port", validate: () => ({}) };

      expect(lint(root, [rule])[0]!.message).toBe('Rule violated at "/port"');
    });
  });

  describe("single declaration rule", () => {
    const singleRespondRule: LintRule = {
      path: "/location/respond",
      message: "Only one respond declaration is allowed per location block",
      validateGroup: (directives) =>
        directives.length <= 1 ? undefined : {},
    };

    it("reports an issue when a location has more than one respond", () => {
      const text = ""
        + "location /home {\n"
        + "  respond 200\n"
        + "  respond 404\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [singleRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/location/respond",
        message: "Only one respond declaration is allowed per location block",
        severity: "error",
      });
      expectLoc(issues[0]!, text, "respond 200");
    });

    it("reports no issues when a location has a single respond", () => {
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
      );

      expect(lint(root, [singleRespondRule])).toEqual([]);
    });

    it("checks each location independently", () => {
      const text = ""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
        + "location /about {\n"
        + "  respond 200\n"
        + "  respond 404\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [singleRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual([200]);
      expectLoc(issues[0]!, text, "respond 200");
      expect(issues[0]!.loc!.start.offset).toBe(
        text.indexOf("respond 200", text.indexOf("/about")),
      );
    });
  });

  describe("required child rule", () => {
    const requireRespondRule: LintRule = {
      path: "/location",
      message: "A location block must have at least one respond declaration",
      validate: (directive) =>
        directive.children.some((child) => child.name === "respond")
          ? undefined
          : {},
    };

    it("reports an issue when a location has no respond", () => {
      const text = ""
        + "location /home {\n"
        + '  root "/var/www"\n'
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [requireRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/location",
        message: "A location block must have at least one respond declaration",
        severity: "error",
      });
      expectLoc(issues[0]!, text, "location /home");
    });

    it("reports no issues when a location has a respond", () => {
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
      );

      expect(lint(root, [requireRespondRule])).toEqual([]);
    });

    it("checks each location independently", () => {
      const text = ""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
        + "location /about {\n"
        + '  root "/var/www"\n'
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [requireRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual(["/about"]);
      expectLoc(issues[0]!, text, "location /about");
    });
  });

  describe("location path rule", () => {
    const locationPathRule: LintRule = {
      path: "/location",
      message: "The first argument of /location must be an absolute path starting with /",
      validate: (directive) =>
        typeof directive.args[0] === "string" &&
        directive.args[0].startsWith("/")
          ? undefined
          : {},
    };

    it("reports no issues when the location path is absolute", () => {
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
      );

      expect(lint(root, [locationPathRule])).toEqual([]);
    });

    it("reports an issue when the location path is not a string", () => {
      const text = ""
        + "location 404 {\n"
        + "  respond 200\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [locationPathRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/location",
        message: "The first argument of /location must be an absolute path starting with /",
        severity: "error",
      });
      expectLoc(issues[0]!, text, "location 404");
    });

    it("reports an issue when the location path doesn't start with /", () => {
      const text = ""
        + "location home {\n"
        + "  respond 200\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [locationPathRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual(["home"]);
      expectLoc(issues[0]!, text, "location home");
    });

    it("checks each location independently", () => {
      const text = ""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
        + "location about {\n"
        + "  respond 200\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [locationPathRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual(["about"]);
      expectLoc(issues[0]!, text, "location about");
    });
  });

  describe("findByPath", () => {
    it("resolves a nested path to the matching directives", () => {
      const text = ""
        + "server {\n"
        + "  port 3000\n"
        + "}\n";
      const root = DON.parse(text);

      const matches = findByPath(root, "/server/port");

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ name: "port", args: [3000] });
      expect(matches[0]!.loc).toBeDefined();
      expect(
        text.slice(matches[0]!.loc!.start.offset, matches[0]!.loc!.end.offset),
      ).toBe("port 3000");
    });

    it("resolves a single top-level directive with an empty child path", () => {
      const root = DON.parse("name \"my-app\"\n");

      expect(findByPath(root, "/name")).toHaveLength(1);
    });

    it("with no path, returns every directive in the document at every depth", () => {
      const root = DON.parse(""
        + "server {\n"
        + "  host \"localhost\"\n"
        + "  port 8080\n"
        + "}\n"
      );

      expect(findByPath(root).map((d) => d.name)).toEqual([
        "server",
        "host",
        "port",
      ]);
    });
  });

  describe("path-less rule (scans the whole document)", () => {
    // Omitting `path` runs the rule against every directive in the tree,
    // regardless of name or depth — useful for a check that isn't tied to
    // one shape, like flagging a leftover placeholder anywhere.
    const noTodoPlaceholderRule: LintRule = {
      message: "arguments must not contain a leftover TODO placeholder",
      validate: (directive) =>
        directive.args.some(
          (arg) => typeof arg === "string" && arg.includes("TODO"),
        )
          ? {}
          : undefined,
    };

    it("reports no issues when nothing contains a TODO", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Keyboard"\n'
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, [noTodoPlaceholderRule])).toEqual([]);
    });

    it("finds a TODO however deeply it's nested, without a path", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Keyboard"\n'
        + '    description "TODO: write a real description"\n'
        + "  }\n"
        + "}\n"
      );

      const issues = lint(root, [noTodoPlaceholderRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toBeUndefined();
      expect(issues[0]!.directive.name).toBe("description");
      expect(issues[0]!.message).toBe(
        "arguments must not contain a leftover TODO placeholder",
      );
    });

    it("reports one issue per offending directive, wherever they are", () => {
      const root = DON.parse(""
        + "name \"TODO: name this app\"\n"
        + "cart {\n"
        + "  product {\n"
        + '    name "TODO: name this product"\n'
        + "  }\n"
        + "}\n"
      );

      const issues = lint(root, [noTodoPlaceholderRule]);

      expect(issues.map((issue) => issue.directive.name)).toEqual([
        "name",
        "name",
      ]);
    });
  });

  describe("shopping cart example", () => {
    // A product is well-formed when it has a string `name`, a positive
    // numeric `price`, and a positive integer `quantity` — each field
    // checked independently, with its own message, showcasing that a
    // violation's message doesn't have to be the same for every failure.
    const productIsWellFormedRule: LintRule = {
      path: "/cart/product",
      validate: (directive) => {
        const fields = Object.fromEntries(
          directive.children.map((child) => [child.name, child.args[0]]),
        );

        if (typeof fields.name !== "string") {
          return { message: "a product must have a string name" };
        }
        if (typeof fields.price !== "number" || fields.price <= 0) {
          return { message: "a product's price must be a positive number" };
        }
        if (
          typeof fields.quantity !== "number" ||
          !Number.isInteger(fields.quantity) ||
          fields.quantity <= 0
        ) {
          return {
            message: "a product's quantity must be a positive integer",
          };
        }
      },
    };

    it("reports no issues when every product in the cart is well-formed", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Keyboard"\n'
        + "    price 49.99\n"
        + "    quantity 2\n"
        + "  }\n"
        + "  product {\n"
        + '    name "Mouse"\n'
        + "    price 19.99\n"
        + "    quantity 1\n"
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, [productIsWellFormedRule])).toEqual([]);
    });

    it("reports an issue for a product missing its name", () => {
      const text = ""
        + "cart {\n"
        + "  product {\n"
        + "    price 9.99\n"
        + "    quantity 5\n"
        + "  }\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [productIsWellFormedRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toBe("a product must have a string name");
      expect(issues[0]!.directive.children.map((c) => c.name)).toEqual([
        "price",
        "quantity",
      ]);
      expectLoc(issues[0]!, text, "product");
    });

    it("reports an issue when price is a string instead of a number", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Mouse"\n'
        + '    price "19.99"\n'
        + "    quantity 1\n"
        + "  }\n"
        + "}\n"
      );

      const issues = lint(root, [productIsWellFormedRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toBe(
        "a product's price must be a positive number",
      );
      expect(
        issues[0]!.directive.children.find((c) => c.name === "price")!.args,
      ).toEqual(["19.99"]);
    });

    it("reports an issue when quantity is zero or not an integer", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Monitor"\n'
        + "    price 199.99\n"
        + "    quantity 0\n"
        + "  }\n"
        + "}\n"
      );

      const issues = lint(root, [productIsWellFormedRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toBe(
        "a product's quantity must be a positive integer",
      );
      expect(
        issues[0]!.directive.children.find((c) => c.name === "quantity")!
          .args,
      ).toEqual([0]);
    });

    it("checks every product in the cart independently", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    name "Keyboard"\n'
        + "    price 49.99\n"
        + "    quantity 2\n"
        + "  }\n"
        + "  product {\n"
        + '    name "Mouse"\n'
        + '    price "19.99"\n'
        + "    quantity 1\n"
        + "  }\n"
        + "  product {\n"
        + "    price 9.99\n"
        + "    quantity 5\n"
        + "  }\n"
        + "  product {\n"
        + '    name "Monitor"\n'
        + "    price 199.99\n"
        + "    quantity 0\n"
        + "  }\n"
        + "}\n"
      );

      const issues = lint(root, [productIsWellFormedRule]);

      // The first product (Keyboard) is well-formed and contributes nothing.
      expect(issues).toHaveLength(3);
      expect(
        issues.map((issue) =>
          issue.directive.children.find((c) => c.name === "name")?.args[0],
        ),
      ).toEqual(["Mouse", undefined, "Monitor"]);
      expect(issues.map((issue) => issue.message)).toEqual([
        "a product's price must be a positive number",
        "a product must have a string name",
        "a product's quantity must be a positive integer",
      ]);
    });
  });

  describe("complex order example", () => {
    // A richer cart: products nest a `variant` block and can repeat
    // `discount`, and the cart itself requires a `shipping` block —
    // exercising all three path depths (/cart, /cart/product,
    // /cart/product/variant and /cart/product/discount) and both
    // `validate` and `validateGroup` together.
    const isPositiveNumber = (value: unknown): value is number =>
      typeof value === "number" && value > 0;
    const isPositiveInteger = (value: unknown): value is number =>
      isPositiveNumber(value) && Number.isInteger(value);

    const fieldsOf = (directive: {
      children: { name: string | symbol; args: unknown[] }[];
    }) =>
      Object.fromEntries(
        directive.children.map((child) => [child.name, child.args[0]]),
      ) as Record<string, unknown>;

    const cartRequiresShippingRule: LintRule = {
      path: "/cart",
      message: "a cart must declare a shipping method",
      validate: (directive) =>
        directive.children.some((child) => child.name === "shipping")
          ? undefined
          : {},
    };

    const productRequiresSkuRule: LintRule = {
      path: "/cart/product",
      message: "a product must have a sku",
      validate: (directive) =>
        directive.children.some((child) => child.name === "sku")
          ? undefined
          : {},
    };

    const productIsWellFormedRule: LintRule = {
      path: "/cart/product",
      message:
        "a product must have a string name, a positive numeric price, and a positive integer quantity",
      validate: (directive) => {
        const fields = fieldsOf(directive);
        const isValid =
          typeof fields.name === "string" &&
          isPositiveNumber(fields.price) &&
          isPositiveInteger(fields.quantity);

        return isValid ? undefined : {};
      },
    };

    const oneDiscountPerProductRule: LintRule = {
      path: "/cart/product/discount",
      message: "only one discount is allowed per product",
      validateGroup: (directives) =>
        directives.length <= 1 ? undefined : {},
    };

    const variantIsWellFormedRule: LintRule = {
      path: "/cart/product/variant",
      message: "a variant must have a string color and a string size",
      validate: (directive) => {
        const fields = fieldsOf(directive);
        const isValid =
          typeof fields.color === "string" && typeof fields.size === "string";

        return isValid ? undefined : {};
      },
    };

    const rules: LintRule[] = [
      cartRequiresShippingRule,
      productRequiresSkuRule,
      productIsWellFormedRule,
      oneDiscountPerProductRule,
      variantIsWellFormedRule,
    ];

    it("reports no issues for a fully valid order", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  customer {\n"
        + '    email "alice@example.com"\n'
        + "    vip true\n"
        + "  }\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Mechanical Keyboard"\n'
        + "    price 49.99\n"
        + "    quantity 2\n"
        + "    variant {\n"
        + '      color "black"\n'
        + '      size "full"\n'
        + "    }\n"
        + "    discount 10\n"
        + "  }\n"
        + "  shipping {\n"
        + '    method "express"\n'
        + "    cost 12.5\n"
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, rules)).toEqual([]);
    });

    it("captures every violation in a mixed order, one issue per rule", () => {
      const text = ""
        + "cart {\n"
        + "  customer {\n"
        + '    email "alice@example.com"\n'
        + "    vip true\n"
        + "  }\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Mechanical Keyboard"\n'
        + "    price 49.99\n"
        + "    quantity 2\n"
        + "    variant {\n"
        + '      color "black"\n'
        + '      size "full"\n'
        + "    }\n"
        + "    discount 10\n"
        + "  }\n"
        + "  product {\n"
        + '    sku "MS-200"\n'
        + '    name "Wireless Mouse"\n'
        + '    price "19.99"\n'
        + "    quantity 0\n"
        + "    discount 5\n"
        + "    discount 15\n"
        + "  }\n"
        + "  product {\n"
        + '    name "Monitor"\n'
        + "    price 199.99\n"
        + "    quantity 1\n"
        + "    variant {\n"
        + "      color 42\n"
        + "    }\n"
        + "  }\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, rules);

      // The Keyboard product (first) is fully valid, including its
      // variant and single discount, and contributes nothing.
      const report = issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        source: text.slice(issue.loc!.start.offset, issue.loc!.end.offset),
      }));

      expect(report).toMatchSnapshot();
    });
  });

  describe("declaration order rule", () => {
    // `order` references products by sku, so every `product` must be
    // declared before the first `order` that could depend on it. This
    // reads sibling *position* within /cart's children directly — a
    // shape `validate`/`validateGroup` (which only ever see directives
    // sharing one name) can't express, since the check spans two
    // different directive names.
    const productsBeforeOrdersRule: LintRule = {
      path: "/cart",
      message: "every product must be declared before any order that references it",
      validate: (directive) => {
        const firstOrderIndex = directive.children.findIndex(
          (child) => child.name === "order",
        );

        if (firstOrderIndex === -1) return undefined;

        const hasProductAfterOrder = directive.children
          .slice(firstOrderIndex + 1)
          .some((child) => child.name === "product");

        return hasProductAfterOrder ? {} : undefined;
      },
    };

    it("reports no issues when every product comes before the order", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Keyboard"\n'
        + "  }\n"
        + "  product {\n"
        + '    sku "MS-200"\n'
        + '    name "Mouse"\n'
        + "  }\n"
        + "  order {\n"
        + '    item "KB-100"\n'
        + '    item "MS-200"\n'
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, [productsBeforeOrdersRule])).toEqual([]);
    });

    it("reports no issues when there is no order at all", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Keyboard"\n'
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, [productsBeforeOrdersRule])).toEqual([]);
    });

    it("reports an issue when a product is declared after the order", () => {
      const text = ""
        + "cart {\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Keyboard"\n'
        + "  }\n"
        + "  order {\n"
        + '    item "KB-100"\n'
        + "  }\n"
        + "  product {\n"
        + '    sku "MS-200"\n'
        + '    name "Mouse"\n'
        + "  }\n"
        + "}\n";
      const root = DON.parse(text);

      const issues = lint(root, [productsBeforeOrdersRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/cart",
        message: "every product must be declared before any order that references it",
        severity: "error",
      });
      // The reported span is the whole cart block: the violation isn't
      // any single directive but their relative position.
      expect(issues[0]!.directive.name).toBe("cart");
    });

    it("reports an issue when the order comes first with no products before it", () => {
      const root = DON.parse(""
        + "cart {\n"
        + "  order {\n"
        + '    item "KB-100"\n'
        + "  }\n"
        + "  product {\n"
        + '    sku "KB-100"\n'
        + '    name "Keyboard"\n'
        + "  }\n"
        + "}\n"
      );

      expect(lint(root, [productsBeforeOrdersRule])).toHaveLength(1);
    });
  });

  describe("full lint report", () => {
    it("captures every rule kind against a realistic multi-block config", () => {
      const text = ""
        + "server {\n"
        + '  port "3000"\n'
        + "}\n"
        + "location /home {\n"
        + "  respond 200\n"
        + "  respond 404\n"
        + "}\n"
        + "location 404 {\n"
        + '  root "/var/www"\n'
        + "}\n"
        + "location /about {\n"
        + "  respond 200\n"
        + "}\n";
      const root = DON.parse(text);

      const rules: LintRule[] = [
        {
          path: "/server/port",
          message: "The first argument of /server/port must be a number, not a string",
          validate: (directive) =>
            typeof directive.args[0] === "number"
              ? undefined
              : { loc: argLoc(directive, 0) },
        },
        {
          path: "/location",
          message: "The first argument of /location must be an absolute path starting with /",
          validate: (directive) =>
            typeof directive.args[0] === "string" &&
            directive.args[0].startsWith("/")
              ? undefined
              : {},
        },
        {
          path: "/location",
          message: "A location block must have at least one respond declaration",
          validate: (directive) =>
            directive.children.some((child) => child.name === "respond")
              ? undefined
              : {},
        },
        {
          path: "/location/respond",
          message: "Only one respond declaration is allowed per location block",
          validateGroup: (directives) =>
            directives.length <= 1 ? undefined : {},
        },
      ];

      const issues = lint(root, rules);

      // /about is fully valid and contributes nothing, proving the report
      // only surfaces genuine violations rather than one entry per match.
      const report = issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        severity: issue.severity,
        loc: issue.loc,
        source: text.slice(issue.loc!.start.offset, issue.loc!.end.offset),
        directive: { name: issue.directive.name, args: issue.directive.args },
      }));

      expect(report).toMatchSnapshot();
    });
  });
});
