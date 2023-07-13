# Count-Min Sketch for JavaScript

[![npm package](https://nodei.co/npm/faster-count-min-sketch.png?downloads=true&stars=true)](https://nodei.co/npm/faster-count-min-sketch/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/JDvorak/CountMinSketch/actions)
[![Benchmarks](https://img.shields.io/badge/benchmarks-passing-brightgreen)](https://github.com/JDvorak/CountMinSketch/actions)


A simple, efficient, and **fast** Count-Min Sketch implementation in JavaScript for estimating item frequencies in data streams. Ideal for scenarios where memory is a concern and exact counts are not strictly necessary. This implementation prioritizes speed and offers a straightforward API.

## Why Count-Min Sketch? (Use Cases)

Count-Min Sketch (CMS) is a probabilistic data structure that provides an efficient way to estimate the frequency of items (cardinality) in a large dataset or a continuous data stream. It's particularly useful when:

*   **Memory is Limited:** Storing exact counts for every unique item in a massive dataset (e.g., website visits, network traffic events, unique words in a large corpus) can be memory-prohibitive. CMS offers a compact way to get good frequency estimates using significantly less memory.
*   **Processing High-Speed Streams:** When data arrives too quickly to process and store everything, CMS can provide real-time frequency estimations.
*   **Identifying Heavy Hitters:** Quickly find the most frequent items in a stream without keeping track of all items.
*   **Database Query Optimization:** Estimate result sizes for database queries.
*   **Network Monitoring:** Track frequent IP addresses, packet types, etc.

**Key Trade-off:** CMS provides approximate counts. It guarantees that the estimated frequency is never less than the true frequency, but it might be an overestimate. The accuracy of this overestimation can be controlled by parameters `epsilon` (error factor) and `delta` (probability of error).

## Features

*   Create sketches with specific width and depth.
*   Create sketches based on desired error rate (`epsilon`) and probability of error (`delta`).
*   Fast item count updates.
*   Efficient querying of estimated item counts.
*   Ability to merge two sketches.
*   Serialization and deserialization of sketches to/from JSON.
*   Uses a highly optimized FNV1a hash function for speed.
*   Internal optimizations:
    *   Table width automatically adjusted to the next power of 2 for faster modulo operations (using bitwise AND).
    *   Loop unrolling for the most common sketch depth (5) for a slight performance boost in `update` and `query`.
    *   Reuses internal arrays for hash computations to reduce garbage collection overhead.

## Installation

```bash
npm install faster-count-min-sketch
# or
yarn add faster-count-min-sketch
```
*(Assuming the package name on npm will be `faster-count-min-sketch` as per your `package.json`. If it's `count-min-sketch`, adjust accordingly.)*

## Usage

```javascript
import { CountMinSketch } from 'faster-count-min-sketch'; // Or your actual package name

// --- Basic Example ---

// Create with desired error guarantees (recommended)
// Epsilon: error factor (e.g., 0.001 means error is N * 0.001)
// Delta: probability of error exceeding epsilon (e.g., 0.01 means 1% chance)
const sketch = CountMinSketch.createEstimate(0.001, 0.01);

sketch.update("apple", 5); // Increment count of "apple" by 5
sketch.update("banana", 2);
sketch.update("apple", 3);    // "apple" is now 8

console.log("Estimated count for 'apple':", sketch.query("apple"));   // Expected: around 8
console.log("Estimated count for 'banana':", sketch.query("banana")); // Expected: around 2
console.log("Estimated count for 'orange':", sketch.query("orange")); // Expected: 0 or small number (overestimation)

// Update with default count (1)
sketch.update("grape");
console.log("Estimated count for 'grape':", sketch.query("grape"));   // Expected: 1


// --- Merging Sketches ---
const sketchA = CountMinSketch.createEstimate(0.01, 0.01);
sketchA.update("user:123", 10);
sketchA.update("event:click", 5);

const sketchB = CountMinSketch.createEstimate(0.01, 0.01); // Must have same epsilon/delta or resulting width/depth
sketchB.update("user:123", 7);
sketchB.update("event:submit", 12);

sketchA.merge(sketchB);
console.log("Merged 'user:123':", sketchA.query("user:123")); // Expected: 17
console.log("Merged 'event:click':", sketchA.query("event:click"));   // Expected: 5
console.log("Merged 'event:submit':", sketchA.query("event:submit")); // Expected: 12

// --- Serialization ---
const jsonData = sketchA.toJSON();
// console.log(JSON.stringify(jsonData)); // You can store or transmit this

const hydratedSketch = CountMinSketch.fromJSON(jsonData);
console.log("Hydrated 'user:123':", hydratedSketch.query("user:123")); // Expected: 17
```

## API

### `new CountMinSketch(width, depth)`

Creates a new Count-Min sketch instance directly with specified dimensions.

*   `width` (number): The width of the sketch table (number of counters per row). For optimal performance (using bitwise operations for modulo), this value will be automatically adjusted to the next power of 2 if it isn't already.
*   `depth` (number): The depth of the sketch table (number of hash functions/rows).
*   **Throws**: `Error` if `width` or `depth` are not positive integers.

### `CountMinSketch.createEstimate(epsilon, delta)`

A static factory method to create a Count-Min Sketch with dimensions estimated based on desired error guarantees. This is the recommended way to create a sketch.

*   `epsilon` (number): The desired error factor (0 < `epsilon` < 1). The error in estimation for an item's frequency `f(x)` is typically within `epsilon * N` (where `N` is the sum of all frequencies inserted into the sketch). For example, an `epsilon` of `0.001` means the error is roughly 0.1% of the total sum of counts.
*   `delta` (number): The desired probability of the error exceeding `epsilon * N` (0 < `delta` < 1). For example, a `delta` of `0.01` means there's a 1% chance the actual error is larger than the bound defined by `epsilon`.
*   **Returns**: A new `CountMinSketch` instance.
*   **Throws**: `Error` if `epsilon` or `delta` are not within the range (0, 1).
*   **Note**: The actual `width` will be `ceil(Math.E / epsilon)` adjusted to the next power of 2, and `depth` will be `ceil(Math.log(1 / delta))`. The console will log these calculated and adjusted dimensions.

### `update(key, count = 1)`

Increments the frequency count for the given `key`.

*   `key` (string): The item/key to update.
*   `count` (number, default: `1`): The amount to increment the count by. Must be a positive integer. If `count <= 0`, the sketch is not modified.

### `query(key)`

Returns the estimated frequency count for the given `key`.

*   `key` (string): The item/key to query.
*   **Returns**: `number` - The estimated frequency. This value is always non-negative. For items not frequently updated, or due to hash collisions, this might be an overestimate. It will never be an underestimate.

### `merge(otherSketch)`

Merges another Count-Min Sketch into the current one. This is done by adding the counts from `otherSketch.table` to `this.table`.

*   `otherSketch` (CountMinSketch): The sketch to merge into the current one.
*   **Throws**: `Error` if `this.width !== otherSketch.width` or `this.depth !== otherSketch.depth`. Both sketches must have identical dimensions for merging to be valid.

### `clear()`

Resets all counters in the sketch table to zero.

### `toJSON()`

Serializes the sketch to a JSON-compatible object, allowing it to be stored or transmitted.

*   **Returns**: `object` - An object with the following properties:
    *   `width` (number): The width of the sketch.
    *   `depth` (number): The depth of the sketch.
    *   `table` (number[]): An array representing the sketch's counter table.

### `CountMinSketch.fromJSON(data)`

A static factory method to create a CountMinSketch instance from a previously serialized JSON object (from `toJSON()`.

*   `data` (object): The serialized sketch data, typically obtained from `toJSON()`. Must contain `width`, `depth`, and `table` properties.
*   **Returns**: A new `CountMinSketch` instance.
*   **Throws**: `Error` if the `data` object is invalid, missing properties, or if `data.table.length` does not match `data.width * data.depth`.

## Error Guarantees (Epsilon & Delta)

The accuracy of a Count-Min Sketch is determined by two parameters:

*   **`epsilon` (ε): Error Factor**
    *   This value (between 0 and 1) controls the *amount* of overestimation.
    *   The estimated frequency `est_f(x)` for an item `x` with true frequency `true_f(x)` is guaranteed to be:
        `true_f(x) <= est_f(x) <= true_f(x) + ε * N`
    *   Where `N` is the sum of all frequencies (counts) inserted into the sketch (the L1 norm of the frequency vector).
    *   A smaller `epsilon` means a tighter error bound (less overestimation) but requires a larger sketch width (`w ≈ e/ε`).

*   **`delta` (δ): Probability of Error**
    *   This value (between 0 and 1) controls the *probability* that the error bound defined by `epsilon` is violated.
    *   The guarantee `est_f(x) <= true_f(x) + ε * N` holds with a probability of at least `1 - δ`.
    *   A smaller `delta` means a higher confidence that the error bound is met but requires a larger sketch depth (`d ≈ ln(1/δ)`).

**In simpler terms:**
*   You want `epsilon` to be small for more accurate counts.
*   You want `delta` to be small for higher confidence in that accuracy.
*   Smaller `epsilon` and `delta` lead to a larger, more accurate sketch, which uses more memory.

When using `CountMinSketch.createEstimate(epsilon, delta)`, these parameters are used to determine the optimal `width` and `depth` for the sketch to meet your desired error guarantees.

## Benchmarks

This implementation has been benchmarked against other popular libraries and shows competitive, often superior, performance due to careful optimization of hashing and internal operations.

To run the included benchmarks:
```bash
cd CountMinSketch # Navigate to the package directory
npm install       # Ensure devDependencies like 'count-min-sketch' (for comparison) are installed
npm run benchmark
```
The output will show performance for sketch creation, updates, and queries, comparing this library (Local) with an external one.

**Example Benchmark Output Snippet (Your Mileage May Vary):**

| Library                   | Operation | Ops Performed | Time Taken (ms) | Performance (ops/sec)         |
|---------------------------|-----------|-----------------|-----------------|-------------------------------|
| `faster-count-min-sketch` | Update    | 1,000,000       | 183             | ~5,464,480.87                 |
| `count-min-sketch`        | Update    | 1,000,000       | 343             | ~2,915,451.90                 |
| `BloomFilters CMS`        | Update    | 1,000,000       | 8821            | ~113,365.83                   |
| `faster-count-min-sketch` | Query     | 100,000         | 30              | ~3,333,333.33                 |
| `count-min-sketch`        | Query     | 100,000         | 39              | ~2,564,102.56                 |
| `BloomFilters CMS`        | Query     | 100,000         | 886             | ~112,866.82                   |

## How It Works (Briefly)

The Count-Min Sketch uses a 2D array (table) of `depth` rows and `width` columns. Each row is associated with an independent hash function.
*   **Update `(item, count)`**: For each of the `depth` hash functions, hash `item` to get a column index. Increment the counter at `table[row][column_index]` by `count`.
*   **Query `(item)`**: For each of the `depth` hash functions, hash `item` to get a column index. Retrieve the counts from `table[row][column_index]`. The minimum of these `depth` counts is returned as the estimated frequency.

This "minimum of multiple hashes" approach is why the sketch overestimates but never underestimates.

## License

MIT 