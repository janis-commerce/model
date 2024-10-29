/* eslint-disable max-classes-per-file */

'use strict';

require('lllog')('none');

const assert = require('assert');
const mockRequire = require('mock-require');
const sinon = require('sinon');

const Settings = require('@janiscommerce/settings');

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { mockClient } = require('aws-sdk-client-mock');

const Model = require('../lib/model');
const ModelError = require('../lib/model-error');

const DBDriver = require('./db-driver');

const DatabaseDispatcher = require('../lib/helpers/database-dispatcher');

describe('Database Dispatcher', () => {

	const databaseId = '6720bd07ca1a8c966e4ec470';
	const otherDatabaseId = '672124de05ea029a051614d5';

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
		},
		db: {
			default: {
				id: databaseId,
				database: 'database-name'
			},
			nonDefault: {
				id: otherDatabaseId,
				database: 'other.database-name'
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

	class NonDefaultClientModel extends ClientModel {
		get databaseKey() {
			return 'non-default';
		}
	}

	class CoreModel extends Model {
		get databaseKey() { return 'core'; }
	}

	const assertDbDriverConfig = async (model, config) => {

		const dbDriverInstance = await model.getDb();

		assert.deepStrictEqual(dbDriverInstance.config, config);
	};

	const SecretHandler = class SecretHandler {
		getValue() {}
	};

	const stubGetSecret = value => {

		sinon.stub(SecretHandler.prototype, 'getValue')
			.resolves(value || {});

		sinon.stub(AwsSecretsManager, 'secret')
			.returns(new SecretHandler());
	};

	const originalEnv = { ...process.env };

	let ssmClientMock;

	beforeEach(() => {

		DatabaseDispatcher.clearCache();

		process.env.JANIS_ENV = 'beta';
		process.env.JANIS_SERVICE_NAME = 'service-name';

		ssmClientMock = mockClient(SSMClient);

		mockRequire('@janiscommerce/mongodb', DBDriver);

		sinon.stub(Settings, 'get')
			.withArgs('database')
			.returns(settings);
	});

	afterEach(() => {

		process.env = { ...originalEnv };

		ssmClientMock.reset();

		sinon.restore();
		mockRequire.stopAll();
	});

	const stubParameterResolves = parameter => {
		ssmClientMock
			.on(GetParameterCommand)
			.resolves({ Parameter: { Value: JSON.stringify(parameter) } });
	};

	const stubParameterNotFound = () => {
		ssmClientMock
			.on(GetParameterCommand)
			.rejects(new Error('Parameter not found', { code: 'ParameterNotFound' }));
	};

	describe('DBDriver dispatching', () => {

		context('When client is not injected (core model)', () => {

			it('Should reject when default databaseKey not found in Settings nor ParameterStore', async () => {

				const myEmptyModel = new EmptyModel();

				stubParameterNotFound();

				await assert.rejects(() => myEmptyModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should reject when config does not have the required type field', async () => {

				stubGetSecret();

				stubParameterNotFound();

				const { type, ...writeSettingsWithoutType } = settings.core.write;

				Settings.get.withArgs('database')
					.returns({ core: { write: writeSettingsWithoutType } });

				const myCoreModel = new CoreModel();

				await assert.rejects(myCoreModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.MISSING_TYPE
				});
			});

			it('Should reject when the required DBDriver is not installed', async () => {

				stubGetSecret();

				stubParameterNotFound();

				Settings.get.withArgs('database')
					.returns({ core: { write: { ...settings.core.write, type: 'unknown-driver' } } });

				const myCoreModel = new CoreModel();

				await assert.rejects(myCoreModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_DRIVER_NOT_INSTALLED
				});
			});

			it('Should reject when the required DBDriver rejects while creating instance', async () => {

				stubGetSecret();

				stubParameterNotFound();

				Settings.get.withArgs('database')
					.returns({ core: { write: { ...settings.core.write, fail: true } } });

				const myCoreModel = new CoreModel();

				await assert.rejects(myCoreModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.INVALID_DB_DRIVER
				});
			});

			it('Should call DBDriver get using local settings when it exists', async () => {

				stubGetSecret();

				stubParameterNotFound();

				sinon.stub(DBDriver.prototype, 'get')
					.resolves();

				const myCoreModel = new CoreModel();

				await myCoreModel.get();

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myCoreModel, {});

				await assertDbDriverConfig(myCoreModel, settings.core.write);
			});
		});

		context('When client is injected (client model)', () => {

			it('Should call DBDriver get using client config when it exists', async () => {

				stubGetSecret();

				stubParameterNotFound();

				sinon.stub(DBDriver.prototype, 'get')
					.resolves();

				const myClientModel = new ClientModel();

				await myClientModel.get();

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myClientModel, {});

				await assertDbDriverConfig(myClientModel, client.databases.default.write);
			});

			it('Should call DBDriver get using read DB when readonly param is true', async () => {

				stubGetSecret();

				stubParameterNotFound();

				sinon.stub(DBDriver.prototype, 'get')
					.resolves();

				const myClientModel = new ClientModel();

				await myClientModel.get({ readonly: true });

				sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, myClientModel, { readonly: true });

				await assertDbDriverConfig(myClientModel, client.databases.default.read);
			});

			Object.entries({
				insert: { foo: 'bar' },
				update: { foo: 'bar' },
				save: { foo: 'bar' },
				remove: { foo: 'bar' },
				multiInsert: [{ foo: 'bar' }],
				multiSave: [{ foo: 'bar' }],
				multiRemove: [{ foo: 'bar' }],
				multiUpdate: [{ data: { foo: 'bar' } }]
			}).forEach(([method, params]) => {
				it(`Should call DBDriver using write DB when ${method} is executed after a readonly get`, async () => {

					stubGetSecret();

					stubParameterNotFound();

					sinon.stub(DBDriver.prototype, method)
						.resolves();

					const myClientModel = new ClientModel();

					await myClientModel.get({ readonly: true });

					await assertDbDriverConfig(myClientModel, client.databases.default.read);

					await myClientModel[method](params);

					await assertDbDriverConfig(myClientModel, client.databases.default.write);
				});
			});

			it('Should call DBDriver using write config DB when dropDatabase is executed', async () => {

				sinon.stub(DBDriver.prototype, 'dropDatabase')
					.resolves();

				stubParameterNotFound();

				stubGetSecret();

				const myClientModel = new ClientModel();

				await myClientModel.dropDatabase();

				await assertDbDriverConfig(myClientModel, client.databases.default.write);
			});
		});
	});

	describe('Settings validations', () => {

		beforeEach(() => {
			stubParameterNotFound();
		});

		const rejects = async code => {
			const coreModel = new CoreModel();
			await assert.rejects(coreModel.getDb(), {
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
				.returns({ unknownKey: {} });

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the database settings is not an object (is a string)', async () => {

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

		let clientModel;

		beforeEach(() => {
			clientModel = new ClientModel();
			stubParameterNotFound();
		});

		const rejects = async code => {
			await assert.rejects(clientModel.getDb(), {
				name: 'ModelError',
				code
			});
		};

		it('Should throw when client not exists', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => null);

			await rejects(ModelError.codes.INVALID_CLIENT);
		});

		it('Should throw when \'client\' database config is not an object', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => ({ databases: 'not an object' }));

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when \'clients\' database config is an array', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => ({ databases: ['not an object'] }));

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the specific database key do not exist', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => ({ databases: { unknownKey: {} } }));

			await rejects(ModelError.codes.DB_CONFIG_NOT_FOUND);
		});

		it('Should throw when the database key is not an object', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => ({ databases: { default: 'not an object' } }));

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});

		it('Should throw when the database key is an array', async () => {

			sinon.stub(clientModel.session, 'client')
				.get(() => ({ databases: { default: ['not an object'] } }));

			await rejects(ModelError.codes.INVALID_DB_CONFIG);
		});
	});

	describe('Fetching credentials (AWS Secrets Manager)', () => {

		beforeEach(() => {
			stubParameterNotFound();
		});

		it('Should fetch credentials for read config database', async () => {

			sinon.stub(DBDriver.prototype, 'get')
				.resolves();

			stubGetSecret({
				databases: {
					default: {
						write: { writeExtraData: 123 },
						read: { readExtraData: 123 },
						admin: { adminExtraData: 123 }
					}
				}
			});

			const clientModel = new ClientModel();

			await clientModel.get({ readonly: true });

			sinon.assert.calledOnceWithExactly(DBDriver.prototype.get, clientModel, { readonly: true });

			await assertDbDriverConfig(clientModel, {
				...client.databases.default.read,
				readExtraData: 123
			});

			sinon.assert.calledOnceWithExactly(AwsSecretsManager.secret, 'service-name');
		});

		it('Should fetch credentials for write config database', async () => {

			sinon.stub(DBDriver.prototype, 'save')
				.resolves();

			stubGetSecret({
				databases: {
					default: {
						write: { writeExtraData: 123 },
						read: { readExtraData: 123 },
						admin: { adminExtraData: 123 }
					}
				}
			});

			const clientModel = new ClientModel();

			await clientModel.save({ code: 'clientCode', foo: 'bar' });

			sinon.assert.calledOnce(DBDriver.prototype.save);

			await assertDbDriverConfig(clientModel, {
				...client.databases.default.write,
				writeExtraData: 123
			});
		});

		it('Shouldn\'t fetch credentials when config has the skip config set', async () => {

			sinon.stub(DBDriver.prototype, 'save')
				.resolves();

			sinon.spy(AwsSecretsManager, 'secret');
			sinon.spy(SecretHandler.prototype, 'getValue');

			const clientModel = new ClientModel();

			sinon.stub(clientModel.session, 'client')
				.get(() => ({
					databases: {
						default: {
							write: {
								...client.databases.default.write,
								skipFetchCredentials: true
							}
						}
					}
				}));

			await clientModel.save({ code: 'clientCode', foo: 'bar' });

			sinon.assert.calledOnce(DBDriver.prototype.save);

			sinon.assert.notCalled(AwsSecretsManager.secret);
			sinon.assert.notCalled(SecretHandler.prototype.getValue);
		});

		it('Shouldn\'t fetch credentials when the environment is local', async () => {

			process.env.JANIS_ENV = 'local';

			sinon.stub(DBDriver.prototype, 'save')
				.resolves();

			sinon.spy(AwsSecretsManager, 'secret');
			sinon.spy(SecretHandler.prototype, 'getValue');

			const clientModel = new ClientModel();

			await clientModel.save({ code: 'clientCode', foo: 'bar' });

			sinon.assert.calledOnce(DBDriver.prototype.save);

			sinon.assert.notCalled(AwsSecretsManager.secret);
			sinon.assert.notCalled(SecretHandler.prototype.getValue);
		});

		it('Shouldn\'t reject when instance the secretHandler', async () => {

			sinon.stub(DBDriver.prototype, 'save')
				.resolves();

			sinon.stub(AwsSecretsManager, 'secret')
				.throws(new Error('some secret handler error'));

			const clientModel = new ClientModel();

			await clientModel.save({ code: 'clientCode', foo: 'bar' });

			await assertDbDriverConfig(clientModel, client.databases.default.write);
		});

		it('Shouldn\'t reject when getting credentials rejects', async () => {

			sinon.stub(DBDriver.prototype, 'save')
				.resolves();

			sinon.stub(AwsSecretsManager, 'secret')
				.returns(new SecretHandler());

			sinon.stub(SecretHandler.prototype, 'getValue')
				.rejects(new Error('some getting credentials error'));

			const clientModel = new ClientModel();

			await clientModel.save({ code: 'clientCode', foo: 'bar' });

			await assertDbDriverConfig(clientModel, client.databases.default.write);
		});
	});

	describe('Reading config from ParameterStore', () => {

		const databases = {
			[databaseId]: {
				type: 'mongodb',
				connectionString: 'mongodb//the-host.mongodb.net/?retryWrites=true&w=majority&authSource=%24external&authMechanism=MONGODB-AWS'
			}
		};

		beforeEach(() => {
			Settings.get.withArgs('database')
				.returns({});
		});

		context('When client is not injected (core model)', () => {

			it('Should reject when databaseKey not found in coreDatabases', async () => {

				stubParameterResolves({
					coreDatabases: { otherCoreDB: { id: databaseId, dbName: 'great-core-db' } }
				});

				const coreModel = new CoreModel();

				await assert.rejects(() => coreModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should reject when database not found in databases (id not matching)', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: '6720d5e4a63ad41061c00dea', database: 'my-service-core' } },
					databases
				});

				const coreModel = new CoreModel();

				await assert.rejects(() => coreModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should call DBDriver when matches the databaseKey with the config', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: databaseId, database: 'my-service-core' } },
					databases
				});

				const coreModel = new CoreModel();

				await assertDbDriverConfig(coreModel, {
					...databases[databaseId],
					database: 'my-service-core'
				});

				await assert.doesNotReject(coreModel.get());
			});
		});

		context('When client is injected (client model)', () => {

			it('Should reject when no session found', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: databaseId, database: 'my-service-core' } },
					databases
				});

				const emptyModel = new EmptyModel();

				await assert.rejects(() => emptyModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should reject when databaseKey not found in client db field', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: databaseId, database: 'my-service-core' } },
					databases
				});

				const nonDefaultClientModel = new NonDefaultClientModel();

				await assert.rejects(() => nonDefaultClientModel.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should reject when databaseKey found in client db field but Database not found in ParameterStore', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: otherDatabaseId, database: 'my-service-core' } },
					databases: {
						[otherDatabaseId]: {
							type: 'mongodb',
							connectionString: 'mongodb//the-host.mongodb.net/?retryWrites=true&w=majority&authSource=%24external&authMechanism=MONGODB-AWS'
						}
					}
				});

				const model = new NonDefaultClientModel();

				await assert.rejects(() => model.get(), {
					name: 'ModelError',
					code: ModelError.codes.DB_CONFIG_NOT_FOUND
				});
			});

			it('Should call DBDriver when databaseKey found in client db field and Database found in ParameterStore', async () => {

				stubParameterResolves({
					coreDatabases: { core: { id: databaseId, database: 'my-service-core' } },
					databases
				});

				const model = new ClientModel();

				await assertDbDriverConfig(model, {
					...databases[databaseId],
					database: client.db.default.database
				});

				await assert.doesNotReject(model.get());
			});
		});
	});
});
