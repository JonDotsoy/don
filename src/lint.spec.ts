import { describe, it, expect } from "bun:test";
import { lint, directiveLoc, type LintRule } from "./lint";

describe("lint", () => {
  const portMustBeNumber: LintRule = {
    path: "server.port",
    evaluation({ directive }) {
      const value = directive.args[0];
      if (typeof value !== "string") return [];

      return [
        {
          message: "port debe ser un número, no un string",
          severity: "error",
          loc: directiveLoc(directive),
        },
      ];
    },
  };

  const oneRespondPerLocation: LintRule = {
    path: "location",
    evaluation({ directive }) {
      const responds = directive.children.filter(
        (child) => child.name === "respond",
      );
      if (responds.length <= 1) return [];

      return responds.slice(1).map((extra) => ({
        message:
          "solo puede existir un respond en un location",
        severity: "error",
        loc: directiveLoc(extra),
      }));
    },
  };

  const uniqueLocationPath: LintRule = {
    path: "server.location",
    evaluation({ directive, parent }) {
      if (!parent) return [];

      const siblings = parent.children.filter(
        (child) => child.name === "location" && child.args[0] === directive.args[0],
      );
      if (siblings.indexOf(directive) === 0) return [];

      return [
        {
          message: `solo puede existir un location ${directive.args[0]}`,
          severity: "error",
          loc: directiveLoc(directive),
        },
      ];
    },
  };

  it("reports a string port as an error, with a trace pointing at the value", () => {
    const text = ""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n";

    const issues = lint(text, [portMustBeNumber]);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toBe("port debe ser un número, no un string");
    expect(issues[0]!.trace).toBe("<input>:2:3");
  });

  it("does not report a numeric port", () => {
    const text = ""
      + "server {\n"
      + "  port 3000\n"
      + "}\n";

    expect(lint(text, [portMustBeNumber])).toEqual([]);
  });

  it("reports the second respond in a location as an error", () => {
    const text = ""
      + "location /home {\n"
      + "  respond 200\n"
      + "  respond 400\n"
      + "}\n";

    const issues = lint(text, [oneRespondPerLocation]);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toBe(
      "solo puede existir un respond en un location",
    );
    expect(issues[0]!.trace).toBe("<input>:3:3");
  });

  it("reports a duplicate location path under the same server", () => {
    const text = ""
      + "server {\n"
      + "\n"
      + "location /home {\n"
      + "  respond 200\n"
      + "}\n"
      + "\n"
      + "location /home {\n"
      + "  respond 200\n"
      + "}\n"
      + "\n"
      + "}\n";

    const issues = lint(text, [uniqueLocationPath]);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toBe("solo puede existir un location /home");
    expect(issues[0]!.trace).toBe("<input>:7:1");
  });

  it("uses a custom payload name in the trace", () => {
    const text = ""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n";

    const issues = lint(text, [portMustBeNumber], { payload: "nginx.donly" });

    expect(issues[0]!.trace).toBe("nginx.donly:2:3");
  });

  it("runs a path-less rule once against the document root", () => {
    let calls = 0;
    const rootRule: LintRule = {
      evaluation({ directive, parent, namePath }) {
        calls++;
        expect(parent).toBeNull();
        expect(namePath).toEqual([]);
        expect(directive.name).toBe("server");
        return [];
      },
    };

    lint("server {\n  port 3000\n}\n", [rootRule]);

    expect(calls).toBe(1);
  });
});
