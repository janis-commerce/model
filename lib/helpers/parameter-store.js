'use strict';

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const logger = require('lllog')();

module.exports = class ParameterStore {

	static get parameterName() {
		return `${process.env.JANIS_SERVICE_NAME}-databases`;
	}

	static async set() {

		if(this.parameter) {

			/* istanbul ignore next */
			if(process.env.MODEL_DEBUG)
				logger.info('ModelDebug - ParameterStore from cache');

			return;
		}

		try {

			const ssmClient = new SSMClient();

			const response = await ssmClient.send(new GetParameterCommand({ Name: this.parameterName }));

			this.parameter = JSON.parse(response.Parameter.Value);

			/* istanbul ignore next */
			if(process.env.MODEL_DEBUG)
				logger.info(`ModelDebug - ParameterStore fetched cache ${response.Parameter.Value}`);

		} catch(error) {
			logger.error(`Unable to get ParameterStore ${this.parameterName} - ${error.message}`);
		}
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
