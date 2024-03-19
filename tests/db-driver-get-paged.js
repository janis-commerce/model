'use strict';

module.exports = class DBDriverGetPaged {

	constructor(config = {}) {

		if(config.fail)
			throw new Error('Error creating instance');

		this.config = config;
	}

	getPaged() {

	}
};
