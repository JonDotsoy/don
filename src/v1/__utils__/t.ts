type Candidate = Result<any, any, any> | (() => any) | Promise<any>;

export class Result<O, E, V> {
  constructor(
    readonly ok: O,
    readonly error: E,
    readonly value: V,
  ) {}

  *[Symbol.iterator]() {
    yield this.ok;
    yield this.error;
    yield this.value;
  }

  static ok = <V>(value: V) => new Result(true as const, undefined, value);
  static error = <E>(error: E) => new Result(false as const, error, undefined);
}

type ResultType<O, E, V> = Result<O, E, V> & [O, E, V];

type AwaitedResult<V> =
  | ResultType<true, unknown, V>
  | Result<false, unknown, null>;

type R<T> =
  T extends Result<infer O, infer E, infer V>
    ? ResultType<O, E, V>
    : T extends Promise<infer V>
      ? Promise<AwaitedResult<V>>
      : T extends () => infer V
        ? V extends Promise<infer VV>
          ? Promise<AwaitedResult<VV>>
          : ResultType<true, unknown, V> | Result<false, unknown, null>
        : ResultType<false, unknown, never>;

export const t = <T extends Candidate>(candidate: T): R<T> => {
  if (candidate instanceof Result) {
    return candidate as any;
  }
  if (candidate instanceof Promise) {
    return candidate.then(Result.ok, Result.error) as any;
  }
  if (typeof candidate === "function") {
    try {
      const value = candidate();
      if (value instanceof Promise) {
        return value.then(Result.ok, Result.error) as any;
      }
      return Result.ok(value) as any;
    } catch (ex) {
      return Result.error(ex) as any;
    }
  }
  return Result.error(new Error("invalid candidate")) as any;
};
