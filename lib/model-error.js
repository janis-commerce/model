'use strict';

class ModelError extends Error {

	static get codes() {

		return {
			DATABASE_CONFIG_NOT_FOUND: 1,
			WRONG_CALLBACK: 2,
			DRIVER_METHOD_NOT_IMPLEMENTED: 3
		};

	}

	constructor(err, code) {

		const message = err.message || err;

		super(message);
		this.message = message;
		this.code = code;
		this.name = 'ModelError';

		if(err instanceof Error)
			this.previousError = err;
	}
}

module.exports = ModelError;
