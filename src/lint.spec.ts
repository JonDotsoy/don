import { describe, it, expect } from "bun:test";
import { DON } from "./don";
import { argumentLoc, directiveLoc, lint, type LintRule } from "./lint";

describe("lint", () => {
  const portMustBeNumber: LintRule = {
    path: "/server/port",
    evaluation({ directive }) {
      const value = directive.args[0];
      if (typeof value === "number") return [];

      return [
        {
          message: "port debe ser un número, no un string",
          severity: "error",
          loc: argumentLoc(directive, 0),
        },
      ];
    },
  };

  const oneRespondPerLocation: LintRule = {
    path: "/location",
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
    path: "/server/location",
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

  it("reports a string port as an error, with a trace naming the payload path", () => {
    const text = ""
      + "server {\n"
      + '  port "3000"\n'
      + "}\n";

    const issues = lint(text, [portMustBeNumber], { payload: "nginx.donly" });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toBe("port debe ser un número, no un string");
    expect(issues[0]!.trace).toBe("nginx.donly:2:8");
    // Snapshotted through a JSON round-trip: `Token`/`Part` carry a
    // process-global `id` counter that a raw-object snapshot would print
    // and that shifts with unrelated parses elsewhere in the test run,
    // but `toJSON()` (invoked by `JSON.stringify`) omits it.
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
  });

  it("does not report a numeric port", () => {
    const text = ""
      + "server {\n"
      + "  port 3000\n"
      + "}\n";

    const issues = lint(text, [portMustBeNumber]);

    expect(issues).toEqual([]);
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
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
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
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
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
  });

  it("accepts a generator function as evaluation, yielding multiple issues", () => {
    const everyArgMustBeString: LintRule = {
      path: "/tags",
      *evaluation({ directive }) {
        for (const [index, value] of directive.args.entries()) {
          if (typeof value === "string") continue;

          yield {
            message: `el argumento ${index} debe ser un string`,
            severity: "error",
            loc: argumentLoc(directive, index),
          };
        }
      },
    };

    const issues = lint('tags "a" 1 "b" false', [everyArgMustBeString]);

    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.message)).toEqual([
      "el argumento 1 debe ser un string",
      "el argumento 3 debe ser un string",
    ]);
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
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

    const issues = lint("server {\n  port 3000\n}\n", [rootRule]);

    expect(calls).toBe(1);
    expect(JSON.parse(JSON.stringify(issues))).toMatchSnapshot();
  });

  describe("argumentLoc", () => {
    it("spans a single argument by default", () => {
      const directive = DON.parse('database host "localhost" 5432');

      const loc = argumentLoc(directive, 1);

      expect(loc?.start.text()).toBe("localhost");
      expect(loc?.end.text()).toBe("localhost");
    });

    it("spans a range of arguments when given an end index", () => {
      const directive = DON.parse('database host "localhost" 5432');

      const loc = argumentLoc(directive, 1, 2);

      expect(loc?.start.text()).toBe("localhost");
      expect(loc?.end.text()).toBe("5432");
    });

    it("returns undefined for an out-of-range index", () => {
      const directive = DON.parse('database host "localhost" 5432');

      expect(argumentLoc(directive, 5)).toBeUndefined();
    });
  });
});
