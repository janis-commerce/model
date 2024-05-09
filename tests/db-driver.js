'use strict';

const { struct } = require('@janiscommerce/superstruct');

module.exports = class DBDriver {

	constructor(config = {}) {

		if(config.fail)
			throw new Error('Error creating instance');

		this.config = config;
	}

	get() {}

	getTotals() {}

	insert() {}

	save() {}

	update() {}

	remove() {}

	multiInsert() {}

	multiSave() {}

	multiRemove() {}

	multiUpdate() {}

	increment() {}

	distinct() {}

	getIndexes() {}

	createIndexes() {}

	createIndex() {}

	dropIndex() {}

	dropIndexes() {}

	dropDatabase() {}

	get idStruct() {
		return struct('objectId');
	}
};
