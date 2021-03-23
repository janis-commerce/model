'use strict';

const assert = require('assert');
const mockRequire = require('mock-require');
const sandbox = require('sinon');

const Settings = require('@janiscommerce/settings');

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

const DBDriver = require('./db-driver');

describe('Model Dispatch', () => {

	const client = {
		databases: {
			default: {
				write: {
					type: 'mongodb',
					host: 'write-host',
					database: 'write-database-name',
					username: 'write-username',
					password: 'write-password'
				},
				read: {
					type: 'mongodb',
					host: 'read-host',
					database: 'read-database-name',
					username: 'read-username',
					password: 'read-password'
				},
				admin: {
					type: 'mongodb',
					host: 'write-host',
					database: 'write-database-name',
					username: 'write-secure-username',
					password: 'write-secure-password'
				}
			}
		}
	};

	const settings = {
		core: {
			write: {
				type: 'mongodb',
				host: 'write-host',
				database: 'write-database-name',
				username: 'write-username',
				password: 'write-password'
			},
			read: {
				type: 'mongodb',
				host: 'read-host',
				database: 'read-database-name',
				username: 'read-username',
				password: 'read-password'
			}
		},
		other: {
			write: {
				type: 'mongodb',
				host: 'write-host',
				database: 'write-database-name',
				username: 'write-username',
				password: 'write-password'
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

	class EmptyModel extends Model {}

	class ClientModel extends Model {
		constructor() {
			super();
			this.session = fakeSession;
		}
	}

	class CoreModel extends Model {
		get databaseKey() { return 'core'; }
	}

	class OtherCoreModel extends Model {
		get databaseKey() { return 'other'; }
	}

	const assertDbDriverConfig = async (model, config) => {

		const dbDriverInstance = await model.getDb();

		assert.deepStrictEqual(dbDriverInstance.config, config);
	};

	beforeEach(() => {

		mockRequire('@janiscommerce/mongodb', DBDriver);

		sandbox.stub(Settings, 'get')
			.withArgs('database')
			.returns(settings);
	});

	afterEach(async () => {
		sandbox.restore();
		mockRequire.stopAll();
	});

	describe('DBDriver dispatching', () => {

		it('Should reject when model haven\'t a client injected or databaseKey getter', async () => {

			const myEmptyModel = new EmptyModel();

			await assert.rejects(() => myEmptyModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.DB_CONFIG_NOT_FOUND
			});
		});

		it('Should reject when the required DBDriver is not installed', async () => {

			Settings.get.withArgs('database')
				.returns({ core: { write: { ...settings.core.write, type: 'unknown-driver' } } });

			const myCoreModel = new CoreModel();

			await assert.rejects(myCoreModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.DB_DRIVER_NOT_INSTALLED
			});
		});

		it('Should reject when the required DBDriver rejects while creating instance', async () => {

			Settings.get.withArgs('database')
				.returns({ core: { write: { ...settings.core.write, fail: true } } });

			const myCoreModel = new CoreModel();

			await assert.rejects(myCoreModel.get(), {
				name: 'ModelError',
				code: ModelError.codes.INVALID_DB_DRIVER
			});
		});

		it('Should call DBDriver get using local settings when it exists', async () => {

			sandbox.stub(DBDriver.prototype, 'get')
				.resolves();

			const myCoreModel = new CoreModel();

			await myCoreModel.get();

			sandbox.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {});

			await assertDbDriverConfig(myCoreModel, settings.core.write);
		});

		it('Should call DBDriver get using client config when it exists', async () => {

			sandbox.stub(DBDriver.prototype, 'get')
				.resolves();

			const myClientModel = new ClientModel();

			await myClientModel.get();

			sandbox.assert.calledOnceWithExactly(DBDriver.prototype.get, myClientModel, {});

			await assertDbDriverConfig(myClientModel, client.databases.default.write);
		});

		it('Should call DBDriver get using read DB when readonly param is true', async () => {

			sandbox.stub(DBDriver.prototype, 'get')
				.resolves();

			const myClientModel = new ClientModel();

			await myClientModel.get({ readonly: true });

			sandbox.assert.calledOnceWithExactly(DBDriver.prototype.get, myClientModel, { readonly: true });

			await assertDbDriverConfig(myClientModel, client.databases.default.read);
		});

		[
			'insert',
			'update',
			'save',
			'remove',
			'multiInsert',
			'multiSave',
			'multiRemove'
		].forEach(method => {

			it(`should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

				sandbox.stub(DBDriver.prototype, method)
					.resolves();

				const myClientModel = new ClientModel();

				await myClientModel.get({ readonly: true });

				await assertDbDriverConfig(myClientModel, client.databases.default.read);

				if(['multiInsert', 'multiSave', 'multiRemove'].includes(method))
					await myClientModel[method]([{ foo: 'bar' }]);
				else
					await myClientModel[method]({ foo: 'bar' });

				await assertDbDriverConfig(myClientModel, client.databases.default.write);
			});
		});

	});

	describe('Settings validations', () => {

		let model;

		beforeEach(() => {
			model = new CoreModel();
		});

		const rejects = async code => {
			await assert.rejects(model.getDb(), {
				name: 'ModelError',
				code
			});
		};

		it('Should throw when the database settings not exists', async () => {

			Settings.get.withArgs('database')
				.returns();

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the specific database key do not exist ', async () => {

			Settings.get.withArgs('database')
				.returns({ someKey: {} });

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the database settings is not an object', async () => {

			Settings.get.withArgs('database')
				.returns('databases');

			await rejects(ModelError.codes.INVALID_SETTINGS);
		});

		it('Should throw when the database settings is an array', async () => {

			Settings.get.withArgs('database')
				.returns([settings]);

			await rejects(ModelError.codes.INVALID_SETTINGS);
		});

		it('Should throw when the database key is not an object', async () => {

			Settings.get.withArgs('database')
				.returns({ core: 'not an object' });

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});

		it('Should throw when the database key is an array', async () => {

			Settings.get.withArgs('database')
				.returns({ core: ['not an object'] });

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});
	});

	describe('Client database config validations', () => {

		let model;

		beforeEach(() => {
			model = new ClientModel();
		});

		const rejects = async code => {
			await assert.rejects(model.getDb(), {
				name: 'ModelError',
				code
			});
		};

		it('Should throw when client not exists', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => null);

			await rejects(ModelError.codes.INVALID_CLIENT);
		});

		it('Should throw when \'client\' database config is not an object', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => ({ databases: 'not an object' }));

			await rejects(ModelError.codes.INVALID_CLIENT);
		});

		it('Should throw when \'clients\' database config is an array', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => ({ databases: ['not an object'] }));

			await rejects(ModelError.codes.INVALID_CLIENT);
		});

		it('Should throw when the specific database key do not exist ', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => ({ databases: { someKey: {} } }));

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the database key is not an object', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => ({ databases: { default: 'not an object' } }));

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});

		it('Should throw when the database key is an array', async () => {

			sandbox.stub(model.session, 'client')
				.get(() => ({ databases: { default: ['not an object'] } }));

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});
	});

	describe('hasReadDB()', () => {

		it('Should return true when the received databaseKey is for a core database and has a read DB', async () => {

			const model = new CoreModel();

			assert.deepStrictEqual(await model.hasReadDB('core'), true);
		});

		it('Should return false when the received databaseKey is for a core database and hasn\'t a read DB', async () => {

			const model = new OtherCoreModel();

			assert.deepStrictEqual(await model.hasReadDB('core'), false);
		});

		it('Should return true when the received databaseKey has a read DB in client databases', async () => {

			const clientModel = new ClientModel();

			assert.deepStrictEqual(await clientModel.hasReadDB(), true);
		});

		it('Should return false when the received databaseKey don\'t have a read DB in client databases', async () => {

			const clientModel = new ClientModel();

			sandbox.stub(clientModel.session, 'client')
				.get(() => ({ databases: { default: { write: {} } } }));

			assert.deepStrictEqual(await clientModel.hasReadDB(), false);
		});

		it('Should return false when the received databaseKey don\'t exists in client databases', async () => {

			const clientModel = new ClientModel();

			sandbox.stub(clientModel.session, 'client')
				.get(() => ({ databases: { someKey: {} } }));

			assert.deepStrictEqual(await clientModel.hasReadDB(), false);
		});

		it('Should return false when the client not have database settings', async () => {

			const clientModel = new ClientModel();

			sandbox.stub(clientModel.session, 'client')
				.get(() => ({}));

			assert.deepStrictEqual(await clientModel.hasReadDB(), false);
		});
	});

	describe('Fetching credentials', () => {

		it('should call DBDriver using admin config DB when dropDatabase is executed', async () => {

			sandbox.stub(DBDriver.prototype, 'dropDatabase')
				.resolves();

			const stubGetValue = sandbox.stub()
				.resolves(123);

			sandbox.stub(AwsSecretsManager, 'secret')
				.returns(stubGetValue);

			const myClientModel = new ClientModel();

			await myClientModel.dropDatabase();

			await assertDbDriverConfig(myClientModel, client.databases.default.admin);
		});

	});
});
