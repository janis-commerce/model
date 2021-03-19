'use strict';

const Settings = require('@janiscommerce/settings');
const md5 = require('md5');

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

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
	 * @param {boolean} adminAccess If should use Admin Access
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getDatabaseByKey(key, useReadDB, adminAccess) {

		const dbConfig = this.config[key];

		if(!dbConfig) {

			if(this.session)
				return this.getClientDatabaseByKey(key, useReadDB, adminAccess);

			throw new ModelError(`Database config not found for databaseKey '${key}' in settings`, ModelError.codes.DB_CONFIG_NOT_FOUND);
		}

		return this.getDatabaseByConfig(dbConfig, key, useReadDB, adminAccess);
	}

	/**
	 * Get Client Database
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB If It's Read or Write Database
	 * @param {boolean} adminAccess If should use Admin Access
	 * @returns {Promise<DBDriver>} The DBDriver instance
	 */
	async getClientDatabaseByKey(key, useReadDB, adminAccess) {

		const client = await this.session.client;

		if(!client || !isObject(client.databases))
			throw new ModelError('Invalid client', ModelError.codes.INVALID_CLIENT);

		const dbConfig = client.databases[key];

		if(!dbConfig)
			throw new ModelError(`Database config not found for databaseKey '${key}' in client`, ModelError.codes.DB_CONFIG_NOT_FOUND);

		return this.getDatabaseByConfig(dbConfig, key, useReadDB, adminAccess);
	}

	/**
	 * @param {DBConfig} dbConfig
	 * @param {string} key Database Key
	 * @param {boolean} useReadDB
	 * @param {boolean} adminAccess If should use Admin Access
	 * @returns {DBDriver}
	 * @private
	 */
	getDatabaseByConfig(dbConfig, key, useReadDB, adminAccess) {

		let targetDbConfig;

		if(useReadDB && dbConfig.read)
			targetDbConfig = dbConfig.read;
		else if(adminAccess)
			targetDbConfig = dbConfig.admin;
		else
			targetDbConfig = dbConfig.write;

		if(!isObject(targetDbConfig))
			throw new ModelError('Database read/write setting not found in database config', ModelError.codes.INVALID_DB_CONFIG);

		// para asegurarse usar el cache indicado
		targetDbConfig.databaseKey = key;
		targetDbConfig.useReadDB = !!useReadDB;
		targetDbConfig.adminAccess = !!adminAccess;

		return this.getDatabaseFromCache(targetDbConfig);
	}

	/**
	 * @param {string} key Database Key
	 * @param {DBConfig} dbConfig
	 * @returns {DBDriver}
	 * @private
	 */
	getDatabaseFromCache(dbConfig) {

		if(!this.databases) {
			/** @private */
			this.databases = {};
		}

		const cacheKey = md5(JSON.stringify(dbConfig));

		if(!this.databases[cacheKey]) {
			dbConfig = await this.fetchCredentials(dbConfig);
			this.databases[cacheKey] = this.getDBDriver(dbConfig);
		}

		return this.databases[cacheKey];
	}

	fetchCredentials(config) {

		const secretName = process.env.JANIS_SERVICE_NAME;

		const secretHandler = AwsSecretsManager.secret(secretName);

		const secretValue = await secretHandler.getValue();

		const subType = config.adminAccess ? 'write-admin' : (config.hasReadDb ? 'read' : 'write');

		const credentials = secretValue
			&& secretValue[config.databaseKey] 
			&& secretValue[config.databaseKey][subType]

		return { ...config, ...credentials }
	}

	/**
	 * @param {DBConfig} config
	 * @returns {DBDriver}
	 * @private
	 */
	getDBDriver(config) {

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
