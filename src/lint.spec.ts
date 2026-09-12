import { describe, it, expect } from "bun:test";
import { DON } from "./don";
import { lint, findByPath, type LintRule } from "./lint";

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
    const root = DON.parse(""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n"
    );

    const issues = lint(root, [argIsNumberRule]);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: "/server/port",
      message: "The first argument of /server/port must be a number, not a string",
      severity: "error",
    });
    expect(issues[0]!.directive.args).toEqual(["3000"]);
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
    const root = DON.parse(""
      + "server {\n"
      + "  port 3000\n"
      + '  port "8080"\n'
      + "}\n"
    );

    const issues = lint(root, [argIsNumberRule]);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.directive.args).toEqual(["8080"]);
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
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "  respond 404\n"
        + "}\n"
      );

      const issues = lint(root, [singleRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/location/respond",
        message: "Only one respond declaration is allowed per location block",
        severity: "error",
      });
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
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
        + "location /about {\n"
        + "  respond 200\n"
        + "  respond 404\n"
        + "}\n"
      );

      const issues = lint(root, [singleRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual([200]);
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
      const root = DON.parse(""
        + "location /home {\n"
        + '  root "/var/www"\n'
        + "}\n"
      );

      const issues = lint(root, [requireRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: "/location",
        message: "A location block must have at least one respond declaration",
        severity: "error",
      });
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
      const root = DON.parse(""
        + "location /home {\n"
        + "  respond 200\n"
        + "}\n"
        + "location /about {\n"
        + '  root "/var/www"\n'
        + "}\n"
      );

      const issues = lint(root, [requireRespondRule]);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.directive.args).toEqual(["/about"]);
    });
  });

  describe("findByPath", () => {
    it("resolves a nested path to the matching directives", () => {
      const root = DON.parse(""
        + "server {\n"
        + "  port 3000\n"
        + "}\n"
      );

      const matches = findByPath(root, "/server/port");

      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ name: "port", args: [3000] });
    });

    it("resolves a single top-level directive with an empty child path", () => {
      const root = DON.parse("name \"my-app\"\n");

      expect(findByPath(root, "/name")).toHaveLength(1);
    });
  });
});
