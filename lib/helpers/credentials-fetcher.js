'use strict';

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

module.exports = class CredentialsFetcher {

	static get secretName() {
		return process.env.JANIS_SERVICE_NAME;
	}

	static async fetch(config) {

		let credentials = {};

		try {

			const secretHandler = AwsSecretsManager.secret(this.secretName);

			const secretValue = await secretHandler.getValue();

			let accessType = 'write';

			if(config.adminAccess)
				accessType = 'admin';
			else if(config.useReadDB)
				accessType = 'read';

			if(secretValue
				&& secretValue[config.databaseKey]
				&& secretValue[config.databaseKey][accessType])
				credentials = secretValue[config.databaseKey][accessType];

		} catch(err) {
			// nothing to do here
			// no explota en este punto así dejamos que algún Driver se conecte por contexto, sin credenciales
		}

		return {
			...config,
			...credentials
		};
	}
};
