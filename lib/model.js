'use strict';

const DatabaseDispatcher = require('@janiscommerce/database-dispatcher');
const Log = require('@janiscommerce/log');

const ModelError = require('./model-error');

const { titleCaseToDashCase, omitRecursive, isObject } = require('./utils');

const DEFAULT_PAGE_LIMIT = 500;

class Model {

	set session(session) {
		this._session = session;
	}

	get session() {
		return this._session;
	}

	static get defaultPageLimit() {
		return DEFAULT_PAGE_LIMIT;
	}

	async getDb() {

		if(this.databaseKey)
			return DatabaseDispatcher.getDatabaseByKey(this.databaseKey);

		if(this.session) {
			const sessionClient = await this.session.client;
			return DatabaseDispatcher.getDatabaseByClient(sessionClient, this.useReadDB);
		}

		throw new ModelError(`Invalid Model ${this.constructor.name} - No database config`, ModelError.codes.DATABASE_CONFIG_NOT_FOUND);
	}

	async distinct(key, params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();

		if(!db.distinct)
			throw new ModelError('Method distinct() not implemented in DB driver', ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED);

		return db.distinct(this, {
			...params,
			key
		});
	}

	async get(params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();

		const items = await db
			.get(this, params);

		if(typeof items === 'undefined')
			return null;

		const results = await this._prepareGetResults(items, params);

		return results;
	}

	async getById(id, params = {}) {

		const { filters, ...otherParams } = params;

		const records = await this.get({
			...otherParams,
			filters: {
				...filters,
				id
			}
		});

		if(Array.isArray(id))
			return records;

		return records && records.length ? records[0] : null;
	}

	async _prepareGetResults(items, params) {

		const wasObject = !Array.isArray(items);

		if(wasObject)
			items = [items];
		else if(!items.length)
			return [];

		const indexes = {};
		const ids = [];

		let newItems = items.map((item, index) => {

			const newItem = this.formatGet ? this.formatGet(item) : item;

			if(this.afterGet && newItem.id) {
				indexes[newItem.id] = index;
				ids.push(newItem.id);
			}

			return newItem;
		});

		if(this.afterGet)
			newItems = await this.afterGet([...newItems], params, indexes, ids);

		if(wasObject)
			return newItems[0];

		return params.changeKeys ? this.constructor.changeKeys(newItems, params.changeKeys) : newItems;
	}

	/**
	 * Get Paged database data
	 *
	 * @param {object} data Data for where
	 * @param {function} callback Function to call for each batch of items
	 */
	async getPaged(data = {}, callback) {

		if(!callback || typeof callback !== 'function')
			throw new ModelError('Callback should be a function', ModelError.codes.WRONG_CALLBACK);

		// se copia para que no se alteren las paginas y limites originales
		const params = { ...data };

		if(!params.page)
			params.page = 1;

		if(!params.limit)
			params.limit = this.constructor.defaultPageLimit;

		const items = await this.get(params);

		if(!items || !items.length)
			return;

		await callback.call(null, items, params.page, params.limit);

		const newParams = { ...params };

		newParams.page++;

		if(items.length === newParams.limit)
			await this.getPaged(newParams, callback);
	}

	async getTotals() {
		const db = await this.getDb();
		return db.getTotals(this);
	}

	async insert(item) {

		this.useReadDB = false;

		if(this.session && this.session.userId && isObject(item))
			item.userCreated = this.session.userId;

		const db = await this.getDb();
		const result = await db.insert(this, item);

		this._saveLog('inserted', item, result);

		return result;
	}

	async save(item) {

		this.useReadDB = false;

		if(this.session && this.session.userId && isObject(item)) {

			if(typeof item.id !== 'undefined' || typeof item._id !== 'undefined') // eslint-disable-line no-underscore-dangle
				item.userModified = this.session.userId;
			else
				item.userCreated = this.session.userId;
		}

		const db = await this.getDb();
		const result = await db.save(this, item);

		this._saveLog('upserted', item, result);

		return result;
	}

	async update(values, filter) {

		this.useReadDB = false;

		if(this.session && this.session.userId && isObject(values))
			values.userModified = this.session.userId;

		const db = await this.getDb();
		const result = await db.update(this, values, filter);

		if(isObject(filter))
			this._saveLog('updated', { values, filter }, filter.id);

		return result;
	}

	async remove(item) {

		this.useReadDB = false;

		const db = await this.getDb();
		const result = await db.remove(this, item);

		if(isObject(item))
			this._saveLog('removed', item, item.id);

		return result;
	}

	async multiInsert(items) {

		this.useReadDB = false;

		if(this.session && this.session.userId && Array.isArray(items)) {

			items = items.map(item => {

				if(!isObject(item))
					return;

				return {
					...item,
					userCreated: this.session.userId
				};
			}).filter(Boolean);
		}

		const db = await this.getDb();
		const result = await db.multiInsert(this, items);

		if(Array.isArray(items)) {

			items.forEach(item => {
				this._saveLog('inserted', item);
			});
		}

		return result;
	}

	async multiSave(items) {

		this.useReadDB = false;

		if(this.session && this.session.userId && Array.isArray(items)) {

			items = items.map(item => {

				if(!isObject(item))
					return;

				if(typeof item.id !== 'undefined' || typeof item._id !== 'undefined') { // eslint-disable-line no-underscore-dangle

					return {
						...item,
						userModified: this.session.userId
					};
				}

				return {
					...item,
					userCreated: this.session.userId
				};
			}).filter(Boolean);
		}

		const db = await this.getDb();
		const result = await db.multiSave(this, items);

		if(Array.isArray(items)) {

			items.forEach(item => {
				this._saveLog('upserted', item, item.id);
			});
		}

		return result;
	}

	async multiRemove(filter) {

		this.useReadDB = false;

		const db = await this.getDb();
		const result = await db.multiRemove(this, filter);

		if(isObject(filter))
			this._saveLog('removed', filter, filter.id);

		return result;
	}

	/**
	 * Change keys
	 *
	 * @param {array} items The items
	 * @param {string} newKey The new key
	 * @return {object} the new list of items with keys if exist
	 * @example
	 * 	this.changeKeys([{ id: 1, foo: 'bar' }, { id: 2, foo: 'bar2' }], 'id'); // { 1: { id: 1, foo: 'bar' }, 2: { id: 2, foo: 'bar2' } }
	 * 	this.changeKeys([{ id: 1, foo: 'bar' }, { id: 2, foo: 'bar2' }], 'foo'); // { bar: { id: 1, foo: 'bar' }, bar2: { id: 2, foo: 'bar2' } }
	 * 	this.changeKeys([{ id: 1, foo: 'bar' }, { id: 2, foo: 'bar2' }], 'wrongKey'); // {}
	 */
	static changeKeys(items, newKey) {

		const newItems = {};

		items.forEach(item => {
			if(newKey in item && item[newKey] !== null)
				newItems[item[newKey]] = item;
		});

		return newItems;
	}

	/**
	 * Creates a log with the specified parameters
	 * @param {String} type The log type
	 * @param {Object} log The log object with detailed information such as received filters or items
	 * @param {String} entityId The entityId that will be included in the log
	 */
	_saveLog(type, log, entityId) {

		if(!this.session)
			return;

		if(Array.isArray(this.constructor.excludeFieldsInLog))
			log = omitRecursive(log, this.constructor.excludeFieldsInLog);

		const builtLog = {
			entity: titleCaseToDashCase(this.constructor.name),
			type,
			userCreated: this.session.userId,
			log
		};

		if(typeof entityId !== 'undefined')
			builtLog.entityId = entityId;

		Log.add(this.session.clientCode, builtLog);
	}
}

module.exports = Model;
