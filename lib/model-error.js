'use strict';

class ModelError extends Error {

	static get codes() {

		return {

			// Model
			DATABASE_CONFIG_NOT_FOUND: 1,
			WRONG_CALLBACK: 2,
			DRIVER_METHOD_NOT_IMPLEMENTED: 3,
			INVALID_VALUE: 4,

			// Database Dispatcher
			SETTINGS_NOT_FOUND: 5, // settings not found
			INVALID_SETTINGS: 6, //  settings found with invalid format (not an object)
			DB_CONFIG_NOT_FOUND: 7, // when db config not found in settings
			INVALID_DB_CONFIG: 8, // when a db config has invliad format (not an object)
			INVALID_CLIENT: 9, // when client object is invalid (not an object)
			DB_DRIVER_NOT_INSTALLED: 10, // when driver is not installed
			INVALID_DB_DRIVER: 11 // when driver can't create an instance
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
