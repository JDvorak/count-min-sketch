import { CountMinSketch as LocalSketch } from '../index.js';
// import createCountMinSketch from 'count-min-sketch'; // This caused an error
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const createCountMinSketch = require('count-min-sketch'); // For the external library
const BloomFiltersCMS = require('bloom-filters').CountMinSketch; // For bloom-filters library
import crypto from 'crypto';

// --- Benchmark Parameters ---
const SKETCH_EPSILON = 0.001; // Target error rate (0.1%)
const SKETCH_DELTA = 0.01;   // Target probability of error (1%) // Note: External library calls this probError

const NUM_UNIQUE_KEYS = 10000;
const KEY_LENGTH = 16; // Length of random keys
const NUM_UPDATES = 1000000; // Total update operations
const NUM_QUERIES = 100000;  // Total query operations

// --- Helper Functions ---
function generateRandomKey() {
    return crypto.randomBytes(KEY_LENGTH / 2).toString('hex');
}

function generateKeys(numKeys) {
    const keys = new Array(numKeys);
    for (let i = 0; i < numKeys; i++) {
        keys[i] = generateRandomKey();
    }
    return keys;
}

console.log('--- Count-Min Sketch Benchmark ---');
console.log(`Parameters: Epsilon=${SKETCH_EPSILON}, Delta/ProbError=${SKETCH_DELTA}`);
console.log(`Unique Keys=${NUM_UNIQUE_KEYS}, Updates=${NUM_UPDATES}, Queries=${NUM_QUERIES}\n`);

// Generate a pool of keys
const keys = generateKeys(NUM_UNIQUE_KEYS);
console.log(`Generated ${keys.length} unique keys for benchmark.`);

// --- Benchmark Sketch Creation ---
console.log('\n--- Benchmarking Sketch Creation ---');
let startTime, endTime, durationMs, opsPerSecond;

// Local Sketch
startTime = Date.now();
const localSketch = LocalSketch.createEstimate(SKETCH_EPSILON, SKETCH_DELTA);
endTime = Date.now();
console.log(`Local Sketch created in ${endTime - startTime}ms. Dimensions: width=${localSketch.width}, depth=${localSketch.depth}`);

// External Sketch
startTime = Date.now();
// The external library's constructor takes (epsilon, probError, hashFunc)
// It doesn't have a static createEstimate, but constructor calculates width/depth.
// It also doesn't expose width/depth directly after creation from what its docs show.
const externalSketch = createCountMinSketch(SKETCH_EPSILON, SKETCH_DELTA);
endTime = Date.now();
console.log(`External Sketch created in ${endTime - startTime}ms.`);

// Bloom Filters CMS
startTime = Date.now();
// The bloom-filters library's CountMinSketch constructor takes (width, depth) or (epsilon, delta)
// It also has a static create method: CountMinSketch.create(errorRate, accuracy)
const bloomCMS = BloomFiltersCMS.create(SKETCH_EPSILON, 1 - SKETCH_DELTA);
endTime = Date.now();
console.log(`BloomFilters CMS created in ${endTime - startTime}ms. Dimensions: width=${bloomCMS.width}, depth=${bloomCMS.depth}`);


// --- Benchmark Update Operations ---
console.log('\n--- Benchmarking Update Operations ---');

// Local Sketch
localSketch.clear(); // Clear before use
startTime = Date.now();
for (let i = 0; i < NUM_UPDATES; i++) {
    const key = (Math.random() < 0.1 && keys.length > 10) ? keys[i % 10] : keys[i % keys.length];
    localSketch.update(key, 1);
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`Local: Performed ${NUM_UPDATES} updates in ${durationMs}ms.`);
if (durationMs > 0) {
    opsPerSecond = (NUM_UPDATES / durationMs) * 1000;
    console.log(`Local Update Performance: Approximately ${opsPerSecond.toFixed(2)} updates/second.`);
} else {
    console.log('Local Update benchmark finished too quickly to measure performance.');
}

// External Sketch
// To be fair, we create a new one, as we can't directly 'clear' it based on docs.
const externalSketchForUpdate = createCountMinSketch(SKETCH_EPSILON, SKETCH_DELTA);
startTime = Date.now();
for (let i = 0; i < NUM_UPDATES; i++) {
    const key = (Math.random() < 0.1 && keys.length > 10) ? keys[i % 10] : keys[i % keys.length];
    externalSketchForUpdate.update(key, 1);
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`External: Performed ${NUM_UPDATES} updates in ${durationMs}ms.`);
if (durationMs > 0) {
    opsPerSecond = (NUM_UPDATES / durationMs) * 1000;
    console.log(`External Update Performance: Approximately ${opsPerSecond.toFixed(2)} updates/second.`);
} else {
    console.log('External Update benchmark finished too quickly to measure performance.');
}

// Bloom Filters CMS
// Create a new one for update benchmark
const bloomCMSForUpdate = BloomFiltersCMS.create(SKETCH_EPSILON, 1 - SKETCH_DELTA);
startTime = Date.now();
for (let i = 0; i < NUM_UPDATES; i++) {
    const key = (Math.random() < 0.1 && keys.length > 10) ? keys[i % 10] : keys[i % keys.length];
    bloomCMSForUpdate.update(key); // Default count is 1
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`BloomFilters CMS: Performed ${NUM_UPDATES} updates in ${durationMs}ms.`);
if (durationMs > 0) {
    opsPerSecond = (NUM_UPDATES / durationMs) * 1000;
    console.log(`BloomFilters CMS Update Performance: Approximately ${opsPerSecond.toFixed(2)} updates/second.`);
} else {
    console.log('BloomFilters CMS Update benchmark finished too quickly to measure performance.');
}


// --- Benchmark Query Operations ---
console.log('\n--- Benchmarking Query Operations ---');
// Local sketch is already populated. External sketch for query will be the one used for updates.

// Local Sketch
startTime = Date.now();
let queriedSumLocal = 0;
for (let i = 0; i < NUM_QUERIES; i++) {
    const key = keys[i % keys.length];
    queriedSumLocal += localSketch.query(key);
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`Local: Performed ${NUM_QUERIES} queries in ${durationMs}ms. (Queried sum: ${queriedSumLocal})`);
if (durationMs > 0) {
    opsPerSecond = (NUM_QUERIES / durationMs) * 1000;
    console.log(`Local Query Performance: Approximately ${opsPerSecond.toFixed(2)} queries/second.`);
} else {
    console.log('Local Query benchmark finished too quickly to measure performance.');
}

// External Sketch (using externalSketchForUpdate which is populated)
startTime = Date.now();
let queriedSumExternal = 0;
for (let i = 0; i < NUM_QUERIES; i++) {
    const key = keys[i % keys.length];
    queriedSumExternal += externalSketchForUpdate.query(key);
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`External: Performed ${NUM_QUERIES} queries in ${durationMs}ms. (Queried sum: ${queriedSumExternal})`);
if (durationMs > 0) {
    opsPerSecond = (NUM_QUERIES / durationMs) * 1000;
    console.log(`External Query Performance: Approximately ${opsPerSecond.toFixed(2)} queries/second.`);
} else {
    console.log('External Query benchmark finished too quickly to measure performance.');
}

// Bloom Filters CMS (using bloomCMSForUpdate which is populated)
startTime = Date.now();
let queriedSumBloomCMS = 0;
for (let i = 0; i < NUM_QUERIES; i++) {
    const key = keys[i % keys.length];
    queriedSumBloomCMS += bloomCMSForUpdate.count(key);
}
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`BloomFilters CMS: Performed ${NUM_QUERIES} queries in ${durationMs}ms. (Queried sum: ${queriedSumBloomCMS})`);
if (durationMs > 0) {
    opsPerSecond = (NUM_QUERIES / durationMs) * 1000;
    console.log(`BloomFilters CMS Query Performance: Approximately ${opsPerSecond.toFixed(2)} queries/second.`);
} else {
    console.log('BloomFilters CMS Query benchmark finished too quickly to measure performance.');
}


// --- Benchmark Merge Operations (Example - Local Only) ---
// The external library's documentation does not specify a merge operation.
console.log('\n--- Benchmarking Merge Operations (Local Sketch Only) ---');
const localSketch1 = LocalSketch.createEstimate(SKETCH_EPSILON, SKETCH_DELTA);
const localSketch2 = LocalSketch.createEstimate(SKETCH_EPSILON, SKETCH_DELTA);

for (let i = 0; i < NUM_UPDATES / 2; i++) {
    localSketch1.update(keys[i % keys.length], 1);
}
for (let i = 0; i < NUM_UPDATES / 2; i++) {
    localSketch2.update(keys[(i + Math.floor(keys.length / 2)) % keys.length], 1);
}

startTime = Date.now();
localSketch1.merge(localSketch2);
endTime = Date.now();
durationMs = endTime - startTime;
console.log(`Local: Merged two sketches in ${durationMs}ms.`);


// --- Benchmark Serialization/Deserialization ---
console.log('\n--- Benchmarking JSON Serialization/Deserialization ---');

// Local Sketch (using localSketch1 which is merged)
startTime = Date.now();
const jsonLocal = localSketch1.toJSON();
endTime = Date.now();
console.log(`Local toJSON() took ${endTime - startTime}ms.`);

startTime = Date.now();
const localSketchFromJSON = LocalSketch.fromJSON(jsonLocal);
endTime = Date.now();
console.log(`Local fromJSON() took ${endTime - startTime}ms.`);
if (localSketchFromJSON.query(keys[0]) === localSketch1.query(keys[0])) {
    console.log("Local Serialization/Deserialization test: Basic query check PASSED.");
} else {
    console.log("Local Serialization/Deserialization test: Basic query check FAILED.");
}

// External Sketch (using externalSketchForUpdate)
// The external library's documentation mentions toJSON and fromJSON.
// fromJSON reuses the hash function from the current sketch instance.
const externalSketchForSerialization = createCountMinSketch(SKETCH_EPSILON, SKETCH_DELTA); // Create a fresh one for fromJSON
// Populate it a bit to make serialization meaningful
for (let i = 0; i < 100; i++) externalSketchForSerialization.update(keys[i % keys.length], 1);


startTime = Date.now();
const jsonExternal = externalSketchForSerialization.toJSON();
endTime = Date.now();
console.log(`External toJSON() took ${endTime - startTime}ms.`);

// For fromJSON, the external library's documentation says:
// "The hash function is reused from the current sketch. Note In order for this to be successful
// both the serialized hash table and the current hash table have to have the same hash function."
// This means we need an existing sketch instance to call fromJSON on.
const externalSketchToDeserializeInto = createCountMinSketch(SKETCH_EPSILON, SKETCH_DELTA);
startTime = Date.now();
externalSketchToDeserializeInto.fromJSON(jsonExternal); // fromJSON modifies the sketch instance
endTime = Date.now();
console.log(`External fromJSON() took ${endTime - startTime}ms.`);

// Verify by comparing query results (a simple check)
let externalQueryOriginal = externalSketchForSerialization.query(keys[0]);
let externalQueryDeserialized = externalSketchToDeserializeInto.query(keys[0]);

if (externalQueryOriginal === externalQueryDeserialized) {
    console.log("External Serialization/Deserialization test: Basic query check PASSED.");
} else {
    console.log(`External Serialization/Deserialization test: Basic query check FAILED. (Original: ${externalQueryOriginal}, Deserialized: ${externalQueryDeserialized})`);
}

// BloomFilters CMS - Serialization/Deserialization not supported or discoverable
console.log("BloomFilters CMS: Serialization/Deserialization benchmark skipped (methods not found).");

console.log('\n--- Benchmark Complete ---'); 