'use strict';

/**
 * @enum {number}
 * @private
 */
const ERROR_CODES = {
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

module.exports = class ModelError extends Error {

	static get codes() {
		return ERROR_CODES;
	}

	/**
	 * @param {string} message
	 * @param {ERROR_CODES} code
	 * @param {Error} err
	 */
	constructor(message, code, err) {

		super(message);
		this.message = message;
		this.code = code;
		this.name = 'ModelError';

		if(err && err instanceof Error)
			this.previousError = err;
	}
};
