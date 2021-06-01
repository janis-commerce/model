'use strict';

const DatabaseDispatcher = require('./helpers/database-dispatcher');
const LogHelper = require('./helpers/log');

const ModelError = require('./model-error');

const { isObject } = require('./helpers/utils');

const DEFAULT_PAGE_LIMIT = 500;

/** @typedef {string|number} ReferenceId An external identifier of an entity */

/** @typedef {string} EntityId The unique identifier of an entity */

/**
 * @typedef Entity
 * @property {EntityId} id The entity ID
 */

/**
 * @typedef {'asc'|'desc'} SortOption The sort direction
 */

/**
 * @typedef Filter A filter to be applied to a query
 * @property {*} value The filter value
 * @property {string} [type] The filter type. Defines how will the value be matched. By default will match equality.
 * @property {string} [field] The field to filter. Use only to override the filter key.
 */

/**
 * @typedef {Object<string, string|Filter>} Filters Filters to apply to a query
 */

/**
 * @typedef GetParams
 * @property {number} [limit] The max items to fetch
 * @property {number} [page] The page to fetch (based on limit for page size)
 * @property {Object<string, SortOption>} [order] A key-value object that defines how to sort the results
 * @property {Filters | Array<Filters>} [filters] Filters to apply to data fetching
 */

/**
 * @callback GetPagedCallback
 * @param {Array<Entity} items The items that where found in the current page
 * @param {number} page The page number
 * @param {number} limit The page max size
 * @returns {void | Promise<void>}
 */

/**
 * @typedef GetTotalsResult
 * @property {number} total The total amount of matched records (not by page)
 * @property {number} pageSize The max quantity of records in a page
 * @property {number} pages The amount of pages available
 * @property {number} page The current page number
 */

class Model {

	get databaseKey() {
		return 'default';
	}

	/**
	 * @type {DatabaseDispatcher}
	 */
	get databaseDispatcher() {

		if(!this._databaseDispatcher) {
			/** @private */
			this._databaseDispatcher = this.session ? this.session.getSessionInstance(DatabaseDispatcher) : new DatabaseDispatcher();
		}

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
		return this.databaseDispatcher.getDatabaseByKey(this.databaseKey, !!this.useReadDB, !!this.adminAccess);
	}

	/**
	 * @param {DBDriver} dbDriver A database driver
	 * @param {string} methodName A method name to check for existance in the DB Driver
	 * @throws {ModelError} If method is not present in dbDriver
	 */
	validateMethodImplemented(dbDriver, methodName) {
		if(!(methodName in dbDriver))
			throw new ModelError(`${methodName} method not supported by driver`, ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED);
	}

	async getIndexes() {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'getIndexes');

		return db.getIndexes(this);
	}

	/**
	 * @param {Array<Index>} indexes
	 */
	async createIndexes(indexes) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'createIndexes');

		return db.createIndexes(this, indexes);
	}

	/**
	 * @param {Index} index
	 */
	async createIndex(index) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'createIndex');

		return db.createIndex(this, index);
	}

	/**
	 * @param {string} name
	 */
	async dropIndex(name) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropIndex');

		return db.dropIndex(this, name);
	}

	/**
	 * @param {Array<string>} names
	 */
	async dropIndexes(names) {

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropIndexes');

		return db.dropIndexes(this, names);
	}

	/**
	 * @param {string} key
	 * @param {GetParams} params
	 */
	async distinct(key, params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'distinct');

		return db.distinct(this, {
			...params,
			key
		});
	}

	/**
	 * @param {GetParams} [params={}]
	 */
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

	/**
	 * @param {string} id
	 * @param {GetParams} [params={}]
	 * @returns {Promise<Entity | null>}
	 */
	async getById(id, params = {}) {
		return this.getBy('id', id, params);
	}

	/**
	 * @param {string} field
	 * @param {string | Array<string> | number | Array<number> | boolean} value
	 * @param {GetParams} [params={}]
	 * @returns {Promise<Entity | Array<Entity> | null>}
	 */
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

	/**
	 * @param {Filters} filters
	 * @param {string} field
	 * @param {*} value
	 * @returns {Object<string, *>}
	 * @private
	 */
	_buildGetByFilters(filters, field, value) {

		// When the filters are an array (OR) should build the getBy filter for each condition
		if(Array.isArray(filters))
			return filters.map(filter => ({ ...filter, [field]: value }));

		return {
			...filters,
			[field]: value
		};
	}

	/**
	 * @param {Entity | Array<Entity>} items
	 * @param {GetParams} params
	 * @returns {Promise<Entity | Array<Entity> | Object<string, Entity>>}
	 * @private
	 */
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
	 * @param {GetParams} data Data for where
	 * @param {GetPagedCallback} callback Function to call for each batch of items
	 * @returns {Promise<void>}
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

	/**
	 * @param {Array<ReferenceId>} referencesIds
	 * @param {GetParams} params Extra params to use for fetching
	 * @returns {Promise<Object<string, EntityId>>} A mapping from ReferenceId to an EntityId
	 */
	mapIdByReferenceId(referenceIds, params = {}) {
		return this.mapIdBy('referenceId', referenceIds, params);
	}

	/**
	 * @param {strinng} field The field to filter
	 * @param {Array<string>} fieldValues The values of the field
	 * @param {GetParams} params Extra params to use for fetching
	 * @returns {Promise<Object<string, EntityId>>} A mapping from ReferenceId to an EntityId
	 */
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

	/**
	 * @param {*} item
	 */
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

	/**
	 * @param {*} item The entity to be saved
	 * @param {*} setOnInsert Fields to be saved only on insert
	 */
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

	/**
	 * @param {*} values Values to update
	 * @param {Filters} filter Filters that define which records to update
	 * @param {*} params Optional parameters to define some behavior of the query
	 */
	async update(values, filter, params) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'update');

		if(this.session && this.session.userId && isObject(values))
			values.userModified = this.session.userId;

		const result = await db.update(this, values, filter, params);

		if(isObject(filter))
			await this.logHelper.add('updated', { values, filter, params }, filter.id);

		return result;
	}

	/**
	 * Increment values in record
	 *
	 * @param {Filters} filters Unique filters
	 * @param {*} incrementData Values to Increment
	 * @returns The current record (updated or created)
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


	/**
	 * @param {*} item An item with a unique identifier
	 */
	async remove(item) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'remove');

		const result = await db.remove(this, item);

		if(isObject(item))
			await this.logHelper.add('removed', item, item.id);

		return result;
	}

	/**
	 * @param {Array<*>} items The items to insert
	 */
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

	/**
	 * @param {Array<*>} items The items to save
	 * @param {*} setOnInsert Fields to be saved only on insert
	 */
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

	/**
	 * @param {Filters} filter Filters that define which records to remove
	 */
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

		this.adminAccess = true;

		const db = await this.getDb();
		this.validateMethodImplemented(db, 'dropDatabase');

		return db.dropDatabase(this);
	}

	/**
	 * Change keys
	 *
	 * @param {Array<Entity>} items The items
	 * @param {string} newKey The new key
	 * @return {Object<string, Entity>} the new list of items with keys if exist
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

	/**
	 * Set custom data to log
	 *
	 * @param {string|Object} logMessageOrData data to log
	 */
	setLogData(logMessageOrData) {

		if(typeof logMessageOrData !== 'string' && !isObject(logMessageOrData))
			throw new Error('The custom data to log must be string or an object');

		if(isObject(logMessageOrData) && logMessageOrData.log && !isObject(logMessageOrData.log))
			throw new Error('The property name log in custom log data must be an object');

		this.logHelper.customLogData = {
			...typeof logMessageOrData === 'string' ? { message: logMessageOrData } : logMessageOrData
		};

		return this;
	}
}

// Keep this separated to avoid breaking typings
module.exports = Model;

/**
 * @template T
 * @typedef {(model: Model) => Promise<T>} QueryWithNoArguments
 */

/**
 * @template A
 * @template T
 * @typedef {(model: Model, arg1: A) => Promise<T>} QueryWithOneArgument
 */

/**
 * @template A
 * @template B
 * @template T
 * @typedef {(model: Model, arg1: A, arg2: B) => Promise<T>} QueryWithTwoArguments
 */

/**
 * @template A
 * @template B
 * @template C
 * @template T
 * @typedef {(model: Model, arg1: A, arg2: B, arg3: C) => Promise<T>} QueryWithThreeArguments
 */

/**
 * @typedef {GetParams | { key: string }} DistinctParams
 */

/**
 * @typedef Index
 * @property {Object<string, string | number>} key
 * @property {string} name
 * @property {boolean} [unique=false]
 * @property {number} [expireAfterSeconds]
 */

/** @typedef {QueryWithOneArgument<Index, boolean>} CreateIndex */
/** @typedef {QueryWithOneArgument<Array<Index>, boolean>} CreateIndexes */
/** @typedef {QueryWithOneArgument<DistinctParams, Array<Entity>>} Distinct */
/** @typedef {QueryWithNoArguments<boolean>} DropDatabase */
/** @typedef {QueryWithOneArgument<string, boolean>} DropIndex */
/** @typedef {QueryWithOneArgument<Array<string>, boolean>} DropIndexes */
/** @typedef {QueryWithOneArgument<GetParams, Array<Entity>>} Get */
/** @typedef {QueryWithNoArguments<Array<Index>>} GetIndexes */
/** @typedef {QueryWithThreeArguments<Filters, object, object, Entity>} Increment */
/** @typedef {QueryWithNoArguments<GetTotalsResult>} GetTotals */
/** @typedef {QueryWithOneArgument<object, EntityId>} Insert */
/** @typedef {QueryWithOneArgument<object, Array<Entity>>} MultiInsert */
/** @typedef {QueryWithOneArgument<Filters, number>} MultiRemove */
/** @typedef {QueryWithTwoArguments<Array<object>, object, boolean>} MultiSave */
/** @typedef {QueryWithOneArgument<object, boolean>} Remove */
/** @typedef {QueryWithTwoArguments<object, object, EntityId>} Save */
/** @typedef {QueryWithTwoArguments<object, Filters, number>} Update */

/**
 * @typedef DBDriver
 * @property {CreateIndex} [createIndex]
 * @property {CreateIndexes} [createIndexes]
 * @property {Distinct} [distinct]
 * @property {DropDatabase} [dropDatabase]
 * @property {DropIndex} [dropIndex]
 * @property {DropIndexes} [dropIndexes]
 * @property {Get} [get]
 * @property {GetIndexes} [getIndexes]
 * @property {GetTotals} [getTotals]
 * @property {Increment} [increment]
 * @property {Insert} [insert]
 * @property {MultiInsert} [multiInsert]
 * @property {MultiRemove} [multiRemove]
 * @property {MultiSave} [multiSave]
 * @property {Remove} [remove]
 * @property {Save} [save]
 * @property {Update} [update]
 */
