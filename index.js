/**
 * Basic 32-bit FNV-1a hash function for strings.
 * @param {string} str The string to hash.
 * @param {number} seed A seed value to alter the hash output.
 * @returns {number} A 32-bit integer hash.
 */
function hashStringFNV1a(str, seed = 0) {
  let hash = 2166136261; // FNV offset basis
  const len = str.length;
  hash ^= seed;

  for (var i = 0; i < len; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 16777619); // FNV prime
  }
  return hash >>> 0;
}


/**
 * Generates multiple hash values for a key and stores them in a pre-allocated array.
 * @param {string} key The key to hash.
 * @param {number} depth The number of hash values to generate (number of rows).
 * @param {number[]} seeds Pre-generated seeds for each hash function.
 * @param {Uint32Array} outHashes Pre-allocated array to store the hash values.
 */
function populateHashes(key, depth, seeds, outHashes) {
    for (let i = 0; i < depth; ++i) {
        outHashes[i] = hashStringFNV1a(key, seeds[i]);
    }
}

/**
 * Finds the next power of 2 greater than or equal to n.
 * @param {number} n
 * @returns {number}
 */
function nextPowerOf2(n) {
  if (n <= 0) return 1;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}

/**
 * Count-Min Sketch implementation for estimating frequencies.
 */
export class CountMinSketch {
  width;
  depth;
  table;
  seeds; // Seeds for hash functions
  scratchHashes; // Pre-allocated array for hash values

  /**
   * Creates a Count-Min Sketch.
   * @param {number} width - The width of the sketch table (number of counters per row).
   * @param {number} depth - The depth of the sketch table (number of hash functions/rows).
   */
  constructor(width, depth) {
      if (width <= 0 || depth <= 0) {
          throw new Error('Width and depth must be positive integers');
      }
      this.width = nextPowerOf2(width | 0);
      this.depth = depth | 0;
      if (this.width !== width) {
            console.log(`Adjusted sketch width from ${width} to next power of 2: ${this.width}`);
      }
      this.table = new Uint32Array(this.width * this.depth);
      this.scratchHashes = new Uint32Array(this.depth); // Initialize scratchHashes

      this.seeds = new Array(this.depth);
      for (let i = 0; i < this.depth; i++) {
          this.seeds[i] = i; // Simple integer seeds are fine as they modify the string
      }
  }

  /**
   * Estimates the width and depth based on desired error rate (epsilon) and probability (delta).
   * width = ceil(e / epsilon)
   * depth = ceil(ln(1 / delta))
   * @param {number} epsilon - Maximum error rate (e.g., 0.01 for 1%).
   * @param {number} delta - Probability of exceeding the error rate (e.g., 0.01 for 1%).
   * @returns {CountMinSketch}
   */
  static createEstimate(epsilon, delta) {
      if (epsilon <= 0 || epsilon >= 1 || delta <= 0 || delta >= 1) {
          throw new Error('Epsilon and delta must be between 0 and 1 (exclusive)');
      }
      const calculatedWidth = Math.ceil(Math.E / epsilon); // approx 2.718 / epsilon
      const width = nextPowerOf2(calculatedWidth);
      const depth = Math.ceil(Math.log(1 / delta)); 
      console.log(`Creating sketch with estimated width=${calculatedWidth} (adjusted to ${width}), depth=${depth} for epsilon=${epsilon}, delta=${delta}`);
      return new CountMinSketch(width, depth);
  }


  /**
   * Updates the frequency count for a given key.
   * @param {string} key - The key to update.
   * @param {number} [count=1] - The amount to increment the count by.
   */
  update(key, count = 1) {
      if (count <= 0) return; // Only increment
      populateHashes(key, this.depth, this.seeds, this.scratchHashes); // Use populateHashes
      const w = this.width;
      const bitmask = w - 1; // Pre-calculate for bitwise AND
      const currentHashes = this.scratchHashes; // Use the member variable

      if (this.depth === 5) { // Common case based on logs
          this.table[(currentHashes[0] & bitmask) + (0 * w)] += count;
          this.table[(currentHashes[1] & bitmask) + (1 * w)] += count;
          this.table[(currentHashes[2] & bitmask) + (2 * w)] += count;
          this.table[(currentHashes[3] & bitmask) + (3 * w)] += count;
          this.table[(currentHashes[4] & bitmask) + (4 * w)] += count;
      } else { // Fallback for other depths
          for (let i = 0; i < this.depth; ++i) {
              const index = (currentHashes[i] & bitmask) + (i * w);
              this.table[index] += count;
          }
      }
  }

  /**
   * Queries the estimated frequency count for a given key.
   * @param {string} key - The key to query.
   * @returns {number} The estimated frequency count.
   */
  query(key) {
      populateHashes(key, this.depth, this.seeds, this.scratchHashes); // Use populateHashes
      let minCount = Infinity;
      const w = this.width;
      const bitmask = w - 1; // Pre-calculate for bitwise AND
      const currentHashes = this.scratchHashes; // Use the member variable

      if (this.depth === 5) { // Common case based on logs
          minCount = Math.min(minCount, this.table[(currentHashes[0] & bitmask) + (0 * w)]);
          minCount = Math.min(minCount, this.table[(currentHashes[1] & bitmask) + (1 * w)]);
          minCount = Math.min(minCount, this.table[(currentHashes[2] & bitmask) + (2 * w)]);
          minCount = Math.min(minCount, this.table[(currentHashes[3] & bitmask) + (3 * w)]);
          minCount = Math.min(minCount, this.table[(currentHashes[4] & bitmask) + (4 * w)]);
      } else { // Fallback for other depths
          for (let i = 0; i < this.depth; ++i) {
              const index = (currentHashes[i] & bitmask) + (i * w);
              minCount = Math.min(minCount, this.table[index]);
          }
      }
      return minCount;
  }

  /**
   * Merges another Count-Min Sketch into this one.
   * Both sketches must have the same width and depth.
   * @param {CountMinSketch} otherSketch - The sketch to merge.
   * @throws {Error} If dimensions do not match.
   */
  merge(otherSketch) {
      if (this.width !== otherSketch.width || this.depth !== otherSketch.depth) {
          throw new Error('Cannot merge sketches with different dimensions');
      }
      for (let i = 0; i < this.table.length; i++) {
          this.table[i] += otherSketch.table[i];
      }
  }

    /**
   * Resets all counters in the sketch to zero.
   */
  clear() {
      this.table.fill(0);
  }

  /**
   * Serializes the sketch to a JSON-compatible object.
   * @returns {{width: number, depth: number, table: number[]}}
   */
  toJSON() {
      return {
          width: this.width,
          depth: this.depth,
          table: Array.from(this.table)
      };
  }

  /**
   * Creates a CountMinSketch instance from a JSON object.
   * @param {{width: number, depth: number, table: number[]}} data - The serialized sketch data.
   * @returns {CountMinSketch}
   * @throws {Error} If data is invalid.
   */
  static fromJSON(data) {
      if (!data || typeof data !== 'object' || !data.width || !data.depth || !Array.isArray(data.table)) {
          throw new Error('Invalid data format for CountMinSketch reconstruction');
      }
      const sketch = new CountMinSketch(data.width, data.depth);
      if (sketch.table.length !== data.table.length) {
          throw new Error(`Table length mismatch: expected ${sketch.table.length}, got ${data.table.length}`);
      }
      sketch.table.set(data.table);
      return sketch;
  }
} 