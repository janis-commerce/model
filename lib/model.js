'use strict';

const DatabaseDispatcher = require('./helpers/database-dispatcher');
const LogHelper = require('./helpers/log');

const ModelError = require('./model-error');

const { isObject } = require('./helpers/utils');

const DEFAULT_PAGE_LIMIT = 500;

class Model {

	get databaseKey() {
		return 'default';
	}

	get databaseDispatcher() {

		if(!this._databaseDispatcher)
			this._databaseDispatcher = this.session ? this.session.getSessionInstance(DatabaseDispatcher) : new DatabaseDispatcher();

		return this._databaseDispatcher;
	}

	get logHelper() {

		if(this._logHelper)
			return this._logHelper;

		this._logHelper = new LogHelper({
			session: this.session,
			modelName: this.constructor.name,
			shouldCreateLogs: this.constructor.shouldCreateLogs,
			excludeFieldsInLog: this.constructor.excludeFieldsInLog
		});

		return this._logHelper;
	}

	static get shouldCreateLogs() {
		return true;
	}

	static get defaultPageLimit() {
		return DEFAULT_PAGE_LIMIT;
	}

	static get statuses() {
		return {
			active: 'active',
			inactive: 'inactive'
		};
	}

	hasReadDB() {
		return this.databaseDispatcher.hasReadDb(this.databaseKey);
	}

	getDb() {
		return this.databaseDispatcher.getDatabaseByKey(this.databaseKey, !!this.useReadDB);
	}

	validateMethodImplemented(dbDriver, methodName) {
		if(!(methodName in dbDriver))
			throw new ModelError(`${methodName} method not supported by driver`, ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED);
	}

	async getIndexes() {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'getIndexes');

		return db.getIndexes(this);
	}

	async createIndexes(indexes) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'createIndexes');

		return db.createIndexes(this, indexes);
	}

	async createIndex(index) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'createIndex');

		return db.createIndex(this, index);
	}

	async dropIndex(name) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropIndex');

		return db.dropIndex(this, name);
	}

	async dropIndexes(names) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropIndexes');

		return db.dropIndexes(this, names);
	}

	async distinct(key, params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'distinct');

		return db.distinct(this, {
			...params,
			key
		});
	}

	async get(params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'get');

		const items = await db
			.get(this, params);

		if(typeof items === 'undefined')
			return null;

		const results = await this._prepareGetResults(items, params);

		return results;
	}

	async getById(id, params = {}) {
		return this.getBy('id', id, params);
	}

	async getBy(field, value, params = {}) {

		if(typeof field !== 'string' || field === '')
			return null;

		if(typeof value === 'undefined')
			throw new ModelError('The value must be defined', ModelError.codes.INVALID_VALUE);

		const { filters, ...otherParams } = params;

		const records = await this.get({
			...otherParams,
			filters: this._buildGetByFilters(filters, field, value)
		});

		let uniqueRecord = false;

		if(field === 'id' || params.unique === true)
			uniqueRecord = true;

		if(Array.isArray(value) || !uniqueRecord)
			return records;

		return records && records.length ? records[0] : null;
	}

	_buildGetByFilters(filters, field, value) {

		// When the filters are an array (OR) should build the getBy filter for each condition
		if(Array.isArray(filters))
			return filters.map(filter => ({ ...filter, [field]: value }));

		return {
			...filters,
			[field]: value
		};
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
		this.validateMethodImplemented(db, 'getTotals');

		return db.getTotals(this);
	}

	mapIdByReferenceId(referenceIds, params = {}) {
		return this.mapIdBy('referenceId', referenceIds, params);
	}

	async mapIdBy(field, fieldValues, params = {}) {

		if(!Array.isArray(fieldValues))
			throw new ModelError(`${field} items must be an Array`, ModelError.codes.INVALID_VALUE);

		if(!fieldValues.length)
			return {};

		const newParams = { ...params, limit: fieldValues.length }; // to avoid default DBDriver limit

		const items = await this.getBy(field, fieldValues, newParams);

		const newItems = {};

		items.forEach(item => {
			if(fieldValues.includes(item[field]))
				newItems[item[field]] = item.id.toString();
		});

		return newItems;
	}

	async insert(item) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'insert');

		if(this.session && this.session.userId && isObject(item))
			item.userCreated = this.session.userId;

		const result = await db.insert(this, item);

		await this.logHelper.add('inserted', item, result);

		return result;
	}

	async save(item, setOnInsert) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'save');

		if(this.session && this.session.userId && isObject(item)) {

			if(typeof item.id !== 'undefined' || typeof item._id !== 'undefined') // eslint-disable-line no-underscore-dangle
				item.userModified = this.session.userId;
			else
				item.userCreated = this.session.userId;
		}

		const result = await db.save(this, item, setOnInsert);

		await this.logHelper.add('upserted', item, result);

		return result;
	}

	async update(values, filter) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'update');

		if(this.session && this.session.userId && isObject(values))
			values.userModified = this.session.userId;

		const result = await db.update(this, values, filter);

		if(isObject(filter))
			await this.logHelper.add('updated', { values, filter }, filter.id);

		return result;
	}

	/**
	 * Increment values in registry
	 * @param {Object} filters Unique filters
	 * @param {Object} incrementData Values to Increment
	 * @returns {Object} Registry updated
	 */
	async increment(filters, incrementData) {

		this.useReadDB = false;
		const item = {};

		if(this.session && this.session.userId)
			item.userModified = this.session.userId;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'increment');

		const result = await db.increment(this, filters, incrementData, item);

		await this.logHelper.add('incremented', result, result._id.toString()); // eslint-disable-line no-underscore-dangle

		return result;
	}

	async remove(item) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'remove');

		const result = await db.remove(this, item);

		if(isObject(item))
			await this.logHelper.add('removed', item, item.id);

		return result;
	}

	async multiInsert(items) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'multiInsert');

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

		const result = await db.multiInsert(this, items);

		if(Array.isArray(items))
			await this.logHelper.addByItem('inserted', items);

		return result;
	}

	async multiSave(items, setOnInsert) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'multiSave');

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

		const result = await db.multiSave(this, items, setOnInsert);

		if(Array.isArray(items))
			await this.logHelper.addByItem('upserted', items);

		return result;
	}

	async multiRemove(filter) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'multiRemove');

		const result = await db.multiRemove(this, filter);

		if(isObject(filter))
			await this.logHelper.add('removed', filter, filter.id);

		return result;
	}

	async dropDatabase() {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropDatabase');

		return db.dropDatabase(this);
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
		return items.reduce((newItems, item) => {
			if(item[newKey])
				newItems[item[newKey]] = item;
			return newItems;
		}, {});
	}
}

module.exports = Model;
