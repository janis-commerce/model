'use strict';

const assert = require('assert');
const sandbox = require('sinon').createSandbox();

const Log = require('@janiscommerce/log');
const Settings = require('@janiscommerce/settings');
const DatabaseDispatcher = require('../lib/helpers/database-dispatcher');

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

describe('Model', () => {

	let DBDriver;

	const client = {

		databases: {
			default: {
				write: {
					type: 'mongodb',
					host: 'the-host',
					database: 'the-database-name',
					username: 'the-username',
					password: 'the-password',
					protocol: 'my-protocol',
					port: 1
				}
			}
		}
	};

	const settings = {
		core: {
			write: {
				type: 'mongodb',
				host: 'the-host',
				database: 'the-database-name',
				username: 'the-username',
				password: 'the-password',
				protocol: 'my-protocol',
				port: 1
			}
		}
	};

	const fakeSession = {

		getSessionInstance: Constructor => {
			const instance = new Constructor();
			instance.session = fakeSession;
			return instance;
		},
		client: Promise.resolve(client)
	};

	class ClientModel extends Model {}

	class CoreModel extends Model {
		get databaseKey() { return 'core'; }
	}

	let getPagedCallback;

	let myCoreModel;

	beforeEach(() => {

		DBDriver = {
			get: sandbox.stub(),
			getTotals: sandbox.stub(),
			insert: sandbox.stub(),
			save: sandbox.stub(),
			update: sandbox.stub(),
			remove: sandbox.stub(),
			multiInsert: sandbox.stub(),
			multiSave: sandbox.stub(),
			multiRemove: sandbox.stub(),
			increment: sandbox.stub(),
			getIndexes: sandbox.stub(),
			createIndexes: sandbox.stub(),
			createIndex: sandbox.stub(),
			dropIndex: sandbox.stub(),
			dropIndexes: sandbox.stub()
		};

		sandbox.stub(Settings, 'get')
			.withArgs('database')
			.returns(settings);

		sandbox.stub(DatabaseDispatcher.prototype, 'getDatabaseByKey')
			.returns(DBDriver);

		sandbox.stub(Log, 'add')
			.resolves();

		myCoreModel = new CoreModel();

		myCoreModel.formatGet = () => { };

		sandbox.stub(myCoreModel, 'formatGet')
			.callsFake(({ ...item }) => item);

		myCoreModel.afterGet = () => { };

		sandbox.stub(myCoreModel, 'afterGet')
			.callsFake(([...newItems]) => newItems);

		sandbox.spy(Model, 'changeKeys');

		getPagedCallback = sandbox.stub();
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('Should return the statuses', async () => {

		assert.deepStrictEqual(ClientModel.statuses, {
			active: 'active',
			inactive: 'inactive'
		});

		assert.deepStrictEqual(CoreModel.statuses, {
			active: 'active',
			inactive: 'inactive'
		});
	});

	describe('distinct()', async () => {

		it('Should reject when DB Driver does not support the distinct method', async () => {
			await assert.rejects(() => myCoreModel.distinct('status'), {
				code: ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED
			});
		});

		it('Should reject when DB Driver rejects', async () => {

			DBDriver.distinct = sandbox.stub();
			DBDriver.distinct.rejects(new Error('Some internal error'));

			await assert.rejects(() => myCoreModel.distinct('status'), {
				message: 'Some internal error'
			});
		});

		it('Should resolve an array of distinct values when DB Driver resolves', async () => {

			DBDriver.distinct = sandbox.stub()
				.resolves(['Value 1', 'Value 2']);

			const distinctValues = await myCoreModel.distinct('status');

			sandbox.assert.calledOnceWithExactly(DBDriver.distinct, myCoreModel, {
				key: 'status'
			});

			assert.deepEqual(distinctValues, ['Value 1', 'Value 2']);
		});

		it('Should pass extra params to the DB Driver', async () => {

			DBDriver.distinct = sandbox.stub()
				.resolves([]);

			await myCoreModel.distinct('status', {
				filters: {
					type: 'foo'
				}
			});

			sandbox.assert.calledOnceWithExactly(DBDriver.distinct, myCoreModel, {
				filters: {
					type: 'foo'
				},
				key: 'status'
			});
		});
	});

	describe('getById()', () => {

		let model;

		beforeEach(() => {
			sandbox.stub(ClientModel.prototype, 'get');
			model = new ClientModel();
		});

		it('Should pass one ID filter as the only param when second argument is not passed', async () => {

			await model.getById(1);

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					id: 1
				}
			});
		});

		it('Should pass multi ID filter as the only param when second argument is not passed', async () => {

			await model.getById([1, 2]);

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					id: [1, 2]
				}
			});
		});

		it('Should merge the ID filter with the other params passed', async () => {

			await model.getById(1, { limit: 10 });

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					id: 1
				},
				limit: 10
			});
		});

		it('Should merge the ID filter with the other params passed (including other filters)', async () => {

			await model.getById(1, {
				filters: {
					status: 'active'
				},
				limit: 10
			});

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					status: 'active',
					id: 1
				},
				limit: 10
			});
		});

		it('Should return the records array when passed ID is an array', async () => {

			ClientModel.prototype.get.resolves([
				{ id: 1, name: 'First' },
				{ id: 2, name: 'Second' }
			]);

			const result = await model.getById([1, 2]);

			assert.deepStrictEqual(result, [
				{ id: 1, name: 'First' },
				{ id: 2, name: 'Second' }
			]);
		});

		it('Should return an empty array when no records are found and passed ID is an array', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getById([1, 2]);

			assert.deepStrictEqual(result, []);
		});

		it('Should return the first record when passed ID is not an array', async () => {

			ClientModel.prototype.get.resolves([
				{ id: 1, name: 'First' }
			]);

			const result = await model.getById(1);

			assert.deepStrictEqual(result, { id: 1, name: 'First' });
		});

		it('Should return null when no records are found and passed ID is not an array', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getById(1);

			assert.deepStrictEqual(result, null);
		});

	});

	describe('getBy()', () => {

		let model;

		beforeEach(() => {
			sandbox.stub(ClientModel.prototype, 'get');
			model = new ClientModel();
		});

		it('Should pass one orderId filter as the only param when third argument is not passed', async () => {

			await model.getBy('orderId', 1);

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					orderId: 1
				}
			});
		});

		it('Should pass multi orderIds filter as the only param when third argument is not passed', async () => {

			await model.getBy('orderId', [1, 2]);

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					orderId: [1, 2]
				}
			});
		});

		it('Should merge the orderId filter with the other params passed', async () => {

			await model.getBy('orderId', 1, { limit: 10 });

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					orderId: 1
				},
				limit: 10
			});
		});

		it('Should merge the orderId filter with the other params passed (including other filters)', async () => {

			await model.getBy('orderId', 1, {
				filters: {
					status: 'active'
				},
				limit: 10
			});

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: {
					status: 'active',
					orderId: 1
				},
				limit: 10
			});
		});

		it('Should pass the orderId filter for each condition in OR filters (array filters)', async () => {

			await model.getBy('orderId', 1, {
				filters: [
					{ status: 'active' },
					{ status: 'pending' }
				],
				limit: 10
			});

			sandbox.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: [
					{
						status: 'active',
						orderId: 1
					},
					{
						status: 'pending',
						orderId: 1
					}
				],
				limit: 10
			});
		});

		it('Should rejects when no value is passed', async () => {

			ClientModel.prototype.get.rejects([]);

			await assert.rejects(() => model.getBy('orderId'), {
				name: 'ModelError',
				message: 'The value must be defined',
				code: ModelError.codes.INVALID_VALUE
			});
		});

		it('Should return the records array when passed orderId is an array', async () => {

			ClientModel.prototype.get.resolves([
				{ id: 1, orderId: 1, name: 'First' },
				{ id: 2, orderId: 2, name: 'Second' }
			]);

			const result = await model.getBy('orderId', [1, 2]);

			assert.deepStrictEqual(result, [
				{ id: 1, orderId: 1, name: 'First' },
				{ id: 2, orderId: 2, name: 'Second' }
			]);
		});

		it('Should return an empty array when no records are found and passed orderId is an array', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy('orderId', [1, 2]);

			assert.deepStrictEqual(result, []);
		});

		it('Should return the records when passed orderId is not an array', async () => {

			ClientModel.prototype.get.resolves([
				{ id: 1, orderId: 1, name: 'First' }
			]);

			const result = await model.getBy('orderId', 1);

			assert.deepStrictEqual(result, [{ id: 1, orderId: 1, name: 'First' }]);
		});

		it('Should return the the first record when passed orderId and \'unique=true\' param', async () => {

			ClientModel.prototype.get.resolves([
				{ id: 1, orderId: 1, name: 'First' }
			]);

			const result = await model.getBy('orderId', 1, { unique: true });

			assert.deepStrictEqual(result, { id: 1, orderId: 1, name: 'First' });
		});

		it('Should return null when no records are found and passed orderId is not an array', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy('orderId', 1);

			assert.deepStrictEqual(result, []);
		});

		it('Should return null when passed a empty field value', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy();

			assert.deepStrictEqual(result, null);
		});

		it('Should return null when passed a empty string field value', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy('');

			assert.deepStrictEqual(result, null);
		});

		it('Should return null when passed a array field value', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy([1, 1]);

			assert.deepStrictEqual(result, null);
		});

		it('Should return null when passed a false field value', async () => {

			ClientModel.prototype.get.resolves([]);

			const result = await model.getBy(false);

			assert.deepStrictEqual(result, null);
		});

	});

	it('Should admit object result from model', async () => {

		DBDriver.get.returns({ foo: 456 });

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, {
			fooParam: 1
		});

		assert.deepEqual(result, { foo: 456 });
	});

	it('Should return an empty array when driver returns an empty array', async () => {

		DBDriver.get
			.returns([]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, {});

		assert.deepEqual(result, []);
	});

	it('Should get normaly when no \'formatGet\' method exists', async () => {

		delete myCoreModel.formatGet;

		DBDriver.get
			.returns([{ fooItem: 88 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { fooParam: 1 });

		assert.deepEqual(result, [{ fooItem: 88 }]);
	});

	it('Should get normaly when no \'afterGet\' method exists', async () => {

		delete myCoreModel.afterGet;

		DBDriver.get
			.returns([{ fooItem: 7787 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { fooParam: 1 });

		assert.deepEqual(result, [{ fooItem: 7787 }]);
	});

	it('Should call DBDriver getTotals method passing the model', async () => {

		await myCoreModel.getTotals();

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.getTotals, myCoreModel);
	});

	['insert', 'remove'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the item received`, async () => {

			await myCoreModel[method]({ foo: 'bar' });

			sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
			sandbox.assert.calledOnceWithExactly(DBDriver[method], myCoreModel, { foo: 'bar' });
		});
	});

	it('should call DBDriver save method passing the model and the item received', async () => {

		await myCoreModel.save({ foo: 'bar' });

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.save, myCoreModel, { foo: 'bar' }, undefined);
	});

	it('Should call DBDriver update method passing the model and the values and filter received', async () => {

		await myCoreModel.update({ status: -1 }, { foo: 'bar' });

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.update, myCoreModel, { status: -1 }, { foo: 'bar' });
	});

	it('should call DBDriver multiInsert method passing the model and the items received', async () => {

		await myCoreModel.multiInsert([{ foo: 'bar' }, { foo2: 'bar2' }]);

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.multiInsert, myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }]);
	});

	it('should call DBDriver multiSave method passing the model and the items received', async () => {

		await myCoreModel.multiSave([{ foo: 'bar' }, { foo2: 'bar2' }]);

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.multiSave, myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }], undefined);
	});

	it('Should call DBDriver multiRemove method passing the model and the filter received', async () => {

		await myCoreModel.multiRemove({ foo: 'bar' });

		sandbox.assert.calledOnceWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);
		sandbox.assert.calledOnceWithExactly(DBDriver.multiRemove, myCoreModel, { foo: 'bar' });
	});

	context('when param \'changeKeys\' received', () => {

		it('Should change keys when key found in items', async () => {

			DBDriver.get
				.returns([{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { changeKeys: 'id' });
			sandbox.assert.calledOnceWithExactly(Model.changeKeys, [{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }], 'id');

			assert.deepEqual(result, {
				1: { id: 1, foo: 'bar' },
				2: { id: 2, bar: 'foo' }
			});
		});

		it('Should ignore items that hasn\'t the key', async () => {

			DBDriver.get
				.returns([{ foo: 'bar' }, { bar: 'foo' }]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { changeKeys: 'id' });
			sandbox.assert.calledOnceWithExactly(Model.changeKeys, [{ foo: 'bar' }, { bar: 'foo' }], 'id');

			assert.deepEqual(result, {});
		});
	});

	it('Should call controller \'formatGet\' with each item', async () => {

		myCoreModel.formatGet
			.callsFake(({ ...item }) => {
				item.added = 123;
				return item;
			});

		DBDriver.get
			.returns([{ fooItem: 2 }, { anotherFooItem: 3 }]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, {});

		sandbox.assert.calledTwice(myCoreModel.formatGet);
		sandbox.assert.calledWithExactly(myCoreModel.formatGet.getCall(0), { fooItem: 2 });
		sandbox.assert.calledWithExactly(myCoreModel.formatGet.getCall(1), { anotherFooItem: 3 });

		assert.deepEqual(result, [
			{ fooItem: 2, added: 123 },
			{ anotherFooItem: 3, added: 123 }
		]);
	});

	it('Should call controller \'afterGet\' with all items', async () => {

		DBDriver.get
			.returns([{ foo: 1 }, { bar: 2 }]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, {});
		sandbox.assert.calledOnceWithExactly(myCoreModel.afterGet, [{ foo: 1 }, { bar: 2 }], {}, {}, []);

		assert.deepEqual(result, [{ foo: 1 }, { bar: 2 }]);
	});

	it('Should call controller \'afterGet\' with all items, params, indexes and ids', async () => {

		DBDriver.get
			.returns([{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);

		const result = await myCoreModel.get({ extraParam: true });

		sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { extraParam: true });
		sandbox.assert.calledOnceWithExactly(myCoreModel.afterGet, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }], { extraParam: true }, { 33: 0, 78: 1 }, [33, 78]); // eslint-disable-line max-len

		assert.deepEqual(result, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);
	});

	context('when call \'getPaged\' method', () => {

		it('Should reject when received an invalid callback', async () => {

			const wrongCallbackError = {
				name: 'ModelError',
				code: ModelError.codes.WRONG_CALLBACK
			};

			const badCallbacks = [
				1, 'foo', true, { foo: 'bar' }, ['foo', 'bar'], null, undefined
			];

			const promises = badCallbacks.map(badCallback => {
				return assert.rejects(() => myCoreModel.getPaged({}, badCallback), wrongCallbackError);
			});

			promises.push(assert.rejects(() => myCoreModel.getPaged(), wrongCallbackError));

			await Promise.all(promises);
		});

		it('Shouldn\'t call the callback when get response empty results', async () => {

			sandbox.stub(myCoreModel, 'get')
				.returns([]);

			await myCoreModel.getPaged({}, getPagedCallback);

			sandbox.assert.calledOnceWithExactly(myCoreModel.get, {
				page: 1,
				limit: Model.defaultPageLimit
			});

			sandbox.assert.notCalled(getPagedCallback);
		});

		it('Should call the callback one time when get response an array of items, passing custom limit', async () => {

			sandbox.stub(myCoreModel, 'get')
				.onCall(0)
				.returns([{ foo: 1 }, { bar: 2 }])
				.onCall(1)
				.returns([{ foo: 5 }])
				.returns([]); // for the following calls

			await myCoreModel.getPaged({ limit: 2 }, getPagedCallback);

			sandbox.assert.calledTwice(myCoreModel.get);
			sandbox.assert.calledWithExactly(myCoreModel.get.getCall(0), { page: 1, limit: 2 });
			sandbox.assert.calledWithExactly(myCoreModel.get.getCall(1), { page: 2, limit: 2 });

			sandbox.assert.calledTwice(getPagedCallback);
			sandbox.assert.calledWithExactly(getPagedCallback.getCall(0), [{ foo: 1 }, { bar: 2 }], 1, 2);
			sandbox.assert.calledWithExactly(getPagedCallback.getCall(1), [{ foo: 5 }], 2, 2);
		});
	});

	context('Write methods', () => {

		const myClientModel = new ClientModel();

		const userCreated = 'some-user-id';
		const userModified = userCreated;

		myClientModel.session = {
			...fakeSession,
			clientCode: 'some-client',
			userId: 'some-user-id'
		};

		afterEach(() => {
			delete ClientModel.excludeFieldsInLog;
		});

		describe('insert()', () => {

			it('Should add the userCreated field when session exists', async () => {

				DBDriver.insert.returns();

				await myClientModel.insert({ some: 'data' });

				sandbox.assert.calledWithExactly(DBDriver.insert, myClientModel, {
					some: 'data',
					userCreated: 'some-user-id'
				});
			});

			it('Should log the insert operation when session exists', async () => {

				DBDriver.insert.returns('some-id');

				await myClientModel.insert({ some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { some: 'data', userCreated }
				});
			});
		});

		describe('multiInsert()', () => {

			it('Should add the userCreated field when session exists', async () => {

				DBDriver.multiInsert.returns();

				await myClientModel.multiInsert([{ some: 'data' }, { other: 'data' }]);

				sandbox.assert.calledWithExactly(DBDriver.multiInsert, myClientModel, [
					{ some: 'data', userCreated },
					{ other: 'data', userCreated }
				]);
			});

			it('Should log the multiInsert operation when session exists', async () => {

				DBDriver.multiInsert.returns(true);

				await myClientModel.multiInsert([{ some: 'data' }]);

				sandbox.assert.calledWithExactly(Log.add, 'some-client', [
					{
						type: 'inserted',
						entity: 'client',
						userCreated,
						log: { some: 'data', userCreated }
					}
				]);
			});

			it('Shouldn\'t log the invalid entries when multiInsert method receives invalid items', async () => {

				DBDriver.multiInsert.returns();

				await myClientModel.multiInsert([{ some: 'data' }, null]);

				sandbox.assert.calledOnceWithExactly(Log.add, 'some-client', [
					{
						type: 'inserted',
						entity: 'client',
						userCreated,
						log: { some: 'data', userCreated }
					}]
				);
			});
		});

		describe('update()', () => {

			it('Should add the userModified field when session exists', async () => {

				DBDriver.update.returns();

				await myClientModel.update({ some: 'data' }, {});

				sandbox.assert.calledWithExactly(DBDriver.update, myClientModel, {
					some: 'data',
					userModified
				}, {});
			});

			it('Should log the update operation when session exists', async () => {

				DBDriver.update.returns(1);

				await myClientModel.update({ some: 'data' }, { id: 'some-id' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'updated',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						values: { some: 'data', userModified },
						filter: { id: 'some-id' }
					}
				});
			});
		});

		describe('remove()', () => {

			it('Should log the remove operation when session exists', async () => {

				DBDriver.remove.returns('some-id');

				await myClientModel.remove({ id: 'some-id', some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id', some: 'data' }
				});
			});
		});

		describe('multiRemove()', () => {

			it('Should log the multiRemove operation when session exists', async () => {

				DBDriver.multiRemove.returns('some-id');

				await myClientModel.multiRemove({ id: 'some-id' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id' }
				});
			});
		});

		describe('save', () => {

			it('Should add the userCreated field when session exists and the received item not have id', async () => {

				DBDriver.save.returns();

				await myClientModel.save({ some: 'data' });

				sandbox.assert.calledWithExactly(DBDriver.save, myClientModel, {
					some: 'data',
					userCreated
				}, undefined);
			});

			it('Should add the setOnInsert when it is passed', async () => {

				DBDriver.save.returns();

				await myClientModel.save({ some: 'data' }, { status: 'active' });

				sandbox.assert.calledWithExactly(DBDriver.save, myClientModel, {
					some: 'data',
					userCreated
				}, { status: 'active' });
			});

			[
				'id',
				'_id'

			].forEach(idField => {

				it(`Should add the userModified field when session exists and the received item have ${idField}`, async () => {

					DBDriver.save.returns();

					await myClientModel.save({ [idField]: 'some-id', some: 'data' });

					sandbox.assert.calledWithExactly(DBDriver.save, myClientModel, {
						[idField]: 'some-id',
						some: 'data',
						userModified
					}, undefined);
				});
			});

			it('Should log the save operation when session exists', async () => {

				DBDriver.save.returns('some-id');

				await myClientModel.save({ id: 'some-id', some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id', some: 'data', userModified }
				});
			});
		});

		describe('increment', () => {

			it('Should add the userModified field when session exists', async () => {

				DBDriver.increment.returns({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.increment({ id: 'some-id' }, { quantity: 1 });

				sandbox.assert.calledWithExactly(DBDriver.increment, myClientModel,
					{ id: 'some-id' },
					{ quantity: 1 },
					{ userModified }
				);
			});

			it('Should not add the userModified field when not session exists', async () => {

				DBDriver.increment.returns({ _id: 'some-id', quantity: 2, userModified });

				await myCoreModel.increment({ id: 'some-id' }, { quantity: 1 });

				sandbox.assert.calledWithExactly(DBDriver.increment, myCoreModel,
					{ id: 'some-id' },
					{ quantity: 1 },
					{}
				);
			});

			it('Should log the save operation when session exists', async () => {

				DBDriver.increment.returns({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.increment({ id: 'some-id' }, { quantity: 1 });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'incremented',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { _id: 'some-id', quantity: 2, userModified }
				});
			});

			it('Should reject when DB not support method', async () => {
				delete DBDriver.increment;

				await assert.rejects(myClientModel.increment({ id: 'some-id' }, { quantity: 1 }), {
					code: ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED
				});
			});
		});

		describe('multiSave()', () => {

			it('Should add the userCreated field when session exists and the received item not have id', async () => {

				DBDriver.multiSave.returns();

				await myClientModel.multiSave([{ some: 'data' }, { other: 'data' }]);

				sandbox.assert.calledWithExactly(DBDriver.multiSave, myClientModel, [
					{ some: 'data', userCreated },
					{ other: 'data', userCreated }
				], undefined);
			});

			it('Should add setOnInsert when it is passed', async () => {

				DBDriver.multiSave.returns();

				await myClientModel.multiSave([{ some: 'data' }, { other: 'data' }], { quantity: 100 });

				sandbox.assert.calledWithExactly(DBDriver.multiSave, myClientModel, [
					{ some: 'data', userCreated },
					{ other: 'data', userCreated }
				], { quantity: 100 });
			});

			[
				'id',
				'_id'

			].forEach(idField => {

				it(`Should add the userModified field when session exists and the received item have ${idField}`, async () => {

					DBDriver.multiSave.returns();

					await myClientModel.multiSave([{ [idField]: 'some-id', some: 'data' }, { [idField]: 'other-id', other: 'data' }]);

					sandbox.assert.calledWithExactly(DBDriver.multiSave, myClientModel, [
						{ [idField]: 'some-id', some: 'data', userModified },
						{ [idField]: 'other-id', other: 'data', userModified }
					], undefined);
				});
			});

			it('Should log the multiSave operation', async () => {

				DBDriver.multiSave.returns('some-id');

				await myClientModel.multiSave([{ id: 'some-id', some: 'data' }]);

				sandbox.assert.calledWithExactly(Log.add, 'some-client', [
					{
						type: 'upserted',
						entity: 'client',
						entityId: 'some-id',
						userCreated,
						log: { id: 'some-id', some: 'data', userModified }
					}
				]);
			});

			it('Shouldn\'t log the invalid entries when multiSave method receives invalid items', async () => {

				DBDriver.multiSave.returns();
				await myClientModel.multiSave([{ id: 'some-id' }, null]);

				sandbox.assert.calledOnceWithExactly(Log.add, 'some-client', [
					{
						type: 'upserted',
						entity: 'client',
						entityId: 'some-id',
						userCreated,
						log: { id: 'some-id', userModified }
					}
				]);
			});
		});

		[
			'update',
			'remove',
			'multiSave',
			'multiInsert',
			'multiRemove'

		].forEach(method => {

			it(`Shouldn't log when ${method} does not receive items/filters`, async () => {

				DBDriver[method].returns();
				await myClientModel[method]();
				sandbox.assert.notCalled(Log.add);
			});
		});
	});

	it('Should exclude the fields from the log when excludeFieldsInLog static getter exists', async () => {

		const myClientModel = new ClientModel();

		myClientModel.session = {
			...fakeSession,
			clientCode: 'some-client',
			userId: 'some-user-id'
		};

		ClientModel.excludeFieldsInLog = [
			'password', 'address'
		];

		DBDriver.insert.returns('some-id');

		await myClientModel.insert({
			username: 'some-username',
			password: 'some-password',
			location: {
				country: 'some-country',
				address: 'some-address'
			}
		});

		sandbox.assert.calledWithExactly(Log.add, 'some-client', {
			type: 'inserted',
			entity: 'client',
			entityId: 'some-id',
			userCreated: 'some-user-id',
			log: {
				username: 'some-username',
				location: {
					country: 'some-country'
				},
				userCreated: 'some-user-id'
			}
		});
	});

	it('Should not log when the static getter shouldCreateLogs is set to false', async () => {

		const myClientModel = new ClientModel();

		myClientModel.session = {
			...fakeSession,
			clientCode: 'some-client',
			userId: 'some-user-id'
		};

		sandbox.stub(ClientModel, 'shouldCreateLogs')
			.get(() => false);

		DBDriver.insert.returns('some-id');

		await myClientModel.insert({
			username: 'some-username',
			password: 'some-password',
			location: {
				country: 'some-country',
				address: 'some-address'
			}
		});

		sandbox.assert.notCalled(Log.add);
	});

	describe('Indexes Methods', () => {

		[
			['getIndexes'],
			['createIndexes', [{ name: 'name', key: { name: 1 }, unique: true }, { name: 'code', key: { code: 1 }, unique: true }]],
			['createIndex', { name: 'name', key: { name: 1 }, unique: true }],
			['dropIndex', 'name'],
			['dropIndexes', ['name', 'code']]
		].forEach(([method, ...args]) => {

			it(`Should call DBDriver ${method} method passing the model`, async () => {

				await myCoreModel[method](...args);

				sandbox.assert.calledOnce(DatabaseDispatcher.prototype.getDatabaseByKey);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.prototype.getDatabaseByKey, 'core', false);

				sandbox.assert.calledOnceWithExactly(DBDriver[method], myCoreModel, ...args);
			});

			it('Should reject when DB not support method', async () => {
				delete DBDriver[method];

				await assert.rejects(myCoreModel[method](...args), {
					code: ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED
				});
			});
		});
	});

	describe('Map ID By References IDs', () => {

		it('Should reject when Reference Ids is not an Array', async () => {
			await assert.rejects(myCoreModel.mapIdByReferenceId(), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId('refId'), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId({ refId: 'refId' }), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId(1000), { code: ModelError.codes.INVALID_VALUE });
		});

		it('Should return empty object when ReferenceId is an empty Array', async () => {

			DBDriver.get.returns([]);

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId([]), {});

			sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { filters: { referenceId: [] } });
		});

		it('Should return object with referenceId key and Id value', async () => {

			DBDriver.get.returns([{ id: 'some-id', referenceId: 'some-ref-id' }, { id: 'other-id', referenceId: 'other-ref-id' }]);

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId(['some-ref-id', 'other-ref-id']), {
				'some-ref-id': 'some-id',
				'other-ref-id': 'other-id'
			});

			sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { filters: { referenceId: ['some-ref-id', 'other-ref-id'] } });
		});

		it('Should return object with referenceId key and Id value when referenceId match', async () => {

			DBDriver.get.returns([{ id: 'some-id', referenceId: 'some-ref-id' }]);

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId(['some-ref-id', 'foo-ref-id']), {
				'some-ref-id': 'some-id'
			});

			sandbox.assert.calledOnceWithExactly(DBDriver.get, myCoreModel, { filters: { referenceId: ['some-ref-id', 'foo-ref-id'] } });
		});
	});
});
