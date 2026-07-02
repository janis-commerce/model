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

		/**
		 * Resolves (async) whether the model's databaseKey maps to a core database. Core models log
		 * entities without a client, using the sentinel client resolved by Log.addCore(), so they must
		 * log even without a client session. Resolved once at add-time and memoized (see _resolveIsCore).
		 * @private
		 * @type {() => Promise<boolean>}
		 */
		this.coreResolver = params.coreResolver;

		/**
		 * The model's explicit opt-out. When false it always wins, even for core models.
		 * @private
		 */
		this.shouldCreateLogs = params.shouldCreateLogs;

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
	async add(type, log, entityId) {

		if(!this.shouldCreateLogs)
			return;

		if(this.disable) {
			this.disable = false;
			return;
		}

		const isCore = await this._resolveIsCore();

		if(!this.session?.clientCode && !isCore)
			return;

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
	 */
	async addByItem(type, items, executionTime) {

		if(!this.shouldCreateLogs)
			return;

		if(this.disable) {
			this.disable = false;
			return;
		}

		const isCore = await this._resolveIsCore();

		if(!this.session?.clientCode && !isCore)
			return;

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
	 * Resolves whether the model is core using the injected resolver, memoizing the result. The
	 * databaseKey is fixed per model instance, so a single resolution is enough for its whole lifecycle.
	 * @returns {Promise<boolean>}
	 * @private
	 */
	async _resolveIsCore() {

		if(typeof this._isCore === 'undefined')
			this._isCore = await this.coreResolver();

		return this._isCore;
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
