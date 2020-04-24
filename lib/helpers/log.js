'use strict';

const Log = require('@janiscommerce/log');

const { modelNameSanitizer, omitRecursive } = require('./utils');

class LogHelper {

	constructor(params) {
		this.session = params.session;
		this.shouldCreateLogs = params.shouldCreateLogs;
		this.modelName = modelNameSanitizer(params.modelName);
		this.excludeFieldsInLog = Array.isArray(params.excludeFieldsInLog) ? params.excludeFieldsInLog : null;
	}

	/**
	 * Create a log into trace service
	 * @param {String} type The log type string
	 * @param {Object} log The log field object
	 * @param {String} entityId The log entityId
	 */
	add(type, log, entityId) {

		if(!this.session)
			return;

		return this._add(this.buildLog(log, type, entityId));
	}

	/**
	 * Create a log for each item into trace service, using they ids as entityId
	 * @param {String} type The log type string
	 * @param {Array.<object>} items The items to log
	 */
	addByItem(type, items) {

		if(!this.session)
			return;

		const builtLogs = items.map(item => this.buildLog(item, type, item.id));

		return this._add(builtLogs);
	}

	_add(logs) {

		if(!this.shouldCreateLogs)
			return;

		return Log.add(this.session.clientCode, logs);
	}

	buildLog(log, type, entityId) {

		const builtLog = {
			entity: this.modelName,
			type,
			userCreated: this.session.userId,
			log: this.excludeFieldsInLog ? omitRecursive(log, this.excludeFieldsInLog) : log
		};

		if(typeof entityId !== 'undefined')
			builtLog.entityId = entityId;

		return builtLog;
	}
}

module.exports = LogHelper;
