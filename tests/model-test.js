'use strict';

const assert = require('assert');

const DatabaseDispatcher = require('@janiscommerce/database-dispatcher');
const Log = require('@janiscommerce/log');

const sandbox = require('sinon').createSandbox();

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

/* eslint-disable prefer-arrow-callback */

describe('Model', () => {

	const DBDriver = {};

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
		DBDriver.get = sandbox.stub();
		DBDriver.getTotals = sandbox.stub();
		DBDriver.insert = sandbox.stub();
		DBDriver.save = sandbox.stub();
		DBDriver.update = sandbox.stub();
		DBDriver.remove = sandbox.stub();
		DBDriver.multiInsert = sandbox.stub();
		DBDriver.multiSave = sandbox.stub();
		DBDriver.multiRemove = sandbox.stub();

		sandbox.stub(DatabaseDispatcher, 'getDatabaseByKey')
			.returns(DBDriver);

		sandbox.stub(DatabaseDispatcher, 'getDatabaseByClient')
			.returns(DBDriver);

		sandbox.stub(Log, 'add')
			.returns();

		myCoreModel.formatGet = () => {};

		sandbox.stub(myCoreModel, 'formatGet')
			.callsFake(({ ...item }) => item);

		myCoreModel.afterGet = () => {};

		sandbox.stub(myCoreModel, 'afterGet')
			.callsFake(([...newItems]) => newItems);

		sandbox.spy(Model, 'changeKeys');

		getPagedCallback = sandbox.stub();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('Database getters', function() {

		it('Should reject when model haven\'t a client injected or databaseKey getter', async function() {

			const myClientModel = new ClientModel();

			await assert.rejects(() => myClientModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.DATABASE_CONFIG_NOT_FOUND
			});
		});


		it('Should call DBDriver get using databaseKey when it exists', async function() {

			await myCoreModel.get();

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			sandbox.assert.calledOnce(DBDriver.get);
			sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});
		});

		it('Should call DBDriver get using client config when it exists', async function() {

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

		it('Should call DBDriver get using read DB when readonly param is true', async function() {

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
			'multiInsert',
			'update',
			'save',
			'multiSave',
			'remove',
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

				await myClientModel[method]({ foo: 'bar' });

				// for debug use: DatabaseDispatcher.getDatabaseByClient.getCall(2).args
				sandbox.assert.calledTwice(DatabaseDispatcher.getDatabaseByClient);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByClient, client, false);
			});
		});
	});

	it('Should admit object result from model', async function() {

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

	it('Should return an empty array when driver returns an empty array', async function() {

		DBDriver.get
			.returns([]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		assert.deepEqual(result, []);
	});

	it('Should get normaly if no \'formatGet\' method exists', async function() {

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

	it('Should get normaly if no \'afterGet\' method exists', async function() {

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

	it('Should call DBDriver getTotals method passing the model', async function() {

		await myCoreModel.getTotals();

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.getTotals.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.getTotals);
		sandbox.assert.calledWithExactly(DBDriver.getTotals, myCoreModel);
	});

	['insert', 'save', 'remove'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the item received`, async function() {

			await myCoreModel[method]({ foo: 'bar' });

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			// for debug use: DBDriver[method].getCall(0).args
			sandbox.assert.calledOnce(DBDriver[method]);
			sandbox.assert.calledWithExactly(DBDriver[method], myCoreModel, { foo: 'bar' });
		});
	});

	it('Should call DBDriver update method passing the model and the values and filter received', async function() {

		await myCoreModel.update({ status: -1 }, { foo: 'bar' });

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.update.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.update);
		sandbox.assert.calledWithExactly(DBDriver.update, myCoreModel, { status: -1 }, { foo: 'bar' });
	});

	['multiInsert', 'multiSave'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the items received`, async function() {

			await myCoreModel[method]([{ foo: 'bar' }, { foo2: 'bar2' }]);

			sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
			sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

			// for debug use: DBDriver[method].getCall(0).args
			sandbox.assert.calledOnce(DBDriver[method]);
			sandbox.assert.calledWithExactly(DBDriver[method], myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }]);
		});
	});

	it('Should call DBDriver multiRemove method passing the model and the filter received', async function() {

		await myCoreModel.multiRemove({ foo: 'bar' });

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.multiRemove.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.multiRemove);
		sandbox.assert.calledWithExactly(DBDriver.multiRemove, myCoreModel, { foo: 'bar' });
	});

	context('when param \'changeKeys\' received', function() {

		it('Should change keys if key found in items', async function() {

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

		it('Should ignore items that hasn\'t the key', async function() {

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

	it('Should call controller \'formatGet\' with each item', async function() {

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

	it('Should call controller \'afterGet\' with all items', async function() {

		DBDriver.get
			.returns([{ foo: 1 }, { bar: 2 }]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		sandbox.assert.calledOnce(myCoreModel.afterGet);
		sandbox.assert.calledWithExactly(myCoreModel.afterGet, [{ foo: 1 }, { bar: 2 }], {}, {}, []);

		assert.deepEqual(result, [{ foo: 1 }, { bar: 2 }]);
	});

	it('Should call controller \'afterGet\' with all items, params, indexes and ids', async function() {

		DBDriver.get
			.returns([{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);

		const result = await myCoreModel.get({ extraParam: true });

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, { extraParam: true });

		sandbox.assert.calledOnce(myCoreModel.afterGet);
		sandbox.assert.calledWithExactly(myCoreModel.afterGet, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }], { extraParam: true }, { 33: 0, 78: 1 }, [33, 78]); // eslint-disable-line

		assert.deepEqual(result, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);
	});

	context('when call \'getPaged\' method', function() {

		it('Should reject if received an invalid callback', async function() {

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

		it('Shouldn\'t call the callback if get response empty results', async function() {

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

		it('Should call the callback one time if get response an array of items, passing custom limit', async function() {

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

		context('when call write methods', () => {

			const myClientModel = new ClientModel();

			myClientModel.session = {
				clientCode: 'some-client'
			};

			it('Should log the insert operation', async () => {

				DBDriver.insert.returns('some-id');

				await myClientModel.insert({ some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Inserted document',
					log: { some: 'data' }
				});
			});

			it('Should log the multiInsert operation', async () => {

				DBDriver.multiInsert.returns(true);

				await myClientModel.multiInsert([{ some: 'data' }]);

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client-model',
					message: 'Inserted document',
					log: { some: 'data' }
				});
			});

			it('Should log the update operation', async () => {

				DBDriver.update.returns(1);

				await myClientModel.update({ some: 'data' }, { id: 'some-id' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'updated',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Updated documents',
					log: {
						values: { some: 'data' },
						filter: { id: 'some-id' }
					}
				});
			});

			it('Should log the remove operation', async () => {

				DBDriver.remove.returns('some-id');

				await myClientModel.remove({ id: 'some-id', some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Removed document',
					log: { id: 'some-id', some: 'data' }
				});
			});

			it('Should log the multiRemove operation', async () => {

				DBDriver.multiRemove.returns('some-id');

				await myClientModel.multiRemove({ id: 'some-id' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Removed documents',
					log: { id: 'some-id' }
				});
			});

			it('Should log the save operation', async () => {

				DBDriver.save.returns('some-id');

				await myClientModel.save({ id: 'some-id', some: 'data' });

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Upserted document',
					log: { id: 'some-id', some: 'data' }
				});
			});

			it('Should log the multiSave operation', async () => {

				DBDriver.multiSave.returns('some-id');

				await myClientModel.multiSave([{ id: 'some-id', some: 'data' }]);

				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Upserted document',
					log: { id: 'some-id', some: 'data' }
				});
			});

			it('Shouldn\'t log the invalid entries if multiSave method receives invalid items', async () => {

				DBDriver.multiSave.returns();
				await myClientModel.multiSave([{ id: 'some-id' }, null]);

				sandbox.assert.calledOnce(Log.add);
				sandbox.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client-model',
					entityId: 'some-id',
					message: 'Upserted document',
					log: { id: 'some-id' }
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
				clientCode: 'some-client'
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
				message: 'Inserted document',
				log: {
					username: 'some-username',
					location: {
						country: 'some-country'
					}
				}
			});
		});
	});
});
