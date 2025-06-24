'use strict';

const crypto = require('crypto');
const Log = require('@janiscommerce/log');

const arrayChunk = require('./array-chunk');

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
		this.shouldCreateLogs = params.shouldCreateLogs && !!this.session?.clientCode;

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

		if(this.disable) {
			this.disable = false;
			return;
		}

		if(!Array.isArray(entityId))
			entityId = [entityId];

		const builtLogs = entityId.map(id => this._buildLog(log, type, id));

		return this._add(builtLogs);
	}

	/**
	 * Create a log for each item into trace service, using they ids as entityId
	 *
	 * @param {string} type The log type string
	 * @param {Array<Object>} items The items to log
	 * @param {string} executionTime The time spent on the query
	 */
	addByItem(type, items, executionTime) {

		if(!this.shouldCreateLogs)
			return;

		if(this.disable) {
			this.disable = false;
			return;
		}

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

		return this._add(builtLogs);
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

		if(this.session.serviceName)
			formattedLog.serviceName = this.session.serviceName;

		const builtLog = {
			entity: this.modelName,
			type,
			userCreated: this.session.userId,
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
	 * @returns {Promise<void>}
	 * @private
	 */
	_add(logs) {
		this.customLogData = null;
		return Log.add(this.session.clientCode, logs);
	}
};
