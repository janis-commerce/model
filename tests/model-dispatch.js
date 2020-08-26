'use strict';

const assert = require('assert');
const mockRequire = require('mock-require');
const sandbox = require('sinon').createSandbox();

const Settings = require('@janiscommerce/settings');
const DatabaseDispatcher = require('../lib/helpers/database-dispatcher');

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

describe('Model', () => {

	describe('Dispatch', () => {

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

		class DBDriverMock {

			constructor(config) {

				if(config.fail)
					throw new Error('Error creating instance');

				this.config = config;
			}

			get() {}

			insert() {}

			save() {}

			update() {}

			remove() {}

			multiInsert() {}

			multiSave() {}

			multiRemove() {}
		}

		const databaseMock = dbDriverMock => {
			mockRequire(`${DatabaseDispatcher.prototype.scope}/mongodb`, dbDriverMock || DBDriverMock);
		};

		const assertDbDriverConfig = async (model, config) => {

			const dbDriverInstance = await model.getDb();

			assert.deepStrictEqual(dbDriverInstance.config, config);
		};

		beforeEach(() => {

			databaseMock();

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

				sandbox.stub(DBDriverMock.prototype, 'get')
					.resolves();

				const myCoreModel = new CoreModel();

				await myCoreModel.get();

				sandbox.assert.calledOnceWithExactly(DBDriverMock.prototype.get, myCoreModel, {});

				await assertDbDriverConfig(myCoreModel, settings.core.write);
			});

			it('Should call DBDriver get using client config when it exists', async () => {

				sandbox.stub(DBDriverMock.prototype, 'get')
					.resolves();

				const myClientModel = new ClientModel();

				await myClientModel.get();

				sandbox.assert.calledOnceWithExactly(DBDriverMock.prototype.get, myClientModel, {});

				await assertDbDriverConfig(myClientModel, client.databases.default.write);
			});

			it('Should call DBDriver get using read DB when readonly param is true', async () => {

				sandbox.stub(DBDriverMock.prototype, 'get')
					.resolves();

				const myClientModel = new ClientModel();

				await myClientModel.get({ readonly: true });

				sandbox.assert.calledOnceWithExactly(DBDriverMock.prototype.get, myClientModel, { readonly: true });

				await assertDbDriverConfig(myClientModel, client.databases.default.read);
			});

			[
				'insert',
				'update',
				'save',
				'remove'

			].forEach(method => {

				it(`should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

					sandbox.stub(DBDriverMock.prototype, method)
						.resolves();

					const myClientModel = new ClientModel();

					await myClientModel.get({ readonly: true });

					await assertDbDriverConfig(myClientModel, client.databases.default.read);

					await myClientModel[method]({ foo: 'bar' });

					await assertDbDriverConfig(myClientModel, client.databases.default.write);
				});
			});

			[
				'multiInsert',
				'multiSave',
				'multiRemove'

			].forEach(method => {

				it(`should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

					sandbox.stub(DBDriverMock.prototype, method)
						.resolves();

					const myClientModel = new ClientModel();

					await myClientModel.get({ readonly: true });

					await assertDbDriverConfig(myClientModel, client.databases.default.read);

					await myClientModel[method]([{ foo: 'bar' }]);

					await assertDbDriverConfig(myClientModel, client.databases.default.write);
				});
			});
		});

		describe('Settings validations', () => {

			let model;

			beforeEach(() => {
				model = new CoreModel();
			});

			it('Should throw when the database settings not exists', async () => {

				Settings.get.withArgs('database')
					.returns();

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should throw when the especific database key do not exist ', async () => {

				Settings.get.withArgs('database')
					.returns({ someKey: {} });

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should throw when the database settings is not an object', async () => {

				Settings.get.withArgs('database')
					.returns('databases');

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_SETTINGS
				});
			});

			it('Should throw when the database settings is an array', async () => {

				Settings.get.withArgs('database')
					.returns([settings]);

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_SETTINGS
				});
			});

			it('Should throw when the database key is not an object', async () => {

				Settings.get.withArgs('database')
					.returns({ core: 'not an object' });

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_DB_CONFIG
				});
			});

			it('Should throw when the database key is an array', async () => {

				Settings.get.withArgs('database')
					.returns({ core: ['not an object'] });

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_DB_CONFIG
				});
			});
		});

		describe('Client database config validations', () => {

			let model;

			beforeEach(() => {
				model = new ClientModel();
			});

			it('Should throw when client not exists', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => null);

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_CLIENT
				});
			});

			it('Should throw when \'client\' database config is not an object', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => ({ databases: 'not an object' }));

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_CLIENT
				});
			});

			it('Should throw when \'clients\' database config is an array', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => ({ databases: ['not an object'] }));

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_CLIENT
				});
			});

			it('Should throw when the especific database key do not exist ', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => ({ databases: { someKey: {} } }));

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should throw when the database key is not an object', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => ({ databases: { default: 'not an object' } }));

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_DB_CONFIG
				});
			});

			it('Should throw when the database key is an array', async () => {

				sandbox.stub(model.session, 'client')
					.get(() => ({ databases: { default: ['not an object'] } }));

				await assert.rejects(model.getDb(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_DB_CONFIG
				});
			});
		});

		describe('hasReadDB()', () => {

			it('Should return false when the received databaseKey is for a core database', async () => {

				const model = new CoreModel();

				assert.deepEqual(await model.hasReadDB('core'), false);
			});

			it('Should return true when the received databaseKey has a read DB in client databases', async () => {

				const clientModel = new ClientModel();

				assert.deepEqual(await clientModel.hasReadDB(), true);
			});

			it('Should return false when the received databaseKey don\'t have a read DB in client databases', async () => {

				const clientModel = new ClientModel();

				sandbox.stub(clientModel.session, 'client')
					.get(() => ({ databases: { default: { write: {} } } }));

				assert.deepEqual(await clientModel.hasReadDB(), false);
			});

			it('Should return false when the received databaseKey don\'t exists in client databases', async () => {

				const clientModel = new ClientModel();

				sandbox.stub(clientModel.session, 'client')
					.get(() => ({ databases: { someKey: {} } }));

				assert.deepEqual(await clientModel.hasReadDB(), false);
			});

			it('Should return false when the client not have database settings', async () => {

				const clientModel = new ClientModel();

				sandbox.stub(clientModel.session, 'client')
					.get(() => ({}));

				assert.deepEqual(await clientModel.hasReadDB(), false);
			});
		});
	});
});
