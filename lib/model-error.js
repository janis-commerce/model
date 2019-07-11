'use strict';

class ModelError extends Error {

	static get codes() {

		return {
			DATABASE_CONFIG_NOT_FOUND: 1,
			WRONG_CALLBACK: 2
		};

	}

	constructor(err, code) {
		super(err);
		this.message = err.message || err;
		this.code = code;
		this.name = 'ModelError';
	}
}

module.exports = ModelError;
