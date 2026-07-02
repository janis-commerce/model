'use strict';

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const logger = require('lllog')();

module.exports = class ParameterStore {

	static get parameterName() {
		return `${process.env.JANIS_SERVICE_NAME}-databases`;
	}

	/**
	 * Whether the error means the parameter genuinely does not exist (a legitimate case: the service
	 * does not use this parameter). Any other error means the parameter could not be fetched correctly.
	 * @param {Error} error
	 * @returns {boolean}
	 */
	static isParameterNotFound(error) {
		const notFoundNames = ['ParameterNotFound', 'ResourceNotFoundException'];
		return notFoundNames.includes(error.name) || notFoundNames.includes(error.__type);
	}

	static set() {

		// Memoize the PROMISE (not the value) so concurrent callers share a single fetch and a genuinely
		// missing parameter stays negative-cached until the next cold start / clearCache().
		if(this._setPromise) {

			/* istanbul ignore next */
			if(process.env.MODEL_DEBUG)
				logger.info('ModelDebug - ParameterStore from cache');

			return this._setPromise;
		}

		this._setPromise = (async () => {

			try {

				const ssmClient = new SSMClient();

				const response = await ssmClient.send(new GetParameterCommand({ Name: this.parameterName }));

				this.parameter = JSON.parse(response.Parameter.Value);

				/* istanbul ignore next */
				if(process.env.MODEL_DEBUG)
					logger.info(`ModelDebug - ParameterStore fetched cache ${response.Parameter.Value}`);

			} catch(error) {

				if(!this.isParameterNotFound(error)) {

					// The parameter could not be fetched correctly (transient, throttling, access denied,
					// network...). Do NOT cache and do NOT swallow: reset the memoized promise so the next
					// operation retries, and rethrow so the current operation fails. A model cannot run
					// without correctly resolving its ParameterStore.
					this._setPromise = null;

					throw error;
				}

				// The parameter genuinely does not exist: this service does not use it. Negative-cache an
				// empty parameter so lookups fall through to the client flow, same as an absent parameter.
				this.parameter = {};

				logger.error(`Unable to get ParameterStore ${this.parameterName} - ${error.message}`);
			}
		})();

		return this._setPromise;
	}

	static clearCache() {
		this.parameter = null;
		this._setPromise = null;
	}

	static getCoreDatabase(databaseKey) {
		return this.parameter?.coreDatabases?.[databaseKey];
	}

	static getDatabaseConfig({ id, ...dbConfig }) {

		if(!this.parameter?.databases?.[id]) {
			logger.error(`ModelError - Unable to find database ${id} in Parameter ${this.parameterName}`);
			return;
		}

		return { ...this.parameter.databases[id], ...dbConfig };
	}
};
