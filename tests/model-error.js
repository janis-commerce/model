'use strict';

const assert = require('assert');

const ModelError = require('../lib/model-error');

describe('Api Session Error', () => {

	it('Should accept a message error and a code', () => {
		const error = new ModelError('Some error', ModelError.codes.DATABASE_CONFIG_NOT_FOUND);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, ModelError.codes.DATABASE_CONFIG_NOT_FOUND);
		assert.strictEqual(error.name, 'ModelError');
	});

	it('Should accept an error instance and a code', () => {

		const previousError = new Error('Some error');

		const error = new ModelError(previousError, ModelError.codes.DATABASE_CONFIG_NOT_FOUND);

		assert.strictEqual(error.message, 'Some error');
		assert.strictEqual(error.code, ModelError.codes.DATABASE_CONFIG_NOT_FOUND);
		assert.strictEqual(error.name, 'ModelError');
		assert.strictEqual(error.previousError, previousError);
	});
});
