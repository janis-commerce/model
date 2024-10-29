'use strict';

const { AwsSecretsManager } = require('@janiscommerce/aws-secrets-manager');

module.exports = class CredentialsFetcher {

	static get secretName() {
		return process.env.JANIS_SERVICE_NAME;
	}

	static async fetch(key, config, useReadDB) {

		await this.ensureSecretValue();

		const accessType = useReadDB ? 'read' : 'write';

		const credentials = this.secretValue?.databases?.[key]?.[accessType]
			? this.secretValue.databases[key][accessType]
			: {};

		return {
			...config,
			...credentials
		};
	}

	static async ensureSecretValue() {

		if(!this.secretValue) {
			try {
				const secretHandler = AwsSecretsManager.secret(this.secretName);
				this.secretValue = await secretHandler.getValue();
			} catch(err) {
				// nothing to do here
			}
		}
	}
};
