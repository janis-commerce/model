'use strict';

const assert = require('assert');
const mockRequire = require('mock-require');
const sinon = require('sinon');

const Log = require('@janiscommerce/log');

const Settings = require('@janiscommerce/settings');

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

const DBDriver = require('./db-driver');

describe('Model', () => {

	const client = {
		databases: {
			default: {
				write: {
					skipFetchCredentials: true,
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
				skipFetchCredentials: true,
				type: 'mongodb',
				host: 'the-host',
				database: 'the-database-name',
				username: 'the-username',
				password: 'the-password',
				protocol: 'my-protocol',
				port: 1
			}
		},
		other: {
			write: {
				skipFetchCredentials: true,
				type: 'other'
			},
			admin: {
				skipFetchCredentials: true,
				type: 'mongodb'
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

		formatGet({ ...item }) { return item; }

		afterGet([...newItems]) { return newItems; }
	}

	class OtherModel extends Model {
		get databaseKey() { return 'other'; }
	}

	let getPagedCallback;

	let myCoreModel;

	let otherModel;

	beforeEach(() => {

		sinon.stub(Settings, 'get')
			.withArgs('database')
			.returns(settings);

		mockRequire('@janiscommerce/mongodb', DBDriver);

		mockRequire('@janiscommerce/other', class OtherDBDriver {});

		sinon.stub(Log, 'add')
			.resolves();

		myCoreModel = new CoreModel();

		otherModel = new OtherModel();

		sinon.spy(Model, 'changeKeys');

		getPagedCallback = sinon.stub();

		sinon.stub(AwsSecretsManager, 'secret')
			.returns({
				getValue() {}
			});
	});

	afterEach(() => {
		sinon.restore();
		mockRequire.stopAll();
	});

	it('Should return the default statuses', async () => {

		const statuses = {
			active: 'active',
			inactive: 'inactive'
		};

		assert.deepStrictEqual(ClientModel.statuses, statuses);
		assert.deepStrictEqual(CoreModel.statuses, statuses);
	});

	describe('distinct()', async () => {

		it('Should reject when DB Driver rejects', async () => {

			sinon.stub(DBDriver.prototype, 'distinct')
				.rejects(new Error('Some internal error'));

			await assert.rejects(() => myCoreModel.distinct('status'), {
				message: 'Some internal error'
			});
		});

		it('Should resolve an array of distinct values when DB Driver resolves', async () => {

			sinon.stub(DBDriver.prototype, 'distinct')
				.resolves(['Value 1', 'Value 2']);

			const distinctValues = await myCoreModel.distinct('status');

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.distinct, myCoreModel, {
				key: 'status'
			});

			assert.deepStrictEqual(distinctValues, ['Value 1', 'Value 2']);
		});

		it('Should pass extra params to the DB Driver', async () => {

			sinon.stub(DBDriver.prototype, 'distinct')
				.resolves([]);

			await myCoreModel.distinct('status', {
				filters: {
					type: 'foo'
				}
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.distinct, myCoreModel, {
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
			sinon.stub(ClientModel.prototype, 'get');
			model = new ClientModel();
		});

		it('Should pass one ID filter as the only param when second argument is not passed', async () => {

			await model.getById(1);

			sinon.assert.calledOnceWithExactly(ClientModel.prototype.get, {
				filters: { id: 1 }
			});
		});

		it('Should pass multi ID filter as the only param when second argument is not passed', async () => {

			await model.getById([1, 2]);

			sinon.assert.calledOnceWithExactly(ClientModel.prototype.get, {
				filters: { id: [1, 2] }
			});
		});

		it('Should merge the ID filter with the other params passed', async () => {

			await model.getById(1, { limit: 10 });

			sinon.assert.calledOnceWithExactly(ClientModel.prototype.get, {
				filters: { id: 1 },
				limit: 10
			});
		});

		it('Should merge the ID filter with the other params passed (including other filters)', async () => {

			await model.getById(1, {
				filters: { status: 'active' },
				limit: 10
			});

			sinon.assert.calledOnceWithExactly(ClientModel.prototype.get, {
				filters: { status: 'active', id: 1 },
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
			sinon.stub(ClientModel.prototype, 'get');
			model = new ClientModel();
		});

		it('Should pass one orderId filter as the only param when third argument is not passed', async () => {

			await model.getBy('orderId', 1);

			sinon.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: { orderId: 1 }
			});
		});

		it('Should pass multi orderIds filter as the only param when third argument is not passed', async () => {

			await model.getBy('orderId', [1, 2]);

			sinon.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: { orderId: [1, 2] }
			});
		});

		it('Should merge the orderId filter with the other params passed', async () => {

			await model.getBy('orderId', 1, { limit: 10 });

			sinon.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: { orderId: 1 },
				limit: 10
			});
		});

		it('Should merge the orderId filter with the other params passed (including other filters)', async () => {

			await model.getBy('orderId', 1, {
				filters: { status: 'active' },
				limit: 10
			});

			sinon.assert.calledWithExactly(ClientModel.prototype.get, {
				filters: { status: 'active', orderId: 1 },
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

			sinon.assert.calledWithExactly(ClientModel.prototype.get, {
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

		sinon.stub(DBDriver.prototype, 'get')
			.resolves({ foo: 456 });

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {
			fooParam: 1
		});

		assert.deepStrictEqual(result, { foo: 456 });
	});

	it('Should return an empty array when driver returns an empty array', async () => {

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([]);

		const result = await myCoreModel.get();

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {});

		assert.deepStrictEqual(result, []);
	});

	it('Should get normally when no \'formatGet\' method exists', async () => {

		myCoreModel.formatGet = undefined;

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([{ fooItem: 88 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { fooParam: 1 });

		assert.deepStrictEqual(result, [{ fooItem: 88 }]);
	});

	it('Should get normally when no \'afterGet\' method exists', async () => {

		myCoreModel.afterGet = undefined;

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([{ fooItem: 7787 }]);

		const result = await myCoreModel.get({
			fooParam: 1
		});

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { fooParam: 1 });

		assert.deepStrictEqual(result, [{ fooItem: 7787 }]);
	});

	it('Should call DBDriver getTotals method passing the model', async () => {

		sinon.stub(DBDriver.prototype, 'getTotals')
			.resolves();

		await myCoreModel.getTotals();

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.getTotals, myCoreModel);
	});

	['insert', 'remove'].forEach(method => {

		it(`should call DBDriver ${method} method passing the model and the item received`, async () => {

			sinon.stub(DBDriver.prototype, method)
				.resolves();

			await myCoreModel[method]({ foo: 'bar' });

			sinon.assert.calledOnceWithExactly(DBDriver.prototype[method], myCoreModel, { foo: 'bar' });
		});
	});

	it('should call DBDriver save method passing the model and the item received', async () => {

		sinon.stub(DBDriver.prototype, 'save')
			.resolves();

		await myCoreModel.save({ foo: 'bar' });

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.save, myCoreModel, { foo: 'bar' }, undefined);
	});

	it('Should call DBDriver update method passing the model and the values and filter received', async () => {

		sinon.stub(DBDriver.prototype, 'update')
			.resolves();

		await myCoreModel.update({ status: -1 }, { foo: 'bar' });

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.update, myCoreModel, { status: -1 }, { foo: 'bar' }, undefined);
	});

	it('should call DBDriver multiInsert method passing the model and the items received', async () => {

		sinon.stub(DBDriver.prototype, 'multiInsert')
			.resolves();

		await myCoreModel.multiInsert([{ foo: 'bar' }, { foo2: 'bar2' }]);

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiInsert, myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }]);
	});

	it('should call DBDriver multiSave method passing the model and the items received', async () => {

		sinon.stub(DBDriver.prototype, 'multiSave')
			.resolves();

		await myCoreModel.multiSave([{ foo: 'bar' }, { foo2: 'bar2' }]);

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiSave, myCoreModel, [{ foo: 'bar' }, { foo2: 'bar2' }], undefined);
	});

	it('Should call DBDriver multiRemove method passing the model and the filter received', async () => {

		sinon.stub(DBDriver.prototype, 'multiRemove')
			.resolves();

		await myCoreModel.multiRemove({ foo: 'bar' });

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiRemove, myCoreModel, { foo: 'bar' });
	});

	context('when param \'changeKeys\' received', () => {

		it('Should change keys when key found in items', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { changeKeys: 'id' });
			sinon.assert.calledOnceWithExactly(Model.changeKeys, [{ id: 1, foo: 'bar' }, { id: 2, bar: 'foo' }], 'id');

			assert.deepStrictEqual(result, {
				1: { id: 1, foo: 'bar' },
				2: { id: 2, bar: 'foo' }
			});
		});

		it('Should ignore items that hasn\'t the key', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([{ foo: 'bar' }, { bar: 'foo' }]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { changeKeys: 'id' });
			sinon.assert.calledOnceWithExactly(Model.changeKeys, [{ foo: 'bar' }, { bar: 'foo' }], 'id');

			assert.deepStrictEqual(result, {});
		});

		it('Should return empty object when items cannot be found', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([]);

			const result = await myCoreModel.get({
				changeKeys: 'id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { changeKeys: 'id' });
			sinon.assert.notCalled(Model.changeKeys);

			assert.deepStrictEqual(result, {});
		});
	});

	it('Should call method \'formatGet\' with each item', async () => {

		sinon.stub(myCoreModel, 'formatGet')
			.callsFake(({ ...item }) => {
				item.added = 123;
				return item;
			});

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([{ fooItem: 2 }, { anotherFooItem: 3 }]);

		const result = await myCoreModel.get();

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {});

		sinon.assert.calledTwice(myCoreModel.formatGet);
		sinon.assert.calledWithExactly(myCoreModel.formatGet.getCall(0), { fooItem: 2 });
		sinon.assert.calledWithExactly(myCoreModel.formatGet.getCall(1), { anotherFooItem: 3 });

		assert.deepStrictEqual(result, [
			{ fooItem: 2, added: 123 },
			{ anotherFooItem: 3, added: 123 }
		]);
	});

	it('Should call method \'afterGet\' with all items', async () => {

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([{ foo: 1 }, { bar: 2 }]);

		sinon.spy(myCoreModel, 'afterGet');

		const result = await myCoreModel.get();

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {});
		sinon.assert.calledOnceWithExactly(myCoreModel.afterGet, [{ foo: 1 }, { bar: 2 }], {}, {}, []);

		assert.deepStrictEqual(result, [{ foo: 1 }, { bar: 2 }]);
	});

	it('Should call method \'afterGet\' with all items, params, indexes and ids', async () => {

		sinon.stub(DBDriver.prototype, 'get')
			.resolves([{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);

		sinon.spy(myCoreModel, 'afterGet');

		const result = await myCoreModel.get({ extraParam: true });

		sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, { extraParam: true });
		sinon.assert.calledOnceWithExactly(myCoreModel.afterGet, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }], { extraParam: true }, { 33: 0, 78: 1 }, [33, 78]); // eslint-disable-line max-len

		assert.deepStrictEqual(result, [{ id: 33, foo: 45 }, { id: 78, bar: 987 }]);
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

			sinon.stub(myCoreModel, 'get')
				.returns([]);

			await myCoreModel.getPaged({}, getPagedCallback);

			sinon.assert.calledOnceWithExactly(myCoreModel.get, {
				page: 1,
				limit: Model.defaultPageLimit
			});

			sinon.assert.notCalled(getPagedCallback);
		});

		it('Should call the callback one time when get response an array of items, passing custom limit', async () => {

			sinon.stub(myCoreModel, 'get')
				.onCall(0)
				.returns([{ foo: 1 }, { bar: 2 }])
				.onCall(1)
				.returns([{ foo: 5 }])
				.returns([]); // for the following calls

			await myCoreModel.getPaged({ limit: 2 }, getPagedCallback);

			sinon.assert.calledTwice(myCoreModel.get);
			sinon.assert.calledWithExactly(myCoreModel.get.getCall(0), { page: 1, limit: 2 });
			sinon.assert.calledWithExactly(myCoreModel.get.getCall(1), { page: 2, limit: 2 });

			sinon.assert.calledTwice(getPagedCallback);
			sinon.assert.calledWithExactly(getPagedCallback.getCall(0), [{ foo: 1 }, { bar: 2 }], 1, 2);
			sinon.assert.calledWithExactly(getPagedCallback.getCall(1), [{ foo: 5 }], 2, 2);
		});
	});


	context('setLogData()', () => {

		const myClientModel = new ClientModel();

		const userCreated = 'some-user-id';

		myClientModel.session = {
			...fakeSession,
			clientCode: 'some-client',
			userId: 'some-user-id'
		};

		afterEach(() => {
			delete ClientModel.excludeFieldsInLog;
		});

		it('Should throw an error when recived invalid data to log', () => {
			assert.throws(() => myCoreModel.setLogData(['invalid data']), {
				message: 'The custom data to log must be string or an object'
			});
		});

		it('Should throw an error when recived an invalid custom log property', () => {
			assert.throws(() => myCoreModel.setLogData({ log: 'invalid-log' }), {
				message: 'The property name log in custom log data must be an object'
			});
		});

		it('Should log only the default log data when the second insert operation does not set custom data', async () => {

			sinon.stub(DBDriver.prototype, 'insert')
				.resolves('some-id');

			await myClientModel.setLogData({ type: 'super inserted', log: { isInternal: true } }).insert({ some: 'data' });
			await myClientModel.insert({ some: 'other data' });

			sinon.assert.calledWithExactly(Log.add.getCall(0), 'some-client', {
				type: 'super inserted',
				entity: 'client',
				entityId: 'some-id',
				userCreated,
				log: { some: 'data', userCreated, isInternal: true }
			});

			sinon.assert.calledWithExactly(Log.add.getCall(1), 'some-client', {
				type: 'inserted',
				entity: 'client',
				entityId: 'some-id',
				userCreated,
				log: { some: 'other data', userCreated }
			});
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

				sinon.stub(DBDriver.prototype, 'insert')
					.resolves();

				await myClientModel.insert({ some: 'data' });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.insert, myClientModel, {
					some: 'data',
					userCreated,
					dateCreated: sinon.match.date,
					userModified,
					dateModified: sinon.match.date
				});
			});

			it('Should log the insert operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'insert')
					.resolves('some-id');

				await myClientModel.insert({ some: 'data' });

				sinon.assert.calledOnceWithExactly(Log.add, 'some-client', {
					type: 'inserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						some: 'data',
						userCreated,
						dateCreated: sinon.match.date,
						userModified,
						dateModified: sinon.match.date
					}
				});
			});

			it('Should log the custom data when pre-set before insertion', async () => {

				sinon.stub(DBDriver.prototype, 'insert')
					.resolves('some-id');

				await myClientModel
					.setLogData({ type: 'super inserted', log: { isInternal: true } })
					.insert({ some: 'data' });

				sinon.assert.calledWithExactly(Log.add.getCall(0), 'some-client', {
					type: 'super inserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						some: 'data',
						userCreated,
						dateCreated: sinon.match.date,
						userModified,
						dateModified: sinon.match.date,
						isInternal: true
					}
				});
			});
		});

		describe('multiInsert()', () => {

			it('Should add the userCreated field when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'multiInsert')
					.resolves();

				await myClientModel.multiInsert([{ some: 'data' }, { other: 'data' }]);

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiInsert, myClientModel, [
					{
						some: 'data',
						userCreated,
						dateCreated: sinon.match.date,
						userModified,
						dateModified: sinon.match.date
					},
					{
						other: 'data',
						userCreated,
						dateCreated: sinon.match.date,
						userModified,
						dateModified: sinon.match.date
					}
				]);
			});

			it('Should log the multiInsert operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'multiInsert')
					.resolves(true);

				await myClientModel.multiInsert([{ some: 'data' }]);

				sinon.assert.calledOnceWithExactly(Log.add, 'some-client', [
					{
						type: 'inserted',
						entity: 'client',
						userCreated,
						log: {
							some: 'data',
							userCreated,
							dateCreated: sinon.match.date,
							userModified,
							dateModified: sinon.match.date
						}
					}
				]);
			});

			it('Should log the custom data when pre-set before the multiInsert operation', async () => {

				sinon.stub(DBDriver.prototype, 'multiInsert')
					.resolves(true);

				await myClientModel.setLogData({ message: 'custom message', isData: true }).multiInsert([{ some: 'data' }]);

				sinon.assert.calledOnceWithExactly(Log.add, 'some-client', [
					{
						type: 'inserted',
						entity: 'client',
						userCreated,
						message: 'custom message',
						isData: true,
						log: {
							some: 'data',
							userCreated,
							dateCreated: sinon.match.date,
							userModified,
							dateModified: sinon.match.date
						}
					}
				]);
			});
		});

		describe('update()', () => {

			it('Should add the userModified field when session exists (data is object)', async () => {

				sinon.stub(DBDriver.prototype, 'update')
					.resolves();

				await myClientModel.update({ some: 'data' }, {});

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.update, myClientModel, {
					some: 'data',
					userModified,
					dateModified: sinon.match.date
				}, {}, undefined);
			});

			it('Should add the userModified field when session exists (data is array)', async () => {

				sinon.stub(DBDriver.prototype, 'update')
					.resolves();

				await myClientModel.update([{ some: 'data' }, { name: 'Johnson' }], {});

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.update, myClientModel, [
					{ some: 'data' },
					{ name: 'Johnson' },
					{ userModified, dateModified: sinon.match.date }
				], {}, undefined);
			});

			it('Should log the update operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'update')
					.resolves(1);

				await myClientModel.update({ some: 'data' }, { id: 'some-id' }, { some: 'param' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'updated',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						values: { some: 'data', userModified, dateModified: sinon.match.date },
						filter: { id: 'some-id' },
						params: { some: 'param' }
					}
				});
			});

			it('Should log the custom data when pre-set before the update operation', async () => {

				sinon.stub(DBDriver.prototype, 'update')
					.resolves(1);

				await myClientModel
					.setLogData({ message: 'update message log', isUpdated: true })
					.update({ some: 'data' }, { id: 'some-id' }, { some: 'param' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'updated',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					message: 'update message log',
					isUpdated: true,
					log: {
						values: { some: 'data', userModified, dateModified: sinon.match.date },
						filter: { id: 'some-id' },
						params: { some: 'param' }
					}
				});
			});
		});

		describe('remove()', () => {

			it('Should log the remove operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'remove')
					.resolves('some-id');

				await myClientModel.remove({ id: 'some-id', some: 'data' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id', some: 'data' }
				});
			});

			it('Should log the custom data when pre-set before the remove operation', async () => {

				sinon.stub(DBDriver.prototype, 'remove')
					.resolves('some-id');

				await myClientModel.setLogData('removing record').remove({ id: 'some-id', some: 'data' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					message: 'removing record',
					log: { id: 'some-id', some: 'data' }
				});
			});
		});

		describe('multiRemove()', () => {

			it('Should log the multiRemove operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'multiRemove')
					.resolves('some-id');

				await myClientModel.multiRemove({ id: 'some-id' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: { id: 'some-id' }
				});
			});

			it('Should log the custom data when pre-set before the multiRemove operation', async () => {

				sinon.stub(DBDriver.prototype, 'multiRemove')
					.resolves('some-id');

				await myClientModel.setLogData({ message: 'removing!' }).multiRemove({ id: 'some-id' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'removed',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					message: 'removing!',
					log: { id: 'some-id' }
				});
			});
		});

		describe('save', () => {

			it('Should add the userCreated field when session exists and the received item not have id', async () => {

				sinon.stub(DBDriver.prototype, 'save')
					.resolves();

				await myClientModel.save({ some: 'data' });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.save, myClientModel, {
					some: 'data',
					userModified,
					dateModified: sinon.match.date
				}, {
					userCreated,
					dateCreated: sinon.match.date
				});
			});

			it('Should add the setOnInsert when it is passed', async () => {

				sinon.stub(DBDriver.prototype, 'save')
					.resolves();

				await myClientModel.save({ some: 'data' }, { status: 'active' });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.save, myClientModel, {
					some: 'data',
					userModified,
					dateModified: sinon.match.date
				}, {
					status: 'active',
					userCreated,
					dateCreated: sinon.match.date
				});
			});

			[
				'id',
				'_id'
			].forEach(idField => {

				it(`Should add the userModified field when session exists and the received item have ${idField}`, async () => {

					sinon.stub(DBDriver.prototype, 'save')
						.resolves();

					await myClientModel.save({ [idField]: 'some-id', some: 'data' });

					sinon.assert.calledOnceWithExactly(DBDriver.prototype.save, myClientModel, {
						[idField]: 'some-id',
						some: 'data',
						userModified,
						dateModified: sinon.match.date
					}, {
						userCreated,
						dateCreated: sinon.match.date
					});
				});
			});

			it('Should log the save operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'save')
					.resolves('some-id');

				await myClientModel.save({ id: 'some-id', some: 'data' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						id: 'some-id',
						some: 'data',
						userModified,
						dateModified: sinon.match.date
					}
				});
			});

			it('Should log the custom data when pre-set before the save operation', async () => {

				sinon.stub(DBDriver.prototype, 'save')
					.resolves('some-id');

				await myClientModel.setLogData('saved').save({ id: 'some-id', some: 'data' });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'upserted',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					message: 'saved',
					log: {
						id: 'some-id',
						some: 'data',
						userModified,
						dateModified: sinon.match.date
					}
				});
			});
		});

		describe('increment', () => {

			it('Should add the userModified field when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'increment')
					.resolves({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.increment({ id: 'some-id' }, { quantity: 1 });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.increment, myClientModel,
					{ id: 'some-id' },
					{ quantity: 1 },
					{
						userModified,
						dateModified: sinon.match.date
					}
				);
			});

			it('Should not add the userModified field when not session exists', async () => {

				sinon.stub(DBDriver.prototype, 'increment')
					.resolves({ _id: 'some-id', quantity: 2, userModified });

				await myCoreModel.increment({ id: 'some-id' }, { quantity: 1 });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.increment, myCoreModel,
					{ id: 'some-id' },
					{ quantity: 1 },
					{
						userModified: null,
						dateModified: sinon.match.date
					}
				);
			});

			it('Should log the save operation when session exists', async () => {

				sinon.stub(DBDriver.prototype, 'increment')
					.resolves({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.increment({ id: 'some-id' }, { quantity: 1 });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'incremented',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					log: {
						incrementData: { quantity: 1 },
						updatedData: { userModified, dateModified: sinon.match.date },
						result: { _id: 'some-id', quantity: 2, userModified }
					}
				});
			});

			it('Should log the custom data when pre-set before the increment operation', async () => {

				sinon.stub(DBDriver.prototype, 'increment')
					.resolves({ _id: 'some-id', quantity: 2, userModified });

				await myClientModel.setLogData({ importCarriers: true }).increment({ id: 'some-id' }, { quantity: 1 });

				sinon.assert.calledWithExactly(Log.add, 'some-client', {
					type: 'incremented',
					entity: 'client',
					entityId: 'some-id',
					userCreated,
					importCarriers: true,
					log: {
						incrementData: { quantity: 1 },
						updatedData: { userModified, dateModified: sinon.match.date },
						result: { _id: 'some-id', quantity: 2, userModified }
					}
				});
			});
		});

		describe('multiSave()', () => {

			it('Should add the userCreated field when session exists and the received item not have id', async () => {

				sinon.stub(DBDriver.prototype, 'multiSave')
					.resolves();

				await myClientModel.multiSave([{ some: 'data' }, { other: 'data' }]);

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiSave, myClientModel, [
					{ some: 'data', userModified, dateModified: sinon.match.date },
					{ other: 'data', userModified, dateModified: sinon.match.date }
				], {
					userCreated,
					dateCreated: sinon.match.date
				});
			});

			it('Should add setOnInsert when it is passed', async () => {

				sinon.stub(DBDriver.prototype, 'multiSave')
					.resolves();

				await myClientModel.multiSave([{ some: 'data' }, { other: 'data' }], { quantity: 100 });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiSave, myClientModel, [
					{ some: 'data', userModified, dateModified: sinon.match.date },
					{ other: 'data', userModified, dateModified: sinon.match.date }
				], {
					quantity: 100,
					userCreated,
					dateCreated: sinon.match.date
				});
			});

			[
				'id',
				'_id'
			].forEach(idField => {

				it(`Should add the userModified field when session exists and the received item have ${idField}`, async () => {

					sinon.stub(DBDriver.prototype, 'multiSave')
						.resolves();

					await myClientModel.multiSave([
						{ [idField]: 'some-id', some: 'data' },
						{ [idField]: 'other-id', other: 'data' }
					]);

					sinon.assert.calledOnceWithExactly(DBDriver.prototype.multiSave, myClientModel, [
						{ [idField]: 'some-id', some: 'data', userModified, dateModified: sinon.match.date },
						{ [idField]: 'other-id', other: 'data', userModified, dateModified: sinon.match.date }
					], {
						userCreated,
						dateCreated: sinon.match.date
					});
				});
			});

			it('Should log the multiSave operation', async () => {

				sinon.stub(DBDriver.prototype, 'multiSave')
					.resolves('some-id');

				await myClientModel.multiSave([{ id: 'some-id', some: 'data' }]);

				sinon.assert.calledWithExactly(Log.add, 'some-client', [
					{
						type: 'upserted',
						entity: 'client',
						entityId: 'some-id',
						userCreated,
						log: { id: 'some-id', some: 'data', userModified, dateModified: sinon.match.date }
					}
				]);
			});

			it('Should log the custom data when pre-set before the multiSave operation', async () => {

				sinon.stub(DBDriver.prototype, 'multiSave')
					.resolves('some-id');

				await myClientModel
					.setLogData('multisave log message')
					.multiSave([{ id: 'some-id', some: 'data' }]);

				sinon.assert.calledWithExactly(Log.add, 'some-client', [
					{
						type: 'upserted',
						entity: 'client',
						entityId: 'some-id',
						userCreated,
						message: 'multisave log message',
						log: { id: 'some-id', some: 'data', userModified, dateModified: sinon.match.date }
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

				sinon.stub(DBDriver.prototype, method)
					.resolves();

				await myClientModel[method]();

				sinon.assert.notCalled(Log.add);
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

		sinon.stub(DBDriver.prototype, 'insert')
			.resolves('some-id');

		await myClientModel.insert({
			username: 'some-username',
			password: 'some-password',
			location: {
				country: 'some-country',
				address: 'some-address'
			}
		});

		sinon.assert.calledWithExactly(Log.add, 'some-client', {
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

		sinon.stub(ClientModel, 'shouldCreateLogs')
			.get(() => false);

		sinon.stub(DBDriver.prototype, 'insert')
			.resolves('some-id');

		await myClientModel.insert({
			username: 'some-username',
			password: 'some-password',
			location: {
				country: 'some-country',
				address: 'some-address'
			}
		});

		sinon.assert.notCalled(Log.add);
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

				sinon.stub(DBDriver.prototype, method)
					.resolves();

				await myCoreModel[method](...args);

				sinon.assert.calledOnceWithExactly(DBDriver.prototype[method], myCoreModel, ...args);
			});
		});
	});

	describe('Map ID By', () => {

		it('Should reject when Reference Ids is not an Array', async () => {
			await assert.rejects(myCoreModel.mapIdByReferenceId(), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId('refId'), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId({ refId: 'refId' }), { code: ModelError.codes.INVALID_VALUE });
			await assert.rejects(myCoreModel.mapIdByReferenceId(1000), { code: ModelError.codes.INVALID_VALUE });
		});

		it('Should return empty object when empty Array received', async () => {

			sinon.spy(DBDriver.prototype, 'get');

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId([]), {});

			sinon.assert.notCalled(DBDriver.prototype.get);
		});

		it('Should return object with referenceId key and Id value', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([{ id: 'some-id', referenceId: 'some-ref-id' }, { id: 'other-id', referenceId: 'other-ref-id' }]);

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId(['some-ref-id', 'other-ref-id']), {
				'some-ref-id': 'some-id',
				'other-ref-id': 'other-id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {
				filters: {
					referenceId: ['some-ref-id', 'other-ref-id']
				},
				limit: 2
			});
		});

		it('Should return object with code key and Id value', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([{ id: 'some-id', code: 'some-code-123' }, { id: 'other-id-without-code' }]);

			assert.deepStrictEqual(await myCoreModel.mapIdBy('code', ['some-code-123']), {
				'some-code-123': 'some-id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {
				filters: { code: ['some-code-123'] },
				limit: 1
			});
		});

		it('Should return object with referenceId key and Id value when just one referenceId matches and other filters given', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves([{ id: 'some-id', referenceId: 'some-ref-id' }]);

			assert.deepStrictEqual(await myCoreModel.mapIdByReferenceId(['some-ref-id', 'foo-ref-id', 'bar-ref-id'], { filters: { foo: 'bar' } }), {
				'some-ref-id': 'some-id'
			});

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {
				filters: {
					referenceId: ['some-ref-id', 'foo-ref-id', 'bar-ref-id'],
					foo: 'bar'
				},
				limit: 3
			});
		});
	});

	describe('DB Methods not implemented', () => {

		Object.entries({
			get: [],
			distinct: ['status'],
			increment: [{ id: 'some-id' }, { quantity: 1 }]
		}).forEach(async ([method, params]) => {

			it(`Should reject when DB not support method ${method}`, async () => {
				await assert.rejects(otherModel[method](...params), {
					code: ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED
				});
			});

		});
	});

	describe('Admin privileges model methods', () => {
		it('Should reject when Model hasn\'t write config', async () => {

			sinon.restore();

			const noWriteConfigSettings = {
				...settings,
				core: {}
			};

			sinon.stub(Settings, 'get')
				.withArgs('database')
				.returns(noWriteConfigSettings);

			await assert.rejects(myCoreModel.dropDatabase(), {
				code: ModelError.codes.INVALID_DB_CONFIG
			});
		});
	});

	describe('aggregate()', () => {

		const itemId = '5df0151dbc1d570011949d87';

		const stages = [
			{ $match: { id: itemId, referenceId: 'display-id' } },
			{ $unset: 'category' }
		];

		const results = [{
			id: itemId,
			name: 'Some name',
			referenceId: 'display-id'
		}];

		it('Should fail if Driver does not support aggregate function', async () => {

			const myClientModel = new ClientModel();
			myClientModel.session = fakeSession;

			await assert.rejects(myClientModel.aggregate(stages));
		});

		it('Should resolve the aggregation stages result', async () => {

			const myClientModel = new ClientModel();
			myClientModel.session = fakeSession;

			const aggregate = sinon.stub().resolves(results);

			DBDriver.prototype.aggregate = aggregate;

			assert.deepStrictEqual(await myClientModel.aggregate(stages), results);

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.aggregate, myClientModel, stages);
		});

		it('Should fail if database driver aggregate function rejects', async () => {

			const myClientModel = new ClientModel();
			myClientModel.session = fakeSession;

			const aggregate = sinon.stub().rejects();

			DBDriver.prototype.aggregate = aggregate;

			await assert.rejects(myClientModel.aggregate(stages));

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.aggregate, myClientModel, stages);
		});
	});

	describe('idStruct()', () => {

		it('Should return an idStruct function', async () => {

			const myClientModel = new ClientModel();
			myClientModel.session = fakeSession;

			try {
				(await myClientModel.getIdStruct())('123');
			} catch(error) {
				assert.deepStrictEqual(error.message, 'Expected a value of type `objectId` but received `"123"`.');
			}
		});
	});
});
