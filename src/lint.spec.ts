import { describe, it, expect } from "bun:test";
import { DON } from "./don";
import { lint, findByPath, LintIssue, type LintRule } from "./lint";

const expectLoc = (issue: LintIssue, text: string, expected: string) => {
  expect(issue.loc).toEqual(issue.directive.loc);
  expect(issue.loc).toBeDefined();
  expect(
    text.slice(issue.loc!.start.offset, issue.loc!.end.offset),
  ).toBe(expected);
};

describe("lint", () => {
  const argIsNumberRule: LintRule = {
    path: "/server/port",
    message: "The first argument of /server/port must be a number, not a string",
    validate: (directive) => typeof directive.args[0] === "number",
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
    expectLoc(issues[0]!, text, 'port "3000"');
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
    expectLoc(issues[0]!, text, 'port "8080"');
  });

  it("reports nothing when the path has no match", () => {
    const root = DON.parse("name \"my-app\"\n");

    expect(lint(root, [argIsNumberRule])).toEqual([]);
  });

  describe("single declaration rule", () => {
    const singleRespondRule: LintRule = {
      path: "/location/respond",
      message: "Only one respond declaration is allowed per location block",
      validateGroup: (directives) => directives.length <= 1,
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
        directive.children.some((child) => child.name === "respond"),
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
      expectLoc(issues[0]!, text, ""
        + "location /home {\n"
        + '  root "/var/www"'
      );
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
      expectLoc(issues[0]!, text, ""
        + "location /about {\n"
        + '  root "/var/www"'
      );
    });
  });

  describe("location path rule", () => {
    const locationPathRule: LintRule = {
      path: "/location",
      message: "The first argument of /location must be an absolute path starting with /",
      validate: (directive) =>
        typeof directive.args[0] === "string" &&
        directive.args[0].startsWith("/"),
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
      expectLoc(issues[0]!, text, ""
        + "location 404 {\n"
        + "  respond 200"
      );
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
      expectLoc(issues[0]!, text, ""
        + "location home {\n"
        + "  respond 200"
      );
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
      expectLoc(issues[0]!, text, ""
        + "location about {\n"
        + "  respond 200"
      );
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
  });

  describe("shopping cart example", () => {
    // A product is well-formed when it has a string `name`, a positive
    // numeric `price`, and a positive integer `quantity`.
    const productIsWellFormedRule: LintRule = {
      path: "/cart/product",
      message:
        "a product must have a string name, a positive numeric price, and a positive integer quantity",
      validate: (directive) => {
        const fields = Object.fromEntries(
          directive.children.map((child) => [child.name, child.args[0]]),
        );

        return (
          typeof fields.name === "string" &&
          typeof fields.price === "number" &&
          fields.price > 0 &&
          typeof fields.quantity === "number" &&
          Number.isInteger(fields.quantity) &&
          fields.quantity > 0
        );
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
      expect(issues[0]!.directive.children.map((c) => c.name)).toEqual([
        "price",
        "quantity",
      ]);
      expectLoc(issues[0]!, text, ""
        + "product {\n"
        + "    price 9.99\n"
        + "    quantity 5"
      );
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
        directive.children.some((child) => child.name === "shipping"),
    };

    const productRequiresSkuRule: LintRule = {
      path: "/cart/product",
      message: "a product must have a sku",
      validate: (directive) =>
        directive.children.some((child) => child.name === "sku"),
    };

    const productIsWellFormedRule: LintRule = {
      path: "/cart/product",
      message:
        "a product must have a string name, a positive numeric price, and a positive integer quantity",
      validate: (directive) => {
        const fields = fieldsOf(directive);
        return (
          typeof fields.name === "string" &&
          isPositiveNumber(fields.price) &&
          isPositiveInteger(fields.quantity)
        );
      },
    };

    const oneDiscountPerProductRule: LintRule = {
      path: "/cart/product/discount",
      message: "only one discount is allowed per product",
      validateGroup: (directives) => directives.length <= 1,
    };

    const variantIsWellFormedRule: LintRule = {
      path: "/cart/product/variant",
      message: "a variant must have a string color and a string size",
      validate: (directive) => {
        const fields = fieldsOf(directive);
        return (
          typeof fields.color === "string" && typeof fields.size === "string"
        );
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
          validate: (directive) => typeof directive.args[0] === "number",
        },
        {
          path: "/location",
          message: "The first argument of /location must be an absolute path starting with /",
          validate: (directive) =>
            typeof directive.args[0] === "string" &&
            directive.args[0].startsWith("/"),
        },
        {
          path: "/location",
          message: "A location block must have at least one respond declaration",
          validate: (directive) =>
            directive.children.some((child) => child.name === "respond"),
        },
        {
          path: "/location/respond",
          message: "Only one respond declaration is allowed per location block",
          validateGroup: (directives) => directives.length <= 1,
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
