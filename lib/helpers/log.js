'use strict';

const crypto = require('crypto');
const Log = require('@janiscommerce/log');

const arrayChunk = require('./array-chunk');

const { modelNameSanitizer, omitRecursive, isObject } = require('./utils');

/**
 * @typedef LogObject
 * @property {string} entity
 * @property {string} [entityId]
 * @property {string} type
 * @property {string} [message]
 * @property {string} [userCreated]
 * @property {*} [log]
 */

/**
 * Builds and sends the automatic logs for a model write operation to the trace service.
 *
 * The logging gate (shouldCreateLogs, one-shot disable, client/core presence) and the core
 * resolution live in the Model (see Model._shouldCreateLog). By the time add() or
 * addByItem() run, the caller already resolved whether the model maps to a core database and
 * passes it in as `isCore`, so this helper only builds the log objects and routes them.
 */
module.exports = class LogHelper {

	constructor(params) {

		/** @private */
		this.session = params.session;

		/** @private */
		this.modelName = modelNameSanitizer(params.modelName);

		/** @private */
		this.excludeFieldsInLog = Array.isArray(params.excludeFieldsInLog) ? params.excludeFieldsInLog : null;

		this.customLogData = null;
	}

	/**
	 * Validates and sets the custom data to be merged into the next built log, kept alive until the
	 * next write consumes it. A string is stored as the log message.
	 *
	 * @param {string|import('@janiscommerce/log').LogData} logMessageOrData The log message as a string or custom data to log as an object
	 * @returns {LogHelper} The same instance, to allow chaining
	 */
	setLogData(logMessageOrData) {

		if(typeof logMessageOrData !== 'string' && !isObject(logMessageOrData))
			throw new Error('Model - Custom log data: the custom data to log must be string or an object');

		if(isObject(logMessageOrData) && logMessageOrData.log && !isObject(logMessageOrData.log))
			throw new Error('Model - Custom log data: the property name log in custom log data must be an object');

		this.customLogData = {
			...typeof logMessageOrData === 'string' ? { message: logMessageOrData } : logMessageOrData
		};

		return this;
	}

	/**
	 * Create a log into trace service
	 *
	 * @param {string} type The log type string
	 * @param {Object} log The log field object
	 * @param {string} entityId The log entityId
	 * @param {boolean} isCore Whether the model maps to a core database
	 */
	async add(type, log, entityId, isCore) {

		if(!Array.isArray(entityId))
			entityId = [entityId];

		const builtLogs = entityId.map(id => this._buildLog(log, type, id));

		return this._add(builtLogs, isCore);
	}

	/**
	 * Create a log for each item into trace service, using they ids as entityId
	 *
	 * @param {string} type The log type string
	 * @param {Array<Object>} items The items to log
	 * @param {string} executionTime The time spent on the query
	 * @param {boolean} isCore Whether the model maps to a core database
	 */
	async addByItem(type, items, executionTime, isCore) {

		const builtLogs = [];
		const batchLength = items.length;
		const batchToken = crypto.randomUUID();

		const { itemsWithId, itemsWithoutId } = items.reduce((groups, item) => {

			if(item.id)
				groups.itemsWithId.push(item);
			else
				groups.itemsWithoutId.push(item);

			return groups;

		}, { itemsWithId: [], itemsWithoutId: [] });

		if(itemsWithoutId.length) {

			const chunkedItems = arrayChunk(itemsWithoutId, 500);

			chunkedItems.forEach((chunk, index) => {

				builtLogs.push(this._buildLog({
					executionTime,
					batchToken,
					batchLength,
					chunkData: {
						chunkLength: chunk.length,
						chunkIndex: index + 1,
						totalParts: chunkedItems.length
					},
					items: chunk
				}, type));
			});
		}

		if(itemsWithId.length) {
			itemsWithId.forEach(item => {
				builtLogs.push(this._buildLog({
					executionTime,
					batchToken,
					batchLength,
					item
				}, type, item.id));
			});
		}

		return this._add(builtLogs, isCore);
	}

	/**
	 * @param {LogObject} log
	 * @param {string} type
	 * @param {string} entityId
	 * @return {Log}
	 * @private
	 */
	_buildLog(log, type, entityId) {

		const formattedLog = this.customLogData?.log ? { ...log, ...this.customLogData.log } : log;

		if(this.session?.serviceName)
			formattedLog.serviceName = this.session.serviceName;

		const builtLog = {
			entity: this.modelName,
			type,
			userCreated: this.session?.userId,
			...this.customLogData ? this.customLogData : {},
			log: this.excludeFieldsInLog
				? omitRecursive(formattedLog, this.excludeFieldsInLog)
				: formattedLog
		};

		if(typeof entityId !== 'undefined')
			builtLog.entityId = entityId;

		return builtLog;
	}

	/**
	 * @param {LogObject | Array<LogObject>} logs
	 * @param {boolean} isCore Whether the model maps to a core database
	 * @returns {Promise<void>}
	 * @private
	 */
	_add(logs, isCore) {

		this.customLogData = null;

		if(isCore)
			return Log.addCore(logs);

		return Log.add(this.session.clientCode, logs);
	}
};
