'use strict';

const assert = require('assert');

const DatabaseDispatcher = require('@janiscommerce/database-dispatcher');
const Log = require('@janiscommerce/log');

const sandbox = require('sinon').createSandbox();

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

/* eslint-disable prefer-arrow-callback */

describe('Model', () => {

	let DBDriver;

	const client = {
		type: 'mongodb',
		host: 'the-host',
		database: 'the-database-name',
		username: 'the-username',
		password: 'the-password',
		protocol: 'my-protocol',
		port: 1,
		myconfig: 'my-config'
	};

	class ClientModel extends Model {
	}

	class CoreModel extends Model {
		get databaseKey() { return 'core'; }
	}

	const myCoreModel = new CoreModel();

	let getPagedCallback;

	beforeEach(() => {

		// for internal cache clean...
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
			increment: sandbox.stub()
		};

		sandbox.stub(DatabaseDispatcher, 'getDatabaseByKey')
			.returns(DBDriver);

		sandbox.stub(DatabaseDispatcher, 'getDatabaseByClient')
			.returns(DBDriver);

		sandbox.stub(Log, 'add')
			.returns();

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

	describe('Database getters', () => {

		it('Should reject when model haven\'t a client injected or databaseKey getter', async () => {

			const myClientModel = new ClientModel();

			await assert.rejects(() => myClientModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.DATABASE_CONFIG_NOT_FOUND
			});
		});


		it('Should call DBDriver get using databaseKey when it exists', async () => {

			await myCoreModel.get();

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});
		});

		it('Should call DBDriver get using client config when it exists', async () => {

			const myClientModel = new ClientModel();

			myClientModel.session = {
				client: Promise.resolve(client)
			};

			await myClientModel.get();

			// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(0).args
			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByClient);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, false);

			// for debug use: DBDriver.get.getCall(0).args
			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, {});
		});

		it('Should call DBDriver get using read DB when readonly param is true', async () => {

			const myClientModel = new ClientModel();

			myClientModel.session = {
				client: Promise.resolve(client)
			};

			await myClientModel.get({ readonly: true });

			// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(0).args
			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByClient);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, true);

			// for debug use: DBDriver.get.getCall(0).args
			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, { readonly: true });
		});

		[
			'insert',
			'update',
			'save',
			'remove'

		].forEach(async method => {

			it(`should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

				const myClientModel = new ClientModel();

				myClientModel.session = {
					client: Promise.resolve(client)
				};

				await myClientModel.get({ readonly: true });

				// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByClient);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, true);

				await myClientModel[method]({ foo: 'bar' });

				// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(2).args
				sandbox.assert.calledTwice(DatabaseDispatcher.getDatabaseByClient);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, false);
			});
		});

		[
			'multiInsert',
			'multiSave',
			'multiRemove'

		].forEach(async method => {

			it(`should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

				const myClientModel = new ClientModel();

				myClientModel.session = {
					client: Promise.resolve(client)
				};

				await myClientModel.get({ readonly: true });

				// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByClient);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, true);

				await myClientModel[method]([{ foo: 'bar' }]);

				// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(2).args
				sandbox.assert.calledTwice(DatabaseDispatcher.getDatabaseByClient);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, false);
			});
		});
	});

	describe('distinct()', async () => {

		it('Should reject if DB Driver does not support the distinct method', async () => {
			await assert.rejects(() => myCoreModel.distinct('status'), {
				code: ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED
			});
		});

		it('Should reject if DB Driver rejects', async () => {

			DBDriver.distinct = sandbox.stub();
			DBDriver.distinct.rejects(new Error('Some internal error'));

			await assert.rejects(() => myCoreModel.distinct('status'), {
				message: 'Some internal error'
			});
		});

		it('Should resolve an array of distinct values if DB Driver resolves', async () => {

			DBDriver.distinct = sandbox.stub();
			DBDriver.distinct.resolves([
				'Value 1',
				'Value 2'
			]);

			const distinctValues = await myCoreModel.distinct('status');

			sandbox.assert.calledOnce(DBDriver.distinct);
			sandbox.assert.calledWithExactly(DBDriver.distinct, myCoreModel, {
				key: 'status'
			});

			assert.deepEqual(distinctValues, [
				'Value 1',
				'Value 2'
			]);
		});

		it('Should pass extra params to the DB Driver', async () => {

			DBDriver.distinct = sandbox.stub();
			DBDriver.distinct.resolves([]);

			await myCoreModel.distinct('status', {
				filters: {
					type: 'foo'
				}
			});

			sandbox.assert.calledOnce(DBDriver.distinct);
			sandbox.assert.calledWithExactly(DBDriver.distinct, myCoreModel, {
				filters: {
					type: 'foo'
				},
				key: 'status'
			});
		});
	});

	describe('getById() alias', () => {

		class MyModel extends Model {}

		beforeEach(() => {
			sandbox.stub(MyModel.prototype, 'get');
		});

		it('Should pass one ID filter as the only param if second argument is not passed', async () => {

			const model = new MyModel();
			await model.getById(1);

			sandbox.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					id: 1
				}
			});
		});

		it('Should pass multi ID filter as the only param if second argument is not passed', async () => {

			const model = new MyModel();
			await model.getById([1, 2]);

			sandbox.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					id: [1, 2]
				}
			});
		});

		it('Should merge the ID filter with the other params passed', async () => {

			const model = new MyModel();
			await model.getById(1, { limit: 10 });

			sandbox.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					id: 1
				},
				limit: 10
			});
		});

		it('Should merge the ID filter with the other params passed (including other filters)', async () => {

			const model = new MyModel();
			await model.getById(1, {
				filters: {
					status: 'active'
				},
				limit: 10
			});

			sandbox.assert.calledWithExactly(MyModel.prototype.get, {
				filters: {
					status: 'active',
					id: 1
				},
				limit: 10
			});
		});

		it('Should return the records array if passed ID is an array', async () => {

			MyModel.prototype.get.resolves([
				{ id: 1, name: 'First' },
				{ id: 2, name: 'Second' }
			]);

			const model = new MyModel();
			const result = await model.getById([1, 2]);

			assert.deepStrictEqual(result, [
				{ id: 1, name: 'First' },
				{ id: 2, name: 'Second' }
			]);
		});

		it('Should return an empty array if no records are found and passed ID is an array', async () => {

			MyModel.prototype.get.resolves([]);

			const model = new MyModel();
			const result = await model.getById([1, 2]);

			assert.deepStrictEqual(result, []);
		});

		it('Should return the first record if passed ID is not an array', async () => {

			MyModel.prototype.get.resolves([
				{ id: 1, name: 'First' }
			]);

			const model = new MyModel();
			const result = await model.getById(1);

			assert.deepStrictEqual(result, { id: 1, name: 'First' });
		});

		it('Should return null if no records are found and passed ID is not an array', async () => {

			MyModel.prototype.get.resolves([]);

			const model = new MyModel();
			const result = await model.getById(1);

			assert.deepStrictEqual(result, null);
		});

	});

	it('Should admit object result from model', async () => {

		DBDriver.get.returns({ foo: 456 });

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.get.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {
			fooParam: 1
		});

		assert.deepEqual(result, { foo: 456 });
	});

	it('Should return an empty array when driver returns an empty array', async () => {

		DBDriver.get
			.returns([]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		assert.deepEqual(result, []);
	});

	it('Should get normaly if no \'formatGet\' method exists', async () => {

		delete myCoreModel.formatGet;

		DBDriver.get
			.returns([{ fooItem: 88 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { fooParam: 1 });

		assert.deepEqual(result, [{ fooItem: 88 }]);
	});

	it('Should get normaly if no \'afterGet\' method exists', async () => {

		delete myCoreModel.afterGet;

		DBDriver.get
			.returns([{ fooItem: 7787 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { fooParam: 1 });

		assert.deepEqual(result, [{ fooItem: 7787 }]);
	});

	it('Should call DBDriver getTotals method passing the model', async () => {

		await myCoreModel.getTotals();

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.getTotals.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.getTotals);
		sandbox.assert.calledWithExactly(DBDriver.getTotals, myCoreModel);
	});

	['insert', 'save', 'remove'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the item received`, async () => {

			await myCoreModel[method]({ foo: 'bar' });

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			// for debug use: DBDriver[method].getCall(0).args
			sandbox.assert.calledOnce(DBDriver[method]);
			sandbox.assert.calledWithExactly(DBDriver[method], myCoreModel, { foo: 'bar' });
		});
	});

	it('Should call DBDriver update method passing the model and the values and filter received', async () => {

		await myCoreModel.update({ status: -1 }, { foo: 'bar' });

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.update.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.update);
		sandbox.assert.calledWithExactly(DBDriver.update, myCoreModel, { status: -1 }, { foo: 'bar' });
	});

	['multiInsert', 'multiSave'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the items received`, async () => {

			await myCoreModel[method]([{ foo: 'bar' }, { foo2: 'bar2' }]);

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			// for debug use: DBDriver[method].getCall(0).args
			sandbox.assert.calledOnce(DBDriver[method]);
			sandbox.assert.calledWithExactly(DBDriver[method], myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }]);
		});
	});

	it('Should call DBDriver multiRemove method passing the model and the filter received', async () => {

		await myCoreModel.multiRemove({ foo: 'bar' });

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.multiRemove.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.multiRemove);
		sandbox.assert.calledWithExactly(DBDriver.multiRemove, myCoreModel, { foo: 'bar' });
	});

	context('when param \'changeKeys\' received', () => {

		it('Should change keys if key found in items', async () => {

			DBDriver.get
				.returns([{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { changeKeys: 'id' });

			sandbox.assert.calledOnce(Model.changeKeys);
			sandbox.assert.calledWithExactly(Model.changeKeys, [{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }], 'id');

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

			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { changeKeys: 'id' });

			sandbox.assert.calledOnce(Model.changeKeys);
			sandbox.assert.calledWithExactly(Model.changeKeys, [{ foo: 'bar' }, { bar: 'foo' }], 'id');

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

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

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

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		sandbox.assert.calledOnce(myCoreModel.afterGet);
		sandbox.assert.calledWithExactly(myCoreModel.afterGet, [{ foo: 1 }, { bar: 2 }], {}, {}, []);

		assert.deepEqual(result, [{ foo: 1 }, { bar: 2 }]);
	});

	it('Should call controller \'afterGet\' with all items, params, indexes and ids', async () => {

		DBDriver.get
			.returns([{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);

		const result = await myCoreModel.get({ extraParam: true });

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { extraParam: true });

		sandbox.assert.calledOnce(myCoreModel.afterGet);
		sandbox.assert.calledWithExactly(myCoreModel.afterGet, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }], { extraParam: true }, { 33: 0, 78: 1 }, [33, 78]); // eslint-disable-line

		assert.deepEqual(result, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);
	});

	context('when call \'getPaged\' method', () => {

		it('Should reject if received an invalid callback', async () => {

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

		it('Shouldn\'t call the callback if get response empty results', async () => {

			sandbox.stub(myCoreModel, 'get')
				.returns([]);

			await myCoreModel.getPaged({}, getPagedCallback);

			sandbox.assert.calledOnce(myCoreModel.get);
			sandbox.assert.calledWithExactly(myCoreModel.get, {
				page: 1,
				limit: Model.defaultPageLimit
			});

			sandbox.assert.notCalled(getPagedCallback);
		});

		it('Should call the callback one time if get response an array of items, passing custom limit', async () => {

			sandbox.stub(myCoreModel, 'get')
				.onCall(0)
				.returns([{ foo: 1 }, { bar: 2 }])
				.onCall(1)
				.returns([{ foo: 5 }])
				.returns([]); // for the following calls

			await myCoreModel.getPaged({ limit: 2 }, getPagedCallback);

			sandbox.assert.calledTwice(myCoreModel.get);

			sandbox.assert.calledWithExactly(myCoreModel.get.getCall(0), {
				page: 1,
				limit: 2
			});

			sandbox.assert.calledWithExactly(myCoreModel.get.getCall(1), {
				page: 2,
				limit: 2
			});

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
					entity: 'client-model',
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

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client-model',
					userCreated,
					log: { some: 'data', userCreated }
				});
			});

			it('Shouldn\'t log the invalid entries when multiInsert method receives invalid items', async () => {

				DBDriver.multiInsert.returns();

				await myClientModel.multiInsert([{ some: 'data' }, null]);

				sandbox.assert.calledOnce(Log.add);
				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client-model',
					userCreated,
					log: { some: 'data', userCreated }
				});
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
					entity: 'client-model',
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
					entity: 'client-model',
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
					entity: 'client-model',
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
				});
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
					});
				});
			});

			it('Should log the save operation when session exists', async () => {

				DBDriver.save.returns('some-id');

				await myClientModel.save({ id: 'some-id', some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
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
					{ }
				);
			});

			it('Should log the save operation when session exists', async () => {

				DBDriver.increment.returns({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.increment({ id: 'some-id' }, { quantity: 1 });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'incremented',
					entity: 'client-model',
					entityId: 'some-id',
					userCreated,
					log: { _id: 'some-id', quantity: 2, userModified }
				});
			});

			it('Should reject if DB not support method', async () => {
				delete DBDriver.increment;

				await assert.rejects(myClientModel.increment({ id: 'some-id' }, { quantity: 1 }));
			});
		});

		describe('multiSave()', () => {

			it('Should add the userCreated field when session exists and the received item not have id', async () => {

				DBDriver.multiSave.returns();

				await myClientModel.multiSave([{ some: 'data' }, { other: 'data' }]);

				sandbox.assert.calledWithExactly(DBDriver.multiSave, myClientModel, [
					{ some: 'data', userCreated },
					{ other: 'data', userCreated }
				]);
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
					]);
				});
			});

			it('Should log the multiSave operation', async () => {

				DBDriver.multiSave.returns('some-id');

				await myClientModel.multiSave([{ id: 'some-id', some: 'data' }]);

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id', some: 'data', userModified }
				});
			});

			it('Shouldn\'t log the invalid entries when multiSave method receives invalid items', async () => {

				DBDriver.multiSave.returns();
				await myClientModel.multiSave([{ id: 'some-id' }, null]);

				sandbox.assert.calledOnce(Log.add);
				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id', userModified }
				});
			});
		});

		[
			'update',
			'remove',
			'multiSave',
			'multiInsert',
			'multiRemove'

		].forEach(method => {

			it(`Shouldn't log if ${method} does not receive items/filters`, async () => {

				DBDriver[method].returns();
				await myClientModel[method]();
				sandbox.assert.notCalled(Log.add);
			});
		});
	});

	it('Should exclude the fields from the log when excludeFieldsInLog static getter exists', async () => {

		const myClientModel = new ClientModel();

		myClientModel.session = {
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
			entity: 'client-model',
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
});
