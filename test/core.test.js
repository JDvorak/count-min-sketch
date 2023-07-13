import tape from 'tape';
import { CountMinSketch } from '../index.js';

const test = tape;

// Helper to generate random strings
function generateRandomString(length = 10) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

test('CountMinSketch - Basic Creation', (t) => {
    t.comment('--- Direct Width/Depth Constructor ---');
    const sketch1 = new CountMinSketch(1024, 5);
    t.equal(sketch1.width, 1024, 'Width should be set (and power of 2)');
    t.equal(sketch1.depth, 5, 'Depth should be set');
    t.equal(sketch1.table.length, 1024 * 5, 'Table should be allocated');
    t.equal(sketch1.scratchHashes.length, 5, 'Scratch hashes should be allocated');

    const sketch2 = new CountMinSketch(1000, 4); // Width will be adjusted
    t.equal(sketch2.width, 1024, 'Width should be adjusted to next power of 2 (1000 -> 1024)');
    t.equal(sketch2.depth, 4, 'Depth should be set');

    t.comment('--- createEstimate Constructor ---');
    const epsilon = 0.01; // 1% error
    const delta = 0.01;   // 1% probability of exceeding error
    const sketch3 = CountMinSketch.createEstimate(epsilon, delta);
    // Expected width w = ceil(e / epsilon) = ceil(2.718 / 0.01) = ceil(271.8) = 272. Adjusted to 512.
    // Expected depth d = ceil(ln(1 / delta)) = ceil(ln(100)) = ceil(4.605) = 5.
    t.ok(sketch3.width >= Math.ceil(Math.E / epsilon), 'Estimated width should be reasonable');
    t.equal(sketch3.width, 512, 'Estimated width should be power of 2 (272 -> 512)');
    t.equal(sketch3.depth, 5, 'Estimated depth should be reasonable (ln(1/0.01) = 5)');
    t.equal(sketch3.table.length, sketch3.width * sketch3.depth, 'Table allocated for estimated sketch');

    t.end();
});

test('CountMinSketch - Update and Query', (t) => {
    const sketch = CountMinSketch.createEstimate(0.001, 0.01); // width=4096, depth=5

    t.comment('--- Single Key Updates ---');
    sketch.update('apple', 3);
    t.equal(sketch.query('apple'), 3, 'Query for "apple" after 1 update should be 3');
    sketch.update('apple', 5);
    t.equal(sketch.query('apple'), 8, 'Query for "apple" after 2 updates should be 8 (3+5)');

    t.comment('--- Multiple Keys ---');
    sketch.update('banana', 10);
    t.equal(sketch.query('banana'), 10, 'Query for "banana" should be 10');
    t.equal(sketch.query('apple'), 8, '"apple" count should remain unchanged');

    t.comment('--- Non-existent Key ---');
    t.ok(sketch.query('orange') >= 0, 'Query for "orange" (non-existent) should be >= 0');
    // With good hashing, it should be 0 or very small due to collisions.

    t.comment('--- Update with count = 1 (default) ---');
    sketch.update('grape');
    t.equal(sketch.query('grape'), 1, 'Query for "grape" after default count update should be 1');

    t.comment('--- Update with count <= 0 (should not change) ---');
    const grapeCountBefore = sketch.query('grape');
    sketch.update('grape', 0);
    t.equal(sketch.query('grape'), grapeCountBefore, 'Update with count 0 should not change count');
    sketch.update('grape', -5);
    t.equal(sketch.query('grape'), grapeCountBefore, 'Update with negative count should not change count');


    t.end();
});

test('CountMinSketch - Clear', (t) => {
    const sketch = CountMinSketch.createEstimate(0.01, 0.01);
    sketch.update('item1', 100);
    sketch.update('item2', 200);
    sketch.clear();
    t.equal(sketch.query('item1'), 0, 'Query after clear should be 0 for item1');
    t.equal(sketch.query('item2'), 0, 'Query after clear should be 0 for item2');
    t.ok(sketch.table.every(val => val === 0), 'All table entries should be 0 after clear');
    t.end();
});

test('CountMinSketch - Merge', (t) => {
    const sketchA = CountMinSketch.createEstimate(0.01, 0.01);
    sketchA.update('apple', 10);
    sketchA.update('banana', 5);

    const sketchB = CountMinSketch.createEstimate(0.01, 0.01);
    sketchB.update('apple', 7);
    sketchB.update('orange', 12);

    sketchA.merge(sketchB);

    t.equal(sketchA.query('apple'), 17, 'Merged "apple" count should be 17 (10+7)');
    t.equal(sketchA.query('banana'), 5, 'Merged "banana" count should be 5 (from sketchA)');
    t.equal(sketchA.query('orange'), 12, 'Merged "orange" count should be 12 (from sketchB)');

    const sketchC = new CountMinSketch(sketchA.width / 2, sketchA.depth); // Different width
    t.throws(() => {
        sketchA.merge(sketchC);
    }, /Cannot merge sketches with different dimensions/, 'Should throw error for merging sketches with different widths');

    const sketchD = new CountMinSketch(sketchA.width, sketchA.depth / 2 + 1); // Different depth
    t.throws(() => {
        sketchA.merge(sketchD);
    }, /Cannot merge sketches with different dimensions/, 'Should throw error for merging sketches with different depths');

    t.end();
});

test('CountMinSketch - JSON Serialization', (t) => {
    const originalSketch = CountMinSketch.createEstimate(0.005, 0.001);
    originalSketch.update('testKey1', 50);
    originalSketch.update('testKey2', 123);
    originalSketch.update(generateRandomString(20), 77); // A longer key

    const json = originalSketch.toJSON();
    t.equal(typeof json, 'object', 'toJSON() should return an object');
    t.equal(json.width, originalSketch.width, 'Serialized width should match');
    t.equal(json.depth, originalSketch.depth, 'Serialized depth should match');
    t.ok(Array.isArray(json.table), 'Serialized table should be an array');
    t.equal(json.table.length, originalSketch.table.length, 'Serialized table length should match');

    const reconstructedSketch = CountMinSketch.fromJSON(json);
    t.ok(reconstructedSketch instanceof CountMinSketch, 'fromJSON() should return a CountMinSketch instance');
    t.equal(reconstructedSketch.width, originalSketch.width, 'Reconstructed width should match');
    t.equal(reconstructedSketch.depth, originalSketch.depth, 'Reconstructed depth should match');
    t.deepEqual(Array.from(reconstructedSketch.table), Array.from(originalSketch.table), 'Reconstructed table content should match');

    t.equal(reconstructedSketch.query('testKey1'), 50, 'Query for testKey1 on reconstructed sketch should match');
    t.equal(reconstructedSketch.query('testKey2'), 123, 'Query for testKey2 on reconstructed sketch should match');
    t.equal(reconstructedSketch.query('nonExistentKey'), 0, 'Query for non-existent key on reconstructed sketch should be 0 or low');

    // Test invalid JSON
    t.throws(() => CountMinSketch.fromJSON({ width: 10, depth: 5 }), /Invalid data format/, 'fromJSON with missing table');
    t.throws(() => CountMinSketch.fromJSON({ width: 10, table: [], depth: undefined }), /Invalid data format/, 'fromJSON with missing depth');
    t.throws(() => CountMinSketch.fromJSON("not an object"), /Invalid data format/, 'fromJSON with string input');
    const badTableJson = {width: originalSketch.width, depth: originalSketch.depth, table: [1,2,3]}; // incorrect length
    t.throws(() => CountMinSketch.fromJSON(badTableJson), /Table length mismatch/, 'fromJSON with table length mismatch');


    t.end();
});

test('CountMinSketch - Input Validations', (t) => {
    t.throws(() => new CountMinSketch(0, 5), /Width and depth must be positive integers/, 'Throws for 0 width');
    t.throws(() => new CountMinSketch(10, -1), /Width and depth must be positive integers/, 'Throws for negative depth');

    t.throws(() => CountMinSketch.createEstimate(0, 0.01), /Epsilon and delta must be between 0 and 1/, 'Throws for epsilon = 0');
    t.throws(() => CountMinSketch.createEstimate(1.1, 0.01), /Epsilon and delta must be between 0 and 1/, 'Throws for epsilon > 1');
    t.throws(() => CountMinSketch.createEstimate(0.01, -0.1), /Epsilon and delta must be between 0 and 1/, 'Throws for delta < 0');
    t.throws(() => CountMinSketch.createEstimate(0.01, 1), /Epsilon and delta must be between 0 and 1/, 'Throws for delta = 1');

    t.end();
});


// Monte Carlo test for frequency estimation accuracy
test('CountMinSketch - Frequency Estimation Accuracy (Monte Carlo)', (t) => {
    const epsilon = 0.001; // Target error rate
    const delta = 0.01;    // Target probability of error
    const sketch = CountMinSketch.createEstimate(epsilon, delta);

    const numItems = 1000;
    const updatesPerItem = 100; // True frequency for each item
    const items = [];
    const trueFrequencies = {};

    // Populate sketch with known frequencies
    for (let i = 0; i < numItems; i++) {
        const item = generateRandomString(15) + `_${i}`; // Ensure unique items
        items.push(item);
        trueFrequencies[item] = updatesPerItem;
        for (let j = 0; j < updatesPerItem; j++) {
            sketch.update(item);
        }
    }

    let totalError = 0;
    let violations = 0; // Count how many times estimated > true + epsilon * total_updates_sum
    // For CMS, the guarantee is P(est_freq(x) > true_freq(x) + epsilon * N) < delta
    // N is the sum of all counts (L1 norm of the frequency vector).
    // Here, N = numItems * updatesPerItem.
    const N_total_updates = numItems * updatesPerItem;

    items.forEach(item => {
        const trueFreq = trueFrequencies[item];
        const estimatedFreq = sketch.query(item);

        t.ok(estimatedFreq >= trueFreq, `Estimated frequency for "${item}" (${estimatedFreq}) should be >= true frequency (${trueFreq})`);
        const error = estimatedFreq - trueFreq;
        totalError += error;

        if (estimatedFreq > trueFreq + epsilon * N_total_updates) {
            violations++;
        }
    });

    const averageError = totalError / numItems;
    const violationRate = violations / numItems;

    t.comment(`Monte Carlo Summary (epsilon=${epsilon}, delta=${delta}):`);
    t.comment(`  Total items: ${numItems}`);
    t.comment(`  True frequency per item: ${updatesPerItem}`);
    t.comment(`  N (total sum of frequencies): ${N_total_updates}`);
    t.comment(`  Average over-estimation error: ${averageError.toFixed(2)}`);
    t.comment(`  Allowed error bound (epsilon * N): ${epsilon * N_total_updates}`);
    t.comment(`  Violations (estimate > true + epsilon*N): ${violations}`);
    t.comment(`  Violation rate: ${(violationRate * 100).toFixed(2)}%`);

    // Check if violation rate is within delta (with some margin for statistical noise)
    // This test is probabilistic, so we add a small margin.
    t.ok(violationRate <= delta + 0.02, `Violation rate (${(violationRate * 100).toFixed(2)}%) should be <= delta (${delta * 100}%) (plus margin)`);

    // Also test a non-existent item
    const nonExistentItem = "THIS_ITEM_DOES_NOT_EXIST_IN_THE_SKETCH_AT_ALL_EVER";
    const nonExistentQuery = sketch.query(nonExistentItem);
    t.ok(nonExistentQuery <= epsilon * N_total_updates, `Query for non-existent item (${nonExistentQuery}) should be <= epsilon * N (${epsilon * N_total_updates})`);
    t.comment(`Query for non-existent item: ${nonExistentQuery}`);


    t.end();
});

test('CountMinSketch - Loop Unrolling Benefit (Conceptual Check)', (t) => {
    // This is hard to test in isolation without microbenchmarks,
    // but we ensure the code paths are hit.
    const sketchDepth5 = new CountMinSketch(1024, 5);
    const sketchDepth4 = new CountMinSketch(1024, 4);

    const key = "test_unrolling";

    t.doesNotThrow(() => {
        sketchDepth5.update(key, 1);
        sketchDepth5.query(key);
    }, "Operations on depth 5 sketch (unrolled path) should not throw");

    t.doesNotThrow(() => {
        sketchDepth4.update(key, 1);
        sketchDepth4.query(key);
    }, "Operations on depth 4 sketch (generic path) should not throw");

    t.end();
}); 