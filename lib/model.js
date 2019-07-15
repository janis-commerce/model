'use strict';

const DatabaseDispatcher = require('@janiscommerce/database-dispatcher');

const ModelError = require('./model-error');

const ClientFields = require('./client-fields');

const DEFAULT_PAGE_LIMIT = 500;

class Model {

	set client(client) {
		this._client = client;
	}

	get client() {
		return this._client;
	}

	static get defaultPageLimit() {
		return DEFAULT_PAGE_LIMIT;
	}

	get clientDBConfig() {

		if(typeof this._dbConfig === 'undefined') {

			const clientFields = ClientFields.get();

			this._dbConfig = {
				read: {
					type: this.client[clientFields.read.type],
					host: this.client[clientFields.read.host],
					database: this.client[clientFields.read.database],
					user: this.client[clientFields.read.user],
					password: this.client[clientFields.read.password],
					port: this.client[clientFields.read.port]
				},
				write: {
					type: this.client[clientFields.write.type],
					host: this.client[clientFields.write.host],
					database: this.client[clientFields.write.database],
					user: this.client[clientFields.write.user],
					password: this.client[clientFields.write.password],
					port: this.client[clientFields.write.port]
				}
			};
		}

		const dbType = this.useReadDB ? 'read' : 'write';
		return this._dbConfig[dbType];
	}

	get db() {

		if(this.databaseKey)
			return DatabaseDispatcher.getDatabaseByKey(this.databaseKey);

		if(this.client)
			return DatabaseDispatcher.getDatabaseByConfig(this.clientDBConfig);

		throw new ModelError(`Invalid Model ${this.constructor.name} - No database config`, ModelError.codes.DATABASE_CONFIG_NOT_FOUND);
	}

	async get(params = {}) {
		this.useReadDB = !!params.readonly;

		const items = await this.db
			.get(this, params);

		if(typeof items === 'undefined')
			return null;

		const results = await this._prepareGetResults(items, params);

		return results;
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
			this.getPaged(newParams, callback);
	}

	async getTotals() {
		return this.db.getTotals(this);
	}

	async insert(item) {
		return this.db.insert(this, item);
	}

	async save(item) {
		return this.db.save(this, item);
	}

	async update(values, filter) {
		return this.db.update(this, values, filter);
	}

	async remove(item) {
		return this.db.remove(this, item);
	}

	async multiInsert(items) {
		return this.db.multiInsert(this, items);
	}

	async multiSave(items) {
		return this.db.multiSave(this, items);
	}

	async multiRemove(filter) {
		return this.db.multiRemove(this, filter);
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
}

module.exports = Model;
