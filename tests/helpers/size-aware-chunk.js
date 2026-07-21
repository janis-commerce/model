'use strict';

const assert = require('assert');

const sizeAwareChunk = require('../../lib/helpers/size-aware-chunk');

describe('sizeAwareChunk()', () => {

	it('Should return no chunks for an empty array', () => {
		assert.deepStrictEqual(sizeAwareChunk([], 500, 1000), []);
	});

	it('Should keep every item in a single chunk when neither limit is reached', () => {

		const items = [{ a: 1 }, { b: 2 }, { c: 3 }];

		assert.deepStrictEqual(sizeAwareChunk(items, 500, 100000), [items]);
	});

	it('Should cut by count when the max item count is reached', () => {

		const items = [...Array(5)].map((value, index) => ({ index }));

		const chunks = sizeAwareChunk(items, 2, 100000);

		assert.deepStrictEqual(chunks.map(chunk => chunk.length), [2, 2, 1]);
	});

	it('Should cut by bytes when the serialized budget would be exceeded before the count limit', () => {

		// Each item serializes to ~102 bytes, so only two fit under the 250-byte budget.
		const items = [...Array(5)].map(() => ({ value: 'a'.repeat(90) }));

		const chunks = sizeAwareChunk(items, 500, 250);

		assert.deepStrictEqual(chunks.map(chunk => chunk.length), [2, 2, 1]);
	});

	it('Should place a single item larger than the byte budget alone in its own chunk', () => {

		const small = { a: 1 };
		const huge = { blob: 'a'.repeat(300) };

		assert.deepStrictEqual(sizeAwareChunk([huge], 500, 250), [[huge]]);

		const chunks = sizeAwareChunk([small, huge, small], 500, 250);

		assert.deepStrictEqual(chunks.map(chunk => chunk.length), [1, 1, 1]);
	});
});
