'use strict';

const assert = require('assert');
const mock = require('mock-require');
const path = require('path');

const Settings = require('@janiscommerce/settings');

const sandbox = require('sinon').createSandbox();

const DatabaseDispatcher = require('../lib/helpers/database-dispatcher');
const ModelError = require('../lib/model-error');

/* eslint-disable prefer-arrow-callback */

describe('DatabaseDispatcher', () => {

	const databasesSettings = {
		_default: {
			type: 'someDatabase',
			host: 'sampleDatabase',
			port: 1234,
			protocol: 'sample',
			user: 'example',
			password: 'examplePass123',
			database: 'databaseTable'
		},
		core: {
			host: 'coreDatabase',
			port: 1234,
			protocol: 'core',
			user: 'example',
			password: 'examplePass123',
			database: 'coreTable'
		},
		almostGood: {
			type: 'someDatabase',
			host: 'notGoodDatabase',
			port: 1234,
			user: 'example',
			password: 'examplePass123',
			database: 'notGoodTable'
		},
		bad: 'badDatabase:1234',
		otherBad: ['otherDatabase', 1234, 'table']
	};

	const sampleClient = {
		dbHost: 'sampleClient',
		dbPort: 1234,
		dbProtocol: 'sample',
		dbUser: 'example',
		dbPassword: 'examplePass123',
		dbDatabase: 'clientTable'
	};

	const clientSettings = {
		database: {
			fields: {
				read: {
					dbHost: 'host',
					dbPort: 'port',
					dbProtocol: 'protocol',
					dbUser: 'user',
					dbPassword: 'password',
					dbDatabase: 'database'
				},
				write: {
					dbHost: 'host',
					dbPort: 'port',
					dbProtocol: 'protocol',
					dbUser: 'user',
					dbPassword: 'password',
					dbDatabase: 'database'
				}
			}
		}
	};

	class DBDriverMock {
		constructor(config = {}) {
			if(!config.protocol)
				throw new Error('Database Error');

			this.config = {
				host: config.host,
				user: config.user,
				password: config.password,
				database: config.database || null,
				port: config.port
			};
		}
	}

	const databaseMock = dbDriverMock => {
		mock(path.join(process.cwd(), 'node_modules', DatabaseDispatcher.scope, 'someDatabase'), dbDriverMock || DBDriverMock);
	};

	afterEach(() => {
		mock.stopAll();
		DatabaseDispatcher.clearCache();
		sandbox.restore();
	});

	const assertSettings = (calledTimes, args) => {
		sandbox.assert.callCount(Settings.get, calledTimes);
		args.forEach(argument => sandbox.assert.calledWithExactly(Settings.get, argument));
	};

	const assertThrowDatabaseKey = (errorCode, key) => {
		assert.throws(() => DatabaseDispatcher.getDatabaseByKey(key), { code: errorCode });
	};

	const assertThrowDatabaseClient = (errorCode, client, readOnly) => {
		assert.throws(() => DatabaseDispatcher.getDatabaseByClient(client, readOnly), { code: errorCode });
	};


	context('When Settings config are missing', () => {

		describe('Get Database by Key', () => {

			it('Should throw error if databases key do not exist ', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns();

				assertThrowDatabaseKey(ModelError.codes.SETTINGS_NOT_FOUND);
				assertSettings(1, ['database']);
			});

			it('Should throw error if the especific database key do not exist ', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				assertThrowDatabaseKey(ModelError.codes.DB_CONFIG_NOT_FOUND, 'super');
				assertSettings(1, ['database']);
			});

			it('Should throw error if \'type\' is not define in configs neither \'databaseWriteType\' ', () => {

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('database')
					.returns(databasesSettings);

				stubSettings.withArgs('databaseWriteType')
					.returns();

				assertThrowDatabaseKey(ModelError.codes.DB_CONFIG_TYPE_INVALID, 'core');
				assertSettings(2, ['database', 'databaseWriteType']);
			});
		});

		describe('Get Database by Client', () => {

			it('Should throw error if no \'clients\' settings', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns();

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if no \'clients.database\' settings', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns({ fields: {} });

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if no \'clients.database.fields\' settings', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns({ database: { fakeFields: {} } });

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if no \'clients.database.fields.write\' settings', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns({ database: { fields: {} } });

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if no \'fields.read\' neither \'fields.read\' settings and try to get Read Database', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns({ database: { fields: {} } });

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if no \'databaseWriteType\' settings', () => {

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('clients')
					.returns(clientSettings);

				stubSettings.withArgs('databaseWriteType')
					.returns();

				assertThrowDatabaseClient(ModelError.codes.DB_CONFIG_TYPE_INVALID, sampleClient);
				assertSettings(2, ['clients', 'databaseWriteType']);
			});

			it('Should throw error if no \'databaseReadType\' neither \'databaseWriteType\' settings and try to get Read Database', () => {

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('clients')
					.returns(clientSettings);

				stubSettings.withArgs('databaseWriteType')
					.returns();

				stubSettings.withArgs('databaseReadType')
					.returns();

				assertThrowDatabaseClient(ModelError.codes.DB_CONFIG_TYPE_INVALID, sampleClient, true);
				assertSettings(3, ['clients', 'databaseWriteType', 'databaseReadType']);
			});
		});

	});

	context('when some data has incorrect formats', () => {

		describe('Get Database By Key', () => {

			it('Should throw error if the database field is not an object', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns('databases');

				assertThrowDatabaseKey(ModelError.codes.INVALID_SETTINGS);
				assertSettings(1, ['database']);
			});

			it('Should throw error if the database field is an array', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns([databasesSettings]);

				assertThrowDatabaseKey(ModelError.codes.INVALID_SETTINGS);
				assertSettings(1, ['database']);
			});

			it('Should throw error if the database key is not an object', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				assertThrowDatabaseKey(ModelError.codes.INVALID_DB_CONFIG, 'bad');
				assertSettings(1, ['database']);
			});

			it('Should throw error if the database key is an array', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				assertThrowDatabaseKey(ModelError.codes.INVALID_DB_CONFIG, 'otherBad');
				assertSettings(1, ['database']);
			});
		});

		describe('Get Database By Client', () => {

			it('Should throw error if client object is an array', () => {
				assertThrowDatabaseClient(ModelError.codes.INVALID_CLIENT, [sampleClient]);
			});

			it('Should throw error if \'clients\' settings is not an object', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns('clientDatabase');

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if \'clients\' settings is an array', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns([clientSettings]);

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if \'database.fields\' settings is an array', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns({ database: { fields: { write: ['database'] } } });

				assertThrowDatabaseClient(ModelError.codes.INVALID_SETTINGS, sampleClient);
				assertSettings(1, ['clients']);
			});

			it('Should throw error if client cannot be mapped correctly', () => {

				sandbox.stub(Settings, 'get')
					.withArgs('clients')
					.returns(clientSettings);

				assertThrowDatabaseClient(ModelError.codes.INVALID_CLIENT, databasesSettings.core);
				assertSettings(1, ['clients']);
			});
		});
	});

	context('when Settings configs exists', () => {

		describe('Get Database by Key', () => {

			it('Should throw Error if database type has not been installed or exists', () => {
				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				assertThrowDatabaseKey(ModelError.codes.DB_DRIVER_NOT_INSTALLED);

				assertSettings(1, ['database']);
			});

			it('Should throw Error if cannot create a database instance', () => {
				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				databaseMock();

				assertThrowDatabaseKey(ModelError.codes.INVALID_DB_DRIVER, 'almostGood');
				assertSettings(1, ['database']);
			});

			it('Should return Database Driver instance if it is installed', () => {
				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				databaseMock();

				let dbDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByKey();
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(1, ['database']);
			});

			it('Should return Database Driver instance if it is installed and use \'databaseWriteType\' as default type', () => {
				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('database')
					.returns(databasesSettings);

				stubSettings.withArgs('databaseWriteType')
					.returns('someDatabase');

				databaseMock();

				let dbDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByKey('core');
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(2, ['database', 'databaseWriteType']);
			});

			it('Should return Database Driver instance if it is installed and used cache', () => {

				sandbox.spy(DatabaseDispatcher, '_getDBDriver');

				sandbox.stub(Settings, 'get')
					.withArgs('database')
					.returns(databasesSettings);

				databaseMock();

				let dbDriver;
				let SameDBDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByKey();
					SameDBDriver = DatabaseDispatcher.getDatabaseByKey();
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(1, ['database']);

				sandbox.assert.calledOnce(DatabaseDispatcher._getDBDriver); // eslint-disable-line

				assert.deepEqual(dbDriver, SameDBDriver);
			});
		});

		describe('Get Database by Client', () => {

			it('Should return Write Database Instance when Write database is required and used cache', () => {

				sandbox.spy(DatabaseDispatcher, '_getDBDriver');

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('clients')
					.returns(clientSettings);

				stubSettings.withArgs('databaseWriteType')
					.returns('someDatabase');

				databaseMock();

				let dbDriver;
				let SameDBDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByClient(sampleClient);
					SameDBDriver = DatabaseDispatcher.getDatabaseByClient(sampleClient, false);
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(2, ['clients', 'databaseWriteType']);

				sandbox.assert.calledOnce(DatabaseDispatcher._getDBDriver); // eslint-disable-line

				assert.deepEqual(dbDriver, SameDBDriver);
			});

			it('Should return Read Database Instance when Read database is required and used cache', () => {

				sandbox.spy(DatabaseDispatcher, '_getDBDriver');

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('clients')
					.returns(clientSettings);

				stubSettings.withArgs('databaseReadType')
					.returns('someDatabase');

				databaseMock();

				let dbDriver;
				let SameDBDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByClient(sampleClient, true);
					SameDBDriver = DatabaseDispatcher.getDatabaseByClient(sampleClient, true);
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(2, ['clients', 'databaseReadType']);

				sandbox.assert.calledOnce(DatabaseDispatcher._getDBDriver); // eslint-disable-line

				assert.deepEqual(dbDriver, SameDBDriver);
			});

			it('Should return Write Database Instance when Read one is required but it is not define and used Write as default', () => {

				const stubSettings = sandbox.stub(Settings, 'get');

				stubSettings.withArgs('clients')
					.returns({ database: { fields: { write: clientSettings.database.fields.write } } });

				stubSettings.withArgs('databaseWriteType')
					.returns('someDatabase');

				stubSettings.withArgs('databaseReadType')
					.returns();

				databaseMock();

				let dbDriver;

				assert.doesNotThrow(() => {
					dbDriver = DatabaseDispatcher.getDatabaseByClient(sampleClient, true);
				});

				assert(dbDriver.constructor.name === 'DBDriverMock');

				assertSettings(3, ['clients', 'databaseWriteType', 'databaseReadType']);
			});
		});


	});
});
