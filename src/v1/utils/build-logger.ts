type SubstitutionTest = (value: unknown) => value is any;

type LOGGER = (...args: Parameters<typeof String.raw>) => void;

interface A {
  test: (value: unknown) => boolean;

  transform: (value: any) => any;
}

const nothing: LOGGER = () => {};
const log: LOGGER = (...args) => {
  console.log(String.raw(...args));
};

export const buildLogger = <T extends A[]>(options?: {
  enabled?: boolean;
  tranformSubstitutions?: T;
}): LOGGER => {
  const enabled = options?.enabled ?? false;

  if (!enabled) return nothing;

  return (template, ...substitutions) => {
    log(
      template,
      ...substitutions.map((substitution: any) => {
        for (const { test, transform } of options?.tranformSubstitutions ??
          []) {
          if (test(substitution)) return transform(substitution);
        }
        return substitution;
      }),
    );
  };
};
