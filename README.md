# model

![Build Status](https://github.com/janis-commerce/model/workflows/Build%20Status/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/model/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/model?branch=master)
[![npm version](https://badge.fury.io/js/%40janiscommerce%2Fmodel.svg)](https://www.npmjs.com/package/@janiscommerce/model)

## 📦 Installation
```sh
npm install @janiscommerce/model
```

## 🔧 Database connection settings
In order to use this package with a DB, you must to add the database connection settings, it can be setted in service settings *`janiscommercerc.json`* **(Core model)** or in session **(Client Model)**.

#### Configure database connection with `databaseKey`
Regardless if you use a *Core* or *Client* model you may set the `databaseKey` that your model will use to get the database connection settings. Default: `'default'`.

```js
class MyModel extends Model {

	get databaseKey() {
		return 'myDatabaseKey';
	}
}
```

👀 Either in Core or Client model the `databaseKey` connection settings structure is the same:

:information_source: The `type` property is the only one used by this package to fetch the correct DB Driver package to use.  
:warning: The rest of the connection properties depends entirely by the DB Driver that you will use.

```js
{
	myDatabaseKey: {
		write: {
			"type": "mongodb",
			"host": "http://write-host-name.org",
			// ...
		},
		read: {
			"type": "mongodb",
			"host": "http://read-host-name.org",
			// ...
		}
	}
}
```

### :information_source: Model types
There are two different model types:

<details>
	<summary>🛠 <b>Core:</b> Intended for internal databases that manages common data between clients.</summary>

#### :one: Set the `databaseKey` in your Model extended class

```js
class MyModel extends Model {

	get databaseKey() {
		return 'core';
	}
}
```

#### :two: Model will try to find your `databaseKey` in database service settings

Using [Settings](https://www.npmjs.com/package/@janiscommerce/settings), with settings in file `/path/to/root/.janiscommercerc.json`:

```json
{
	"database": {
		"core": {
			"write":{
				"host": "http://my-host-name.org",
				"type": "mysql",
				// ...
			}
		}
	}
}
```
</details>

<details>
	<summary>👥 <b>Client:</b> Intended for only client databases that not shares data with other databases.</summary>

#### 💉 Session injection
The session injection is useful when you have a dedicated database per client.
Using the public setter `session`, the session will be stored in the `controller` instance.
All the controllers and models getted using that controller will have the session injected.

#### :one: Set the `databaseKey` in your Model extended class

```js
class MyModel extends Model {

	get databaseKey() {
		return 'myDatabaseKey';
	}
}
```

#### :two: Database connection configurated with session injected
Your client should have the config for read (optional) and/or write (required) databases.

**Example of received client:**
```json
{
	"name": "Some Client",
	"code": "some-client",

	"databases": {

		"default":{

			"write": {
				"type": "mongodb",
				"host": "http://default-host-name.org",
				// ...
			}
		},

		"myDatabaseKey": {

			"write": {
				"type": "mongodb",
				"host": "http://write-host-name.org",
				// ...
			},
			"read": {
				"type": "mongodb",
				"host": "http://read-host-name.org",
				// ...
			}
		}
	}
}
```
</details>

---

### :outbox_tray: Getters

* **shouldCreateLogs** (*static getter*).
Returns if the model should log the write operations. Default: `true`. For more details about logging, read the [logging](#Logging) section.

* **excludeFieldsInLog** (*static getter*).
Returns the fields that will be removed from the logs as an array of strings. For example: `['password', 'super-secret']`. For more details about logging, read the [logging](#Logging) section.

* **statuses** (*class getter*).
Returns an `object` with the default statuses (`active` / `inactive`)

---

### :inbox_tray: Setters

* **useReadDB** `[Boolean]` (*class setter*)
Set if model should use the read DB in all read/write DB operations. Default: `false`.

---

## :gear: API

### async `getDb()`
<details>
	<summary>Get the configured/sessionated DBDriver instance to use methods not supported by model.</summary>

#### Example:
```js
const dbDriver = await myModel.getDb();

await myModel.dbDriver.specialMethod(myModel);
```
</details>

### async `hasReadDB()`
<details>
	<summary>Returns <tt>true</tt> if the model databaseKey has a read DB available in settings, <tt>false</tt> otherwise or if the model is a core model.</summary>

#### Example:
```js
const hasReadDB = await myModel.hasReadDB();
```
</details>

### async  `get(params)`
<details>
	<summary>Returns items from database.</summary>

#### Parameters
- `params` is an optional Object with filters, order, paginator.

#### Example
```js
const items = await myModel.get({ filters: { status: 'active' } });
```
</details>

### async  `getById(id, [params])`
<details>
	<summary>It's an alias of <tt>get()</tt>, passing and ID as filter and handling return value as an array if <tt>id</tt> is an array, or an object otherwise.</summary>

#### Parameters
- `id` is required. It can be one ID or an array of IDs
- `params` is an optional Object with filters, order, paginator, changeKeys.

#### Example
```js
const items = await myModel.getById(123, { filters: { status: 'active' } });
```
</details>

### async  `getBy(field, id, [params])`
<details>
	<summary>It's an alias of <tt>get()</tt>, passing and field and the values of that field as filter and handling return value as an array if <tt>value</tt> is an array, or an object otherwise.</summary>

#### Parameters
- `field` is required. A string as a field
- `value` is required. It can be one value or an array of values
- `params` is an optional Object with filters, order, paginator.

#### Example
```js
const items = await myModel.getBy(orderId, 123, { filters: { status: 'active' } });
```
</details>

### async  `getPaged(params, callback)`
<details>
	<summary>Returns items from database using pages, the default limit is 500 items per page.</summary>

#### Parameters
- `params` See get() method
- `callback` A function to be executed for each page. Receives three arguments: the items found, the current page and the page limit

#### Example
```js
await myModel.getPaged({ filters: { status: 'active' } }, (items, page, limit) => {
	// items is an array with the result from DB
});
```
</details>

### async  `getTotals()`
<details>
	<summary>After performing a <tt>get()</tt> sometimes you need data of totals. This method returns an object with that information.</summary>

#### Result object structure:
- **pages**: The total pages for the filters applied
- **page**: The current page
- **limit**: The limit applied in get
- **total**: The total number of items in DB for the applied filters

#### Example
```js
await myModel.get({ filters: { status: 'active' } });
const totals = await myModel.getTotals();
/**
	totals content:
	{
		pages: 3,
		page: 1,
		limit: 500,
		total: 1450
	}
*/
```
</details>

### async  `mapIdBy(field, fieldValues, [params])`
<details>
	<summary>Search all items filtering by field and fieldValues and return an Object with key: <tt>referenceIds</tt> and values: <tt>id</tt>, only those founds.</summary>

#### Parameters
- `field` Field to filter for (`String`)
- `fieldValues` List of values to filter for (`Array<strings>`)
- `params` See get() method

#### Example
```js
await myModel.mapIdBy('code', ['code-123', 'code-456'], {
	order: { code: 'desc' }
});

/**
	{
		code-456: 'the-code-456-id',
		code-123: 'the-code-123-id'
	}
*/
```
</details>

### async  `mapIdByReferenceId(referencesIds, [params])`
<details>
	<summary>Search all References Ids and return an Object with key: <tt>referenceIds</tt> and values: <tt>id</tt>, only those founds.</summary>

#### Parameters
- `referencesIds` List of References Ids (`Array<strings>`)
- `params` See get() method

#### Example
```js
await myModel.mapIdByReferenceId(['some-ref-id', 'other-ref-id', 'foo-ref-id'], {
	order: { date: 'asc' },
	filters: { foo: 'bar' }
});

/**
	{
		some-ref-id: 'some-id',
		foo-ref-id: 'foo-id'
	}
*/
```
</details>

### async  `distinct(key, params)`
<details>
	<summary>Returns unique values of the key field from database.</summary>

#### Parameters
- `params` is an optional Object with filters.

#### Examples
```js
const uniqueValues = await myModel.distinct('status');
```

```js
const uniqueValues = await myModel.distinct('status', {
	filters: {
		type: 'some-type'
	}
});
```
</details>

### async  `insert(item)`
<details>
	<summary>Inserts an item in DB. This method is only for insert, will not perform an update.</summary>

#### Example
```js
await myModel.insert({ foo: 'bar' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	itemInserted content:
	[
		{
			foo: 'bar'
		}
		//...
	]
*/
```
</details>

### async  `save(item, setOnInsert)`
<details>
	<summary>Inserts/updates an item in DB. This method will perfrom an upsert.</summary>

#### Parameters
- `setOnInsert` to add default values on Insert, optional

#### Example
```js
await myModel.save({ foo: 'bar' }, { status: 'active' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	items content:
	[
		{
			foo: 'bar',
			status: 'active'
		}
		//...
	]
*/
```
</details>

### async  `update(values, filter)`
<details>
	<summary>Update items that match with the <tt>filter</tt>.</summary>

#### Example
```js
await myModel.update({ updated: 1 }, { status: 5 });
// will set updated = 1 for the items that has status = 5
```
</details>

### async  `remove(item)`
<details>
	<summary>Remove an item from DB.</summary>

#### Example
```js
await myModel.remove({ foo: 'bar' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	items content:
	[]
*/
```
</details>

### async  `multiInsert(items)`
<details>
	<summary>Perform a bulk insert of items in DB. This action will insert elements, and will not update elements.
</summary>

#### Example
```js
await myModel.multiInsert([{ foo: 1 }, { foo: 2 }]);

const items = await myModel.get();

/**
	items content:
	[
		{ foo: 1 },
		{ foo: 2 }
	]
*/
```
</details>

### async  `multiSave(items, setOnInsert)`
<details>
	<summary>Perform a bulk save of items in DB. This action will insert/update (upsert) elements.</summary>

#### Parameters
- `setOnInsert` to add default values on Insert, optional

#### Example
```js
await myModel.multiSave([{ foo: 1 }, { foo: 2, status: 'pending' }], { status: 'active' });

const items = await myModel.get();

/**
	items content:
	[
		{ foo: 1, status: 'active' },
		{ foo: 2, status: 'pending' }
	]
*/
```
</details>

### async  `multiRemove(filter)`
<details>
	<summary>Perform a bulk remove of items in DB.</summary>

#### Example
```js
await myModel.multiRemove({ status: 2 });

const items = await myModel.get({ filters: { status: 2 }});

/**
	items content:
	[]
*/
```
</details>

### async  `increment(filters, incrementData)`
<details>
	<summary>Increment/decrement values from an item in DB. This method will not perfrom an upsert.</summary>

#### Example
```js
await myModel.increment({ uniqueIndex: 'bar' }, { increment: 1, decrement: -1 });

/**

before:
	items content:
	[
		{
			increment: 1,
			decrement: 2
		}
		//...
	]

after:
	items content:
	[
		{
			increment: 2,
			decrement: 1
		}
		//...
	]
*/
```
</details>

### static  `changeKeys(items, newKey)`
<details>
	<summary>Creates an <tt>object</tt> list from the received array of items, using the specified field as keys.</summary>

#### Parameters
- `items` The items array
- `newKey` The common field in items that will be used as key for each item

#### Example
```js
const myItems = await myModel.get();

/*  
	[
		{ some: 'item', otherProp: false },
		{ some: 'otherItem', otherProp: true }
	]
*/

const myItemsByKey = MyModel.changeKeys(myItems, 'some');

/*
	{
		item: { some: 'item', otherProp: false },
		otherItem: { some: 'otherItem', otherProp: true }
	}
*/
```

:information_source: In get methods such as `get` and `getBy` you can add the `changeKeys` param with the `newKey` value.

```js
const myItems = await myModel.get({ changeKeys: 'some' });

/*
	{
		item: { some: 'item', otherProp: false },
		otherItem: { some: 'otherItem', otherProp: true }
	}
*/
```
</details>

### async `dropDatabase()`
<details>
	<summary>Drop the Database.</summary>

#### Example
```js
await myModel.dropDatabase();
```
</details>

---

### :bookmark_tabs: Indexes Manipulation 
##### :warning: Only if DB Driver supports it

### async `getIndexes()`
<details>
	<summary>Get an <i>array</i> of indexes in Database table.</summary>

### Example
```js
await myModel.getIndexes();

/*
	[
		{ name: '_id_', key: { _id_: 1}, unique: true },
		{ name: 'code', key: { code: 1} }
	]
*/
```
</details>

### async `createIndex(index)`
<details>
	<summary>Create a single index in Database Table.</summary>

#### Example
```js
await myModel.createIndex({ name: 'name', key: { name: 1}, unique: true });
```
</details>

### async `createIndexes(indexes)`
<details>
	<summary>Create a multiple indexes in Database Table.</summary>

#### Example
```js
await myModel.createIndexes([{ name: 'name', key: { name: 1}, unique: true }, { name: 'code', key: { code: -1 }}]);
```
</details>

### async `dropIndex(name)`
<details>
	<summary>Drop a single in Database Table.</summary>

#### Example
```js
await myModel.dropIndex('name');
```
</details>

### async `dropIndexes(names)`
<details>
	<summary>Drop multiple indexes in Database Table.</summary>

#### Example
```js
await myModel.dropIndexes(['name', 'code']);
```
</details>

---

## :clipboard: Logging
This package automatically logs any write operation such as:
- insert
- multiInsert
- update
- save
- multiSave
- increment
- remove
- multiRemove

### :no_mouth: Disabling automatic logging
<details>
	<summary>You can disable this functionality by setting the <tt>static getter shouldCreateLogs</tt> to <tt>false</tt>.</summary>

#### Example
```js
class MyModel extends Model {

	static get shouldCreateLogs() {
		return false;
	}
}

```
</details>

### :no_entry_sign: Excluding fields from logs
<details>
	<summary>You can exclude fields for logs in case you have sensitive information in your entries such as passwords, addresses, etc.</summary>

#### Specify the fields to exclude by setting them in the `static getter` `excludeFieldsInLog`:
```js
class MyModel extends Model {

	static get excludeFieldsInLog() {
		return [
			'password',
			'address',
			'secret'
		]
	}
}

```

By setting this when you do an operation with an item like:
```js
await myModel.insert({
	user: 'johndoe',
	password: 'some-password',
	contry: 'AR',
	address: 'Fake St 123'
});

```

It will be logged as:
```js
{
	id: '5ea30bcbe28c55870324d9f0',
	user: 'johndoe',
	contry: 'AR'
}
```
</details>