/* eslint-disable max-len */

'use strict';

const Settings = require('@janiscommerce/settings');
const md5 = require('md5');

const logger = require('lllog')();

const isObject = require('./is-object');

const ModelError = require('../model-error');
const CredentialsFetcher = require('./credentials-fetcher');
const ParameterStore = require('./parameter-store');

let databasesCache = {};
let settings;

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
	 * Get Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getDb(key, useReadDB) {

		await this.setParameterStore();

		let coreDatabaseConfig = this.getCoreDatabaseConfig(key);

		if(coreDatabaseConfig) {
			logger.info('Database dispatched using ParameterStore (core model)');
			return this.getDatabaseFromCache(coreDatabaseConfig, key);
		}

		coreDatabaseConfig = this.getCoreDatabaseConfigFromSettings(key);

		if(coreDatabaseConfig) {
			logger.info('Database dispatched using settings file (core model)');
			coreDatabaseConfig = await this.formatConfig(key, coreDatabaseConfig, useReadDB);
			return this.getDatabaseFromCache(coreDatabaseConfig, key);
		}

		if(!this.session)
			throw new ModelError(`Core Database '${key}' not found and no client session injected`, ModelError.codes.DB_CONFIG_NOT_FOUND);

		await this.validateClient();

		const client = await this.session.client;

		let clientDatabaseConfig = this.getClientDatabaseConfig(key, client);

		if(clientDatabaseConfig) {
			logger.info('Database dispatched using ParameterStore (client model)');
			return this.getDatabaseFromCache(clientDatabaseConfig, key);
		}

		clientDatabaseConfig = await this.getClientDatabaseConfigFromClient(key, client);

		if(clientDatabaseConfig) {
			logger.info('Database dispatched using client credentials (client model)');
			clientDatabaseConfig = await this.formatConfig(key, clientDatabaseConfig, useReadDB);
			return this.getDatabaseFromCache(clientDatabaseConfig, key);
		}

		throw new ModelError(`Database config not found for databaseKey '${key}' in settings and no client session found`, ModelError.codes.DB_CONFIG_NOT_FOUND);
	}

	async setParameterStore() {
		await ParameterStore.set();
	}

	getCoreDatabaseConfig(key) {
		const coreDatabase = ParameterStore.getCoreDatabase(key);
		return coreDatabase && ParameterStore.getDatabaseConfig(coreDatabase);
	}

	getClientDatabaseConfig(key, client) {
		return client.db?.[key] && ParameterStore.getDatabaseConfig(client.db[key]);
	}

	/**
	 * @deprecated
	 */
	getCoreDatabaseConfigFromSettings(key) {

		if(!settings) {

			settings = Settings.get('database') || {};

			if(!isObject(settings))
				throw new ModelError('Invalid settings file, must be an object', ModelError.codes.INVALID_SETTINGS);
		}

		return settings[key];
	}

	/**
	 * @deprecated
	 */
	getClientDatabaseConfigFromClient(key, client) {
		return client.databases?.[key];
	}

	async validateClient() {

		const client = await this.session.client;

		if(!client)
			throw new ModelError('Invalid client', ModelError.codes.INVALID_CLIENT);

		if(!isObject(client.databases) && !isObject(client.db))
			throw new ModelError('Missing databases config for client', ModelError.codes.DB_CONFIG_NOT_FOUND);
	}

	/**
	 * @deprecated
	 */
	async formatConfig(key, dbConfig, useReadDB) {

		let targetDbConfig;

		if(useReadDB && dbConfig.read)
			targetDbConfig = dbConfig.read;
		else
			targetDbConfig = dbConfig.write;

		if(!isObject(targetDbConfig))
			throw new ModelError(`Invalid read/write db setting found for ${key}`, ModelError.codes.INVALID_DB_CONFIG);

		if(this.shouldFetchCredentials(targetDbConfig))
			targetDbConfig = await CredentialsFetcher.fetch(key, targetDbConfig, useReadDB);

		return targetDbConfig;
	}

	/**
	 * @deprecated
	 */
	shouldFetchCredentials({ skipFetchCredentials }) {
		return process.env.JANIS_ENV !== 'local' && skipFetchCredentials !== true;
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @param {string} key Database Key
	 * @returns {DBDriver}
	 * @private
	 */
	async getDatabaseFromCache(dbConfig, key) {

		const { host, connectionString } = dbConfig;

		const cacheKey = md5(JSON.stringify({ host, connectionString, key }));

		if(!databasesCache[cacheKey])
			databasesCache[cacheKey] = this.getDriverInstance(dbConfig);

		return databasesCache[cacheKey];
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

	/**
	 * @private
	 */
	static clearCache() {
		databasesCache = {};
		settings = null;
		ParameterStore.parameter = null;
		CredentialsFetcher.secretValue = null;
	}
};
