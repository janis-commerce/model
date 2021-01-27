'use strict';

const Settings = require('@janiscommerce/settings');
const md5 = require('md5');

const isObject = require('./is-object');

const ModelError = require('../model-error');

const JANISCOMMERCE_SCOPE = '@janiscommerce';

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

	get scope() {
		return JANISCOMMERCE_SCOPE;
	}

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
	 * Check if the databaseKey settings has read DB
	 * @param {string} key databaseKey
	 * @returns {Promise<boolean>}
	 */
	async hasReadDb(key) {

		if(this.config[key])
			return false; // Return false if the received key is a core database

		const client = await this.session.client;

		return !!(
			client
			&& client.databases
			&& client.databases[key]
			&& client.databases[key].read
		);
	}

	/**
	 * Get No Client Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getDatabaseByKey(key, useReadDB) {

		const dbConfig = this.config[key];

		if(!dbConfig) {

			if(this.session)
				return this.getClientDatabaseByKey(key, useReadDB);

			throw new ModelError(`Database config not found for databaseKey '${key}' in settings`, ModelError.codes.DB_CONFIG_NOT_FOUND);
		}

		return this._getDatabaseByConfig(dbConfig, useReadDB);
	}

	/**
	 * Get Client Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getClientDatabaseByKey(key, useReadDB) {

		const client = await this.session.client;

		if(!client || !isObject(client.databases))
			throw new ModelError('Invalid client', ModelError.codes.INVALID_CLIENT);

		const dbConfig = client.databases[key];

		if(!dbConfig)
			throw new ModelError(`Database config not found for databaseKey '${key}' in client`, ModelError.codes.DB_CONFIG_NOT_FOUND);

		return this._getDatabaseByConfig(dbConfig, useReadDB);
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @param {boolean} useReadDB
	 * @returns {DBDriver}
	 * @private
	 */
	_getDatabaseByConfig(dbConfig, useReadDB) {

		const targetDbConfig = useReadDB && dbConfig.read ? dbConfig.read : dbConfig.write;

		if(!isObject(targetDbConfig))
			throw new ModelError('Database read/write setting not found in database config', ModelError.codes.INVALID_DB_CONFIG);

		return this._getDatabaseFromCache(targetDbConfig);
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @returns {DBDriver}
	 * @private
	 */
	_getDatabaseFromCache(dbConfig) {

		if(!this.databases) {
			/** @private */
			this.databases = {};
		}

		const cacheKey = md5(JSON.stringify(dbConfig));

		if(!this.databases[cacheKey])
			this.databases[cacheKey] = this._getDBDriver(dbConfig);

		return this.databases[cacheKey];
	}

	/**
	 * @param {DBConfig} config
	 * @returns {DBDriver}
	 * @private
	 */
	_getDBDriver(config) {

		let DBDriver;

		try {

			DBDriver = require(`${this.scope}/${config.type}`); // eslint-disable-line

		} catch(err) {
			throw new ModelError(`Package "${config.type}" not installed or not exists`, ModelError.codes.DB_DRIVER_NOT_INSTALLED, err);
		}

		try {

			return new DBDriver(config);

		} catch(err) {
			throw new ModelError(`Package "${config.type}" error creating instance: ${err.message}`, ModelError.codes.INVALID_DB_DRIVER, err);
		}
	}
};
