'use strict';

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

	increment() {}

	distinct() {}

	getIndexes() {}

	createIndexes() {}

	createIndex() {}

	dropIndex() {}

	dropIndexes() {}

	dropDatabase() {}
};
