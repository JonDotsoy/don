import { describe, it, expect } from "bun:test";
import { DON } from "./don";
import { lint, findByPath, type LintIssue, type LintRule } from "./lint";

const expectLoc = (issue: LintIssue, text: string, expected: string) => {
  expect(issue.loc).toEqual(issue.directive.loc);
  expect(issue.loc).toBeDefined();
  expect(text.slice(issue.loc!.start, issue.loc!.end)).toBe(expected);
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
      expect(issues[0]!.loc!.start).toBe(
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
      expect(text.slice(matches[0]!.loc!.start, matches[0]!.loc!.end)).toBe(
        "port 3000",
      );
    });

    it("resolves a single top-level directive with an empty child path", () => {
      const root = DON.parse("name \"my-app\"\n");

      expect(findByPath(root, "/name")).toHaveLength(1);
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
        source: text.slice(issue.loc!.start, issue.loc!.end),
        directive: { name: issue.directive.name, args: issue.directive.args },
      }));

      expect(report).toMatchSnapshot();
    });
  });
});
