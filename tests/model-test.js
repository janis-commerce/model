'use strict';

const assert = require('assert');

const DatabaseDispatcher = require('@janiscommerce/database-dispatcher');
const Settings = require('@janiscommerce/settings');

const sandbox = require('sinon').createSandbox();

const Model = require('../.');
const ModelError = require('../lib/model-error');
const ClientFields = require('../lib/client-fields');

/* eslint-disable prefer-arrow-callback */

describe('Model', () => {

	const DBDriver = {};

	const client = {
		type: 'mongodb',
		host: 'the-host',
		database: 'the-database-name',
		username: 'the-username',
		password: 'the-password',
		port: 1,
		dbWriteHost: 'my-host.com',
		dbWriteDatabase: 'foo',
		dbReadHost: 'my-read-host.com',
		dbReadDatabase: 'foo',
		dbReadUser: 'my-username',
		dbReadPassword: 'ultrsecurepassword123456'
	};

	const clientModel = class ClientModel extends Model {};

	class CoreModel extends Model {
		get databaseKey() { return 'core'; }
	}

	const myCoreModel = new CoreModel();

	let getPagedCallback;

	beforeEach(() => {

		// for internal cache clean...
		ClientFields._fields = undefined; // eslint-disable-line

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

		sandbox.stub(DatabaseDispatcher, 'getDatabaseByConfig')
			.returns(DBDriver);

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

		it('should reject when model haven\'t a client injected or databaseKey getter', async function() {

			const myClientModel = new clientModel(); // eslint-disable-line

			await assert.rejects(() => myClientModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.DATABASE_CONFIG_NOT_FOUND
			});
		});

		context('when client fields settings not found', function() {

			it('should call DBDriver get using databaseKey if exists', async function() {

				await myCoreModel.get();

				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

				sandbox.assert.calledOnce(DBDriver.get);
				sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});
			});

			it('should call DBDriver get using client config default', async function() {

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get();

				// for debug use: DatabaseDispatcher.getDatabaseByConfig.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig, {
					type: undefined,
					host: 'my-host.com',
					database: 'foo',
					user: undefined,
					password: undefined,
					port: undefined
				});

				// for debug use: DBDriver.get.getCall(0).args
				sandbox.assert.calledOnce(DBDriver.get);
				sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, {});
			});
		});

		context('when client fields settings found but has bad format', function() {

			it('should use default fields for client on read DB', async function() {

				sandbox.stub(Settings, 'get')
					.returns(['bad', 'format']);

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get({ readonly: true, filters: { foo: 'bar' } });

				// for debug use: DatabaseDispatcher.getDatabaseByConfig.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig, {
					type: undefined,
					host: 'my-read-host.com',
					database: 'foo',
					user: 'my-username',
					password: 'ultrsecurepassword123456',
					port: undefined
				});

				// for debug use: DBDriver.get.getCall(0).args
				sandbox.assert.calledOnce(DBDriver.get);
				sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, { readonly: true, filters: { foo: 'bar' } });

				// for debug use: Settings.get.getCall(0).args
				sandbox.assert.calledOnce(Settings.get);
				sandbox.assert.calledWithExactly(Settings.get, 'clients');
			});

			it('should use internal cache for default fields for client', async function() {

				sandbox.stub(Settings, 'get')
					.returns(['bad', 'format']);

				sandbox.spy(ClientFields, 'get');

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get({ readonly: true, filters: { foo: 'bar' } });
				await myClientModel.get({ readonly: true });
				await myClientModel.get({ filters: { foo: 'bar' } });
				await myClientModel.get();

				sandbox.assert.calledOnce(ClientFields.get);
				sandbox.assert.calledWithExactly(ClientFields.get); // called with undefined!

				// for debug use: Settings.get.getCall(0).args
				sandbox.assert.calledOnce(Settings.get);
				sandbox.assert.calledWithExactly(Settings.get, 'clients');
			});
		});

		context('when client fields settings found', function() {

			it('should use client db config data for write DB', async function() {

				sandbox.stub(Settings, 'get')
					.returns({
						fields: {
							write: {
								type: 'type',
								host: 'host',
								database: 'database',
								user: 'username',
								password: 'password',
								port: 'port'
							}
						}
					});

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get();

				// for debug use: DatabaseDispatcher.getDatabaseByConfig.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig, {
					type: 'mongodb',
					host: 'the-host',
					database: 'the-database-name',
					user: 'the-username',
					password: 'the-password',
					port: 1
				});

				// for debug use: DBDriver.get.getCall(0).args
				sandbox.assert.calledOnce(DBDriver.get);
				sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, {});

				// for debug use: Settings.get.getCall(0).args
				sandbox.assert.calledOnce(Settings.get);
				sandbox.assert.calledWithExactly(Settings.get, 'clients');
			});

			it('should use client db config data for read DB', async function() {

				sandbox.stub(Settings, 'get')
					.returns({
						fields: {
							read: {
								type: 'type',
								host: 'host',
								database: 'database',
								user: 'username',
								password: 'password',
								port: 'port'
							}
						}
					});

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get({ readonly: true });

				// for debug use: DatabaseDispatcher.getDatabaseByConfig.getCall(0).args
				sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig, {
					type: 'mongodb',
					host: 'the-host',
					database: 'the-database-name',
					user: 'the-username',
					password: 'the-password',
					port: 1
				});

				// for debug use: DBDriver.get.getCall(0).args
				sandbox.assert.calledOnce(DBDriver.get);
				sandbox.assert.calledWithExactly(DBDriver.get, myClientModel, { readonly: true });

				// for debug use: Settings.get.getCall(0).args
				sandbox.assert.calledOnce(Settings.get);
				sandbox.assert.calledWithExactly(Settings.get, 'clients');
			});

			it('should use internal cache for settings fields for client', async function() {

				sandbox.stub(Settings, 'get')
					.returns({
						fields: {
							write: {
								host: 'host',
								database: 'database',
								user: 'username',
								password: 'password',
								port: 'port'
							}
						}
					});

				const myClientModel = new clientModel(); // eslint-disable-line

				myClientModel.client = client;

				await myClientModel.get({ readonly: true, filters: { foo: 'bar' } });
				await myClientModel.get({ readonly: true });
				await myClientModel.get({ filters: { foo: 'bar' } });
				await myClientModel.get();

				const readConfig = {
					type: undefined,
					host: 'my-read-host.com',
					database: 'foo',
					user: 'my-username',
					password: 'ultrsecurepassword123456',
					port: undefined
				};

				const writeConfig = {
					type: undefined,
					host: 'the-host',
					database: 'the-database-name',
					user: 'the-username',
					password: 'the-password',
					port: 1
				};

				// for debug use: DatabaseDispatcher.getDatabaseByConfig.getCall(0).args
				sandbox.assert.callCount(DatabaseDispatcher.getDatabaseByConfig, 4);

				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig.getCall(0), readConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig.getCall(1), readConfig);

				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig.getCall(2), writeConfig);
				sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByConfig.getCall(3), writeConfig);

				// for debug use: Settings.get.getCall(0).args
				sandbox.assert.calledOnce(Settings.get);
				sandbox.assert.calledWithExactly(Settings.get, 'clients');
			});
		});
	});

	it('should admit object result from model', async function() {

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

	it('should return an empty array when driver returns an empty array', async function() {

		DBDriver.get
			.returns([]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		assert.deepEqual(result, []);
	});

	it('should get normaly if no \'formatGet\' method exists', async function() {

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

	it('should get normaly if no \'afterGet\' method exists', async function() {

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

	it('should call DBDriver getTotals method passing the model', async function() {

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

	it('should call DBDriver update method passing the model and the values and filter received', async function() {

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

	it('should call DBDriver multiRemove method passing the model and the filter received', async function() {

		await myCoreModel.multiRemove({ foo: 'bar' });

		sandbox.assert.calledOnce(DatabaseDispatcher.getDatabaseByKey);
		sandbox.assert.calledWithExactly(DatabaseDispatcher.getDatabaseByKey, 'core');

		// for debug use: DBDriver.multiRemove.getCall(0).args
		sandbox.assert.calledOnce(DBDriver.multiRemove);
		sandbox.assert.calledWithExactly(DBDriver.multiRemove, myCoreModel, { foo: 'bar' });
	});

	it('should cache ClientFields when request from different models', async function() {

		sandbox.stub(Settings, 'get');

		const myClientModel = new clientModel(); // eslint-disable-line

		myClientModel.client = client;

		await myClientModel.get();

		const otherClientModel = new clientModel(); // eslint-disable-line

		otherClientModel.client = client;

		await otherClientModel.get();

		// for debug use: Settings.get.getCall(0).args
		sandbox.assert.calledOnce(Settings.get);
		sandbox.assert.calledWithExactly(Settings.get, 'clients');
	});

	context('when param \'changeKeys\' received', function() {

		it('should change keys if key found in items', async function() {

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

		it('should ignore items that hasn\'t the key', async function() {

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

	it('should call controller \'formatGet\' with each item', async function() {

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

	it('should call controller \'afterGet\' with all items', async function() {

		DBDriver.get
			.returns([{ foo: 1 }, { bar: 2 }]);

		const result = await myCoreModel.get();

		sandbox.assert.calledOnce(DBDriver.get);
		sandbox.assert.calledWithExactly(DBDriver.get, myCoreModel, {});

		sandbox.assert.calledOnce(myCoreModel.afterGet);
		sandbox.assert.calledWithExactly(myCoreModel.afterGet, [{ foo: 1 }, { bar: 2 }], {}, {}, []);

		assert.deepEqual(result, [{ foo: 1 }, { bar: 2 }]);
	});

	it('should call controller \'afterGet\' with all items, params, indexes and ids', async function() {

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

		it('should reject if received an invalid callback', async function() {

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

		it('shouldn\'t call the callback if get response empty results', async function() {

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

		it('should call the callback one time if get response an array of items, passing custom limit', async function() {

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
});
