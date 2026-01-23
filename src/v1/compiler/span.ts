import type { Location } from "../types/location.js";

export class Span {
  constructor(
    readonly index: number,
    readonly length: number,
    readonly startLocation: Location,
    readonly endLocation: Location,
  ) {}
}
