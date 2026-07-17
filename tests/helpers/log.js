'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('lllog')('none');

const Log = require('@janiscommerce/log');

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

	describe('addByItem()', () => {

		const getLogHelperWithSession = () => new LogHelper({
			modelName: 'SomeModel',
			session: { clientCode: 'some-client', userId: 'some-user-id' }
		});

		const buildItemsWithId = (amount, extend = () => ({})) => [...Array(amount)]
			.map((value, index) => ({ id: `id-${index + 1}`, ...extend(index) }));

		beforeEach(() => {
			sinon.stub(Log, 'add').resolves();
			sinon.stub(Log, 'addCore').resolves();
		});

		it('Should group items with id (>1) into a single batched log with items and parallel relatedEntities tokens, without entityId', async () => {

			const logHelper = getLogHelperWithSession();

			await logHelper.addByItem('inserted', [
				{ id: 'id-1', letter: 'A' },
				{ id: 'id-2', letter: 'B' }
			], 15, false);

			sinon.assert.calledOnceWithExactly(Log.add, 'some-client', [{
				entity: 'some',
				type: 'inserted',
				userCreated: 'some-user-id',
				relatedEntities: ['some:id-1', 'some:id-2'],
				log: {
					executionTime: 15,
					batchToken: sinon.match.string,
					batchLength: 2,
					chunkData: {
						chunkLength: 2,
						chunkIndex: 1,
						totalParts: 1
					},
					items: [
						{ id: 'id-1', letter: 'A' },
						{ id: 'id-2', letter: 'B' }
					]
				}
			}]);
		});

		it('Should keep the legacy per-item shape when a batch resolves to a single item with id', async () => {

			const logHelper = getLogHelperWithSession();

			await logHelper.addByItem('upserted', [{ id: 'id-1', some: 'data' }], 8, false);

			sinon.assert.calledOnceWithExactly(Log.add, 'some-client', [{
				entity: 'some',
				type: 'upserted',
				userCreated: 'some-user-id',
				entityId: 'id-1',
				log: {
					executionTime: 8,
					batchToken: sinon.match.string,
					batchLength: 1,
					item: { id: 'id-1', some: 'data' }
				}
			}]);
		});

		it('Should split items with id into batched logs when the count limit (500) is exceeded', async () => {

			const logHelper = getLogHelperWithSession();

			await logHelper.addByItem('inserted', buildItemsWithId(700), 20, false);

			const [, builtLogs] = Log.add.firstCall.args;

			assert.strictEqual(builtLogs.length, 2);

			assert.deepStrictEqual(builtLogs[0].log.chunkData, { chunkLength: 500, chunkIndex: 1, totalParts: 2 });
			assert.deepStrictEqual(builtLogs[1].log.chunkData, { chunkLength: 200, chunkIndex: 2, totalParts: 2 });

			assert.strictEqual(builtLogs[0].relatedEntities.length, 500);
			assert.strictEqual(builtLogs[1].relatedEntities.length, 200);
			assert.strictEqual(builtLogs[0].log.items.length, 500);
			assert.strictEqual(builtLogs[1].log.items.length, 200);

			assert.strictEqual('entityId' in builtLogs[0], false);
			assert.strictEqual('entityId' in builtLogs[1], false);
		});

		it('Should split items with id into batched logs when the byte budget is exceeded, reflecting the parts in chunkData', async () => {

			const logHelper = getLogHelperWithSession();

			// ~200 KiB each: three fit under the ~700 KiB budget, the fourth forces a new chunk.
			const blob = 'a'.repeat(200 * 1024);

			await logHelper.addByItem('inserted', buildItemsWithId(6, () => ({ blob })), 30, false);

			const [, builtLogs] = Log.add.firstCall.args;

			assert.strictEqual(builtLogs.length, 2);

			assert.deepStrictEqual(builtLogs[0].log.chunkData, { chunkLength: 3, chunkIndex: 1, totalParts: 2 });
			assert.deepStrictEqual(builtLogs[1].log.chunkData, { chunkLength: 3, chunkIndex: 2, totalParts: 2 });

			assert.deepStrictEqual(builtLogs[0].relatedEntities, ['some:id-1', 'some:id-2', 'some:id-3']);
			assert.deepStrictEqual(builtLogs[1].relatedEntities, ['some:id-4', 'some:id-5', 'some:id-6']);
		});

		it('Should group items without id using the size-aware chunker (no relatedEntities, no entityId)', async () => {

			const logHelper = getLogHelperWithSession();

			await logHelper.addByItem('inserted', [{ some: 'data' }, { other: 'data' }], 12, false);

			sinon.assert.calledOnceWithExactly(Log.add, 'some-client', [{
				entity: 'some',
				type: 'inserted',
				userCreated: 'some-user-id',
				log: {
					executionTime: 12,
					batchToken: sinon.match.string,
					batchLength: 2,
					chunkData: {
						chunkLength: 2,
						chunkIndex: 1,
						totalParts: 1
					},
					items: [
						{ some: 'data' },
						{ other: 'data' }
					]
				}
			}]);
		});

		it('Should route the batched logs through Log.addCore when the model is core', async () => {

			const logHelper = getLogHelperWithSession();

			await logHelper.addByItem('inserted', [
				{ id: 'id-1', a: 1 },
				{ id: 'id-2', b: 2 }
			], 5, true);

			sinon.assert.notCalled(Log.add);
			sinon.assert.calledOnce(Log.addCore);

			const [builtLogs] = Log.addCore.firstCall.args;

			assert.strictEqual(builtLogs.length, 1);
			assert.deepStrictEqual(builtLogs[0].relatedEntities, ['some:id-1', 'some:id-2']);
		});
	});
});
