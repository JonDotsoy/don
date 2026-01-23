export namespace CharsetTools {
  export const charCode = (char: number | string) =>
    typeof char === "string" ? char.charCodeAt(0) : char;
  export const range = (start: number | string, end: number | string) => {
    const startCharCode = charCode(start);
    const endCharCode = charCode(end);
    const length = endCharCode - startCharCode + 1;
    return Array.from({ length }, (_, i) => startCharCode + i);
  };

  // alphabet
  export const alphabetCharts = [
    ...CharsetTools.range("a", "z"),
    ...CharsetTools.range("A", "Z"),
  ];
  // numeric
  export const numericCharts = [...CharsetTools.range("0", "9")];
  // space & tab
  export const whitespaceCharts = [
    CharsetTools.charCode(" "),
    CharsetTools.charCode("\t"),
  ];
  // \n: newline
  export const newlineCharts = [CharsetTools.charCode("\n")];
  // .: dot
  export const dotCharts = [CharsetTools.charCode(".")];
  // _: underscore
  export const underscoreCharts = [CharsetTools.charCode("_")];
  // {: open curly brace
  export const openCurlyBraceCharts = [CharsetTools.charCode("{")];
  // }: close curly brace
  export const closeCurlyBraceCharts = [CharsetTools.charCode("}")];
  // Double Quote
  export const doubleQuoteCharts = [CharsetTools.charCode(`"`)];
  // Single Quote
  export const singleQuoteCharts = [CharsetTools.charCode("'")];
}
