'use strict';

const Log = require('@janiscommerce/log');

const { modelNameSanitizer, omitRecursive } = require('./utils');

/**
 * @typedef LogObject
 * @property {string} entity
 * @property {string} [entityId]
 * @property {string} type
 * @property {string} [message]
 * @property {string} [userCreated]
 * @property {*} [log]
 */

module.exports = class LogHelper {

	constructor(params) {
		/** @private */
		this.session = params.session;
		/** @private */
		this.shouldCreateLogs = params.shouldCreateLogs && this.session;
		/** @private */
		this.modelName = modelNameSanitizer(params.modelName);
		/** @private */
		this.excludeFieldsInLog = Array.isArray(params.excludeFieldsInLog) ? params.excludeFieldsInLog : null;
		this.customLogData = null;
	}

	/**
	 * Create a log into trace service
	 *
	 * @param {string} type The log type string
	 * @param {Object} log The log field object
	 * @param {string} entityId The log entityId
	 */
	add(type, log, entityId) {

		if(!this.shouldCreateLogs)
			return;

		return this._add(this.buildLog(log, type, entityId));
	}

	/**
	 * Create a log for each item into trace service, using they ids as entityId
	 *
	 * @param {string} type The log type string
	 * @param {Array<Object>} items The items to log
	 */
	addByItem(type, items) {

		if(!this.shouldCreateLogs)
			return;

		const builtLogs = items.map(item => this.buildLog(item, type, item.id));

		return this._add(builtLogs);
	}

	/**
	 * @param {LogObject | Array<LogObject>} logs
	 * @returns {Promise<void>}
	 * @private
	 */
	_add(logs) {
		return Log.add(this.session.clientCode, logs);
	}

	/**
	 * @param {LogObject} log
	 * @param {string} type
	 * @param {string} entityId
	 * @return {Log}
	 * @private
	 */
	buildLog(log, type, entityId) {

		const formattedLog = this.customLogData && this.customLogData.log ? { ...log, ...this.customLogData.log } : log;

		const builtLog = {
			entity: this.modelName,
			type,
			userCreated: this.session.userId,
			...this.customLogData ? this.customLogData : {},
			log: this.excludeFieldsInLog ? omitRecursive(formattedLog, this.excludeFieldsInLog) : formattedLog
		};

		if(typeof entityId !== 'undefined')
			builtLog.entityId = entityId;

		this.customLogData = null;

		return builtLog;
	}
};
