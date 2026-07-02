'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('lllog')('none');

const LogHelper = require('../../lib/helpers/log');

describe('LogHelper', () => {

	afterEach(() => {
		sinon.restore();
	});

	const getLogHelper = () => new LogHelper({ modelName: 'SomeModel' });

	describe('setLogData()', () => {

		it('Should store the string as the log message', () => {

			const logHelper = getLogHelper();

			logHelper.setLogData('custom message');

			assert.deepStrictEqual(logHelper.customLogData, { message: 'custom message' });
		});

		it('Should store the object as the custom log data', () => {

			const logHelper = getLogHelper();

			logHelper.setLogData({ type: 'some type', log: { isTest: true } });

			assert.deepStrictEqual(logHelper.customLogData, { type: 'some type', log: { isTest: true } });
		});

		it('Should return the same instance to allow chaining', () => {

			const logHelper = getLogHelper();

			assert.strictEqual(logHelper.setLogData('custom message'), logHelper);
		});

		it('Should throw with the Model prefix when the data is neither a string nor an object', () => {

			const logHelper = getLogHelper();

			assert.throws(() => logHelper.setLogData(['invalid data']), {
				message: 'Model - Custom log data: the custom data to log must be string or an object'
			});
		});

		it('Should throw with the Model prefix when the custom log property is not an object', () => {

			const logHelper = getLogHelper();

			assert.throws(() => logHelper.setLogData({ log: 'invalid-log' }), {
				message: 'Model - Custom log data: the property name log in custom log data must be an object'
			});
		});
	});
});
