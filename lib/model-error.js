'use strict';

class ModelError extends Error {

	static get codes() {

		return {
			// Model
			WRONG_CALLBACK: 1,
			DRIVER_METHOD_NOT_IMPLEMENTED: 2,
			INVALID_VALUE: 3,
			// Database Dispatcher
			INVALID_SETTINGS: 4, //  settings found with invalid format (not an object)
			DB_CONFIG_NOT_FOUND: 5, // when db config not found in settings
			INVALID_DB_CONFIG: 6, // when a db config has invliad format (not an object)
			INVALID_CLIENT: 7, // when client object is invalid (not an object)
			DB_DRIVER_NOT_INSTALLED: 8, // when driver is not installed
			INVALID_DB_DRIVER: 9 // when driver can't create an instance
		};

	}

	constructor(err, code) {

		const message = err.message || err;

		super(message);
		this.message = message;
		this.code = code;
		this.name = 'ModelError';
	}
}

module.exports = ModelError;
