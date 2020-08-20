'use strict';

const path = require('path');
const Settings = require('@janiscommerce/settings');
const md5 = require('md5');

const ModelError = require('../model-error');

const JANISCOMMERCE_SCOPE = '@janiscommerce';

class DatabaseDispatcher {

	static get scope() {
		return JANISCOMMERCE_SCOPE;
	}

	static set config(config) {
		this._config = config;
	}

	static set clientConfig(config) {
		this._clientConfig = config;
	}

	static get config() {

		if(typeof this._config === 'undefined') {

			const settings = Settings.get('database') || {};

			if(typeof settings !== 'object' || Array.isArray(settings))
				throw new ModelError('Invalid config file, should be an object', ModelError.codes.INVALID_SETTINGS);

			this.config = settings;
		}

		return this._config;
	}

	static get clientConfig() {

		if(typeof this._clientConfig === 'undefined') {

			const settings = Settings.get('clients');

			if(!settings || !settings.database || typeof settings.database.fields !== 'object' || Array.isArray(settings.database.fields))
				throw new ModelError('Invalid client config file', ModelError.codes.INVALID_SETTINGS);

			this.clientConfig = settings.database.fields;
		}

		return this._clientConfig;
	}

	static get databaseWriteType() {

		if(typeof this._databaseWriteType === 'undefined') {

			const settings = Settings.get('databaseWriteType');

			if(typeof settings !== 'string')
				throw new ModelError('Invalid DB type in config', ModelError.codes.DB_CONFIG_TYPE_INVALID);

			this._databaseWriteType = settings;
		}

		return this._databaseWriteType;
	}

	static get databaseReadType() {

		if(typeof this._databaseReadType === 'undefined') {

			const settings = Settings.get('databaseReadType');
			this._databaseReadType = settings;
		}

		return this._databaseReadType;
	}

	static getDatabaseByKey(key = '_default') {

		const dbConfig = this.config[key];

		if(!dbConfig) {

			if(Object.keys(this.config).length === 0)
				throw new ModelError('Config not found', ModelError.codes.SETTINGS_NOT_FOUND);

			throw new ModelError(`DB Config not found for '${key}'`, ModelError.codes.DB_CONFIG_NOT_FOUND);
		}

		return this.getDatabaseByConfig(dbConfig);
	}

	static getDatabaseByConfig(dbConfig) {

		if(typeof dbConfig !== 'object' || Array.isArray(dbConfig))
			throw new ModelError('DB type setting not found in dbConfig', ModelError.codes.INVALID_DB_CONFIG);

		dbConfig.type = dbConfig.type || this.databaseWriteType;

		return this._getDatabaseFromCache(dbConfig);
	}

	static _getDatabaseFromCache(dbConfig) {

		if(!this.databases)
			this.databases = {};

		const cacheKey = md5(JSON.stringify(dbConfig));

		if(!this.databases[cacheKey])
			this.databases[cacheKey] = this._getDBDriver(dbConfig);

		return this.databases[cacheKey];
	}

	/**
	 * Get Client Database
	 * @param {object} client Client Object
	 * @param {boolean} userReadDB If It's Read or Write Database
	 */
	static getDatabaseByClient(client, userReadDB) {

		if(typeof client !== 'object' || Array.isArray(client))
			throw new ModelError('Invalid client', ModelError.codes.INVALID_CLIENT);

		const config = this._configMapper(client, userReadDB);

		config.type = !userReadDB ? this.databaseWriteType : this.databaseReadType || this.databaseWriteType;

		return this._getDatabaseFromCache(config);

	}

	static _configMapper(client, userReadDB) {

		const config = {};

		const configMap = !userReadDB ? this.clientConfig.write : this.clientConfig.read || this.clientConfig.write;

		if(typeof configMap !== 'object' || Array.isArray(configMap))
			throw new ModelError('Invalid client config settings', ModelError.codes.INVALID_SETTINGS);

		for(const [clientField, driverField] of Object.entries(configMap)) {
			if(client[clientField] !== undefined)
				config[driverField] = client[clientField];
		}

		if(!Object.keys(config).length)
			throw new ModelError('Invalid client config object, it is empty', ModelError.codes.INVALID_CLIENT);

		return config;
	}

	/**
	 * Evaluates the config object then returns the selected DBDriver
	 *
	 * @param {object} database config
	 * @returns DBDriver
	 */
	static _getDBDriver(config) {

		let DBDriver;

		try {
			DBDriver = require(path.join(process.cwd(), 'node_modules', this.scope , config.type)); //eslint-disable-line
		} catch(err) {
			throw new ModelError(
				`Package "${config.type}" not installed or not exists`,
				ModelError.codes.DB_DRIVER_NOT_INSTALLED);
		}

		try {
			return new DBDriver(config);
		} catch(err) {
			throw new ModelError(`Package "${config.type}" error creating instance: ${err.message}`,
				ModelError.codes.INVALID_DB_DRIVER);
		}
	}

	/**
	 * Clear config json and database connections caches
	 */
	static clearCache() {
		delete this.databases;
		this._config = undefined;
		this._clientConfig = undefined;
		this._databaseWriteType = undefined;
		this._databaseReadType = undefined;
	}
}

module.exports = DatabaseDispatcher;
