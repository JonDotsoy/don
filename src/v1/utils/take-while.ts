/**
 * Generator function that yields elements from an array while a predicate condition is true.
 * Stops iteration as soon as the predicate returns false.
 *
 * @template T - The type of elements in the array
 * @param {T[]} array - The source array to iterate over
 * @param {(value: T, index: number, array: T[]) => boolean} predicate - Function that tests each element.
 *   Returns true to continue yielding elements, false to stop iteration.
 * @param {number} [fromIndex=0] - The index to start iteration from (defaults to 0)
 * @yields {T} Elements from the array while the predicate returns true
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5, 6];
 * const lessThanFour = [...takeWhile(numbers, n => n < 4)];
 * // Result: [1, 2, 3]
 * ```
 *
 * @example
 * ```ts
 * const tokens = ['a', 'b', 'c', 'd'];
 * const untilC = [...takeWhile(tokens, t => t !== 'c')];
 * // Result: ['a', 'b']
 * ```
 *
 * @example
 * ```ts
 * // Starting from a specific index
 * const items = [1, 2, 3, 4, 5];
 * const fromIndex2 = [...takeWhile(items, n => n < 5, 2)];
 * // Result: [3, 4]
 * ```
 */
export const takeWhile = function* <T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => boolean,
  fromIndex: number = 0,
) {
  for (let index = fromIndex; index < array.length; index++) {
    const item = array[index]!;

    if (!predicate(item, index, array)) {
      break;
    }

    yield item;
  }
};

/**
 * Finds the index of the first element in an array that satisfies the provided predicate function.
 *
 * @template T - The type of elements in the array
 * @param array - The array to search
 * @param predicate - Function to test each element. Returns truthy value for matching element
 * @param fromIndex - The index to start searching from (default: 0)
 * @returns The index of the first matching element, or -1 if no match is found
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * findIndex(numbers, (n) => n > 3); // Returns 3
 * findIndex(numbers, (n) => n > 3, 4); // Returns 4 (starts from index 4)
 * findIndex(numbers, (n) => n > 10); // Returns -1
 * ```
 */
export const findIndex = function <T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => unknown,
  fromIndex: number = 0,
) {
  for (let index = fromIndex; index < array.length; index++) {
    const item = array[index]!;

    if (predicate(item, index, array)) {
      return index;
    }
  }
  return -1;
};
