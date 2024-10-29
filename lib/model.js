'use strict';

const DatabaseDispatcher = require('./helpers/database-dispatcher');

const LogHelper = require('./helpers/log');

const ModelError = require('./model-error');

const { isObject, isEmpty } = require('./helpers/utils');

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

/**
 * @typedef {object} UpdateOperation
 * Describes the parameters for an update operation in database.
 * This includes both the selection criteria and the new data to apply.
 *
 * @property {object} filter - The filter conditions used to select the documents to update.
 * For example, { age: { $gt: 18 } } selects documents where the age field is greater than 18.
 *
 * @property {object} data - The new values for the selected documents properties.
 * Each key-value pair represents a property to update and the new value to set.
 * For example, { name: "John", age: 30 } sets the 'name' to "John" and 'age' to 30.
 */

class Model {

	get databaseKey() {
		return 'default';
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

	static get defaultGetPagedOrder() {
		return { id: 'asc' };
	}

	static get statuses() {
		return {
			active: 'active',
			inactive: 'inactive'
		};
	}

	getDb() {

		if(!this.databaseDispatcher)
			this.databaseDispatcher = this.session ? this.session.getSessionInstance(DatabaseDispatcher) : new DatabaseDispatcher();

		// console.log(this.databaseKey, !!this.useReadDB);

		return this.databaseDispatcher.getDb(this.databaseKey, !!this.useReadDB);
	}

	/**
	 * @param {DBDriver} dbDriver A database driver
	 * @param {string} methodName A method name to check for existence in the DB Driver
	 * @param {boolean} strict Determinate if should reject when Driver does not have implemented the method
	 * @throws {ModelError} If method is not present in dbDriver
	 */
	isMethodImplemented(dbDriver, methodName, strict = true) {

		if(methodName in dbDriver)
			return true;

		if(strict)
			throw new ModelError(`${methodName} method not supported by driver`, ModelError.codes.DRIVER_METHOD_NOT_IMPLEMENTED);

		return false;
	}

	setExecutionStart() {
		this.executionStart = Date.now();
	}

	get executionTime() {
		return Date.now() - this.executionStart;
	}

	addCreatedData(item) {

		item.userCreated = item.userCreated || this.session?.userId || null;
		item.dateCreated = item.dateCreated || new Date();

		return item;
	}

	addModifiedData(item = {}) {

		item.userModified = item.userModified || this.session?.userId || null;
		item.dateModified = item.dateModified || new Date();

		return item;
	}

	async getIndexes() {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'getIndexes');

		this.setExecutionStart();

		return db.getIndexes(this);
	}

	/**
	 * @param {Array<Index>} indexes
	 */
	async createIndexes(indexes) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'createIndexes');

		this.setExecutionStart();

		return db.createIndexes(this, indexes);
	}

	/**
	 * @param {Index} index
	 */
	async createIndex(index) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'createIndex');

		this.setExecutionStart();

		return db.createIndex(this, index);
	}

	/**
	 * @param {string} name
	 */
	async dropIndex(name) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'dropIndex');

		this.setExecutionStart();

		return db.dropIndex(this, name);
	}

	/**
	 * @param {Array<string>} names
	 */
	async dropIndexes(names) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'dropIndexes');

		this.setExecutionStart();

		return db.dropIndexes(this, names);
	}

	/**
	 * @param {string} key
	 * @param {GetParams} params
	 */
	async distinct(key, params = {}) {

		this.useReadDB = !!params.readonly;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'distinct');

		this.setExecutionStart();

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
		this.isMethodImplemented(db, 'get');

		this.setExecutionStart();

		const items = await db
			.get(this, params);

		if(typeof items === 'undefined')
			return null;

		const results = await this._prepareGetResults(items, params);

		return results;
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
			return params.changeKeys ? {} : [];

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

		if(isEmpty(value))
			throw new ModelError('The value must be defined or not empty', ModelError.codes.INVALID_VALUE);

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
	 * Get Paged database data
	 *
	 * @param {GetParams} data Data for where
	 * @param {GetPagedCallback} callback Function to call for each batch of items
	 * @returns {Promise<void>}
	 */
	// eslint-disable-next-line default-param-last
	async getPaged(data = {}, callback) {

		const db = await this.getDb();

		if(this.isMethodImplemented(db, 'getPaged', false))
			return db.getPaged(this, data, callback);

		if(!callback || typeof callback !== 'function')
			throw new ModelError('Callback should be a function', ModelError.codes.WRONG_CALLBACK);

		// se copia para que no se alteren las paginas y limites originales
		const params = { ...data };

		if(!params.page)
			params.page = 1;

		if(!params.limit)
			params.limit = this.constructor.defaultPageLimit;

		if(!params.order)
			params.order = this.constructor.defaultGetPagedOrder;

		const items = await this.get(params);

		if(!items || !items.length)
			return;

		await callback.call(null, items, params.page, params.limit);

		const newParams = { ...params };

		newParams.page++;

		if(items.length === newParams.limit)
			await this.getPaged(newParams, callback);
	}

	async getTotals(filters) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'getTotals');

		return db.getTotals(this, filters);
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
	 * @param {String} field The field to filter
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
	 * @param {Object} item
	 */
	async insert(item) {

		if(!isObject(item))
			throw new ModelError('Item to insert must be an Object', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'insert');

		this.addCreatedData(item);
		this.addModifiedData(item); // to standardize write methods (insert(), update(), save(), multiSave())

		this.setExecutionStart();

		const result = await db.insert(this, item);

		await this.logHelper.add('inserted', { executionTime: this.executionTime, item }, result);

		return result;
	}

	/**
	 * @param {Object} item The entity to be saved
	 * @param {*} setOnInsert Fields to be saved only on insert
	 */
	async save(item, setOnInsert = {}) {

		if(!isObject(item))
			throw new ModelError('Item to save must be an Object', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'save');

		this.addCreatedData(setOnInsert);
		this.addModifiedData(item); // to standardize write methods (insert(), update(), save(), multiSave())

		this.setExecutionStart();

		const result = await db.save(this, item, setOnInsert);

		await this.logHelper.add('upserted', { executionTime: this.executionTime, item }, result);

		return result;
	}

	/**
	 * @param {*} values Values to update
	 * @param {Filters} filter Filters that define which records to update
	 * @param {*} params Optional parameters to define some behavior of the query
	 */
	async update(values, filter, params) {

		if(!isObject(values) && !Array.isArray(values))
			throw new ModelError('Values to update must be an Object or an Array', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'update');

		if(!params?.skipAutomaticSetModifiedData) {
			if(Array.isArray(values))
				values.push(this.addModifiedData());
			else
				this.addModifiedData(values);
		}

		this.setExecutionStart();

		const result = await db.update(this, values, filter, params);

		await this.logHelper.add('updated', { executionTime: this.executionTime, values, filter, params }, isObject(filter) && filter.id);

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

		const updatedData = this.addModifiedData();

		const db = await this.getDb();
		this.isMethodImplemented(db, 'increment');

		this.setExecutionStart();

		const result = await db.increment(this, filters, incrementData, updatedData);

		await this.logHelper.add('incremented', { executionTime: this.executionTime, incrementData, updatedData, result }, result._id.toString()); // eslint-disable-line no-underscore-dangle, max-len

		return result;
	}

	/**
	 * @param {Object} item An item with a unique identifier
	 */
	async remove(item) {

		if(!isObject(item))
			throw new ModelError('Item to remove must be an Object', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'remove');

		this.setExecutionStart();

		const result = await db.remove(this, item);

		await this.logHelper.add('removed', { executionTime: this.executionTime, item }, item.id);

		return result;
	}

	/**
	 * @param {Array<Object>} items The items to insert
	 */
	async multiInsert(items) {

		if(!Array.isArray(items))
			throw new ModelError('Items must be an Object Array to be inserted', ModelError.codes.INVALID_VALUE);

		if(!items.length)
			throw new ModelError('Items must not be empty to be inserted', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'multiInsert');

		items = items.map(item => {

			if(!isObject(item))
				throw new ModelError('Each item to be inserted must be an Object', ModelError.codes.INVALID_VALUE);

			this.addCreatedData(item);

			// to standardize write methods (insert(), update(), save(), multiSave())
			this.addModifiedData(item);

			return item;
		});

		this.setExecutionStart();

		const result = await db.multiInsert(this, items);

		await this.logHelper.addByItem('inserted', Array.isArray(result) ? result : items, this.executionTime);

		return result;
	}

	/**
	 * @param {Array<*>} items The items to save
	 * @param {*} setOnInsert Fields to be saved only on insert
	 */
	async multiSave(items, setOnInsert = {}) {

		if(!Array.isArray(items))
			throw new ModelError('Items must be an Object Array to be saved', ModelError.codes.INVALID_VALUE);

		if(!items.length)
			throw new ModelError('Items must not be empty to be saved', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'multiSave');

		this.addCreatedData(setOnInsert);

		items = items.map(item => {

			if(!isObject(item))
				throw new ModelError('Each item to be saved must be an Object', ModelError.codes.INVALID_VALUE);

			// to standardize write methods (insert(), update(), save(), multiSave())
			this.addModifiedData(item);

			return item;
		});

		this.setExecutionStart();

		const result = await db.multiSave(this, items, setOnInsert);

		await this.logHelper.addByItem('upserted', items, this.executionTime);

		return result;
	}

	/**
	 * @param {Filters} filter Filters that define which records to remove
	 */
	async multiRemove(filter) {

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'multiRemove');

		this.setExecutionStart();

		const result = await db.multiRemove(this, filter);

		await this.logHelper.add('removed', { executionTime: this.executionTime, filter }, isObject(filter) && filter.id);

		return result;
	}

	async dropDatabase() {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'dropDatabase');

		this.setExecutionStart();

		return db.dropDatabase(this);
	}

	/**
	 * Use aggregates operations to obtain a computed result. Can only be used with MongoDB driver
	 * @async
	 * @param {object[]} stages A list of stages to be executed
	 * @returns {Promise<object[]>} The result of the operations
	 */
	async aggregate(stages) {

		const db = await this.getDb();
		this.isMethodImplemented(db, 'aggregate');

		this.setExecutionStart();

		return db.aggregate(this, stages);
	}

	/**
	 * Use multiUpdate to update multiple documents with different filters and values. Can only be used with MongoDB driver
	 * @async
	 * @param {UpdateOperation[]} operations A list of db operations to be executed
	 * @returns {Promise<object[]>} The result of the operations
	 */
	async multiUpdate(operations) {

		if(!Array.isArray(operations))
			throw new ModelError('Operations must be an Object Array to be saved', ModelError.codes.INVALID_VALUE);

		if(!operations.length)
			throw new ModelError('Operations must not be empty to be saved', ModelError.codes.INVALID_VALUE);

		this.useReadDB = false;

		const db = await this.getDb();
		this.isMethodImplemented(db, 'multiUpdate');

		operations.forEach(operation => {

			operation = operation || {};

			if(!isObject(operation.data) && !Array.isArray(operation.data))
				throw new ModelError('Values to update must be an Object or an Array', ModelError.codes.INVALID_VALUE);

			// to standardize write methods (insert(), update(), save(), multiSave(), multiUpdate())
			if(Array.isArray(operation.data))
				operation.data.push(this.addModifiedData());
			else
				this.addModifiedData(operation.data);
		});

		this.setExecutionStart();

		return db.multiUpdate(this, operations);
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
	 * @param {string|import('@janiscommerce/log').LogData} logMessageOrData The log message as a string or custom data to log as an object
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

	/**
	 * Disables the automatic logs only for the next operation
	 *
	 */
	disableLogs() {
		this.logHelper.disable = true;
		return this;
	}

	/**
	 * Returns a function to validate id.
	 * ID type will vary depending on which database the model implements
	 * @async
	 * @returns {Function}
	 */
	async getIdStruct() {

		if(process.env.TEST_ENV === 'true' || !process.env.JANIS_ENV)
			return;

		const db = await this.getDb();
		return db.idStruct;
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
