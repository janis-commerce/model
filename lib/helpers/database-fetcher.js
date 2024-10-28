'use strict';

const Settings = require('@janiscommerce/settings');
const md5 = require('md5');

const isObject = require('./is-object');

const ModelError = require('../model-error');
const CredentialsFetcher = require('./credentials-fetcher');
const ParameterStore = require('./parameter-store');

const databasesCache = {};

/**
 * @typedef DBConfig
 * @property {string} type
 * @property {string} protocol
 * @property {string} host
 * @property {string} [user]
 * @property {string} [password]
 * @property {string|number} [port]
 * @property {string} database
 */

/**
 * @typedef DBConfigs
 * @property {DBConfig} write
 * @property {DBConfig} [read]
 */

/** @typedef {import('../model').DBDriver} DBDriver */

module.exports = class DatabaseDispatcher {

	/**
	 * @type {DBConfigs}
	 */
	get config() {

		if(!this._config) {

			const settings = Settings.get('database') || {};

			if(!isObject(settings))
				throw new ModelError('Invalid config file, should be an object', ModelError.codes.INVALID_SETTINGS);

			/** @private */
			this._config = settings;
		}

		return this._config;
	}

	/**
	 * Get Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getDb(key, useReadDB) {

		await this.setParameterStore();

		const coreDatabaseConfig = this.getCoreDatabaseConfig(key);

		if(coreDatabaseConfig)
			return this.getDatabaseByConfig(coreDatabaseConfig, key);

		if(this.config[key])
			return this.getDatabaseByConfig(this.config[key], key, useReadDB);

		if(this.session)
			return this.getClientDatabaseByKey(key, useReadDB);

		// eslint-disable-next-line max-len
		throw new ModelError(`Database config not found for databaseKey '${key}' in settings and no client session found`, ModelError.codes.DB_CONFIG_NOT_FOUND);
	}

	async setParameterStore() {
		await ParameterStore.set();
	}

	getCoreDatabaseConfig(key) {
		const coreDatabase = ParameterStore.getCoreDatabase(key);
		return coreDatabase && ParameterStore.getDatabaseConfig(coreDatabase);
	}

	/**
	 * Get Client Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getClientDatabaseByKey(key, useReadDB) {

		const client = await this.session.client;

		if(!client)
			throw new ModelError('Invalid client', ModelError.codes.INVALID_CLIENT);

		if(!isObject(client.databases) && !isObject(client.db))
			throw new ModelError('Missing databases config for client', ModelError.codes.DB_CONFIG_NOT_FOUND);

		let dbConfig;

		if(client.db?.[key])
			dbConfig = ParameterStore.getDatabaseConfig(client.db?.[key]);
		else
			dbConfig = client.databases?.[key];

		if(!dbConfig)
			throw new ModelError(`Database config not found for databaseKey '${key}' in client`, ModelError.codes.DB_CONFIG_NOT_FOUND);

		return this.getDatabaseByConfig(dbConfig, key, useReadDB);
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB
	 * @returns {DBDriver}
	 * @private
	 */
	getDatabaseByConfig(dbConfig, key, useReadDB) {

		let targetDbConfig;

		if(useReadDB && dbConfig.read)
			targetDbConfig = dbConfig.read;
		else
			targetDbConfig = dbConfig.write;

		if(!isObject(targetDbConfig))
			throw new ModelError(`Invalid read/write db setting found for ${key}`, ModelError.codes.INVALID_DB_CONFIG);

		// para asegurarse usar el cache correcto
		targetDbConfig.databaseKey = key;
		targetDbConfig.useReadDB = !!useReadDB;

		return this.getDatabaseFromCache(targetDbConfig);
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @returns {DBDriver}
	 * @private
	 */
	async getDatabaseFromCache(dbConfig) {

		const cacheKey = md5(JSON.stringify(dbConfig));

		if(!databasesCache[cacheKey]) {

			if(this.shouldFetchCredentials(dbConfig))
				dbConfig = await CredentialsFetcher.fetch(dbConfig);

			databasesCache[cacheKey] = this.getDriverInstance(dbConfig);
		}

		return databasesCache[cacheKey];
	}

	shouldFetchCredentials({ skipFetchCredentials }) {
		return process.env.JANIS_ENV !== 'local' && skipFetchCredentials !== true;
	}

	/**
	 * @param {DBConfig} config
	 * @returns {DBDriver}
	 * @private
	 */
	getDriverInstance(config) {

		if(!config.type)
			throw new ModelError('Missing type in db config', ModelError.codes.MISSING_TYPE);

		let DriverPackage;

		try {

			DriverPackage = require(`@janiscommerce/${config.type}`); // eslint-disable-line

		} catch(err) {
			throw new ModelError(`Package "${config.type}" not installed or not exists`, ModelError.codes.DB_DRIVER_NOT_INSTALLED, err);
		}

		try {

			return new DriverPackage(config);

		} catch(err) {
			throw new ModelError(`Package "${config.type}" error creating instance: ${err.message}`, ModelError.codes.INVALID_DB_DRIVER, err);
		}
	}
};
