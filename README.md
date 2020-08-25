# model

[![Build Status](https://travis-ci.org/janis-commerce/model.svg?branch=master)](https://travis-ci.org/janis-commerce/model)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/model/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/model?branch=master)

## 📦 Installation
```sh
npm install @janiscommerce/model
```

## 🔧 Database connection settings
In order to use this package with a DB, you must to add the database connection settings, it can be setted in service settings *`janiscommercerc.json`* **(Core model)** or in session **(Client Model)**.

#### Configure database connection with `databaseKey`
Regardless if you use a *Core* or *Client* model you should set the `databaseKey` that your model will use to get the database connection settings. Default: `'default'`.

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


<details>
	<summary><h3 style="display: inline;">🛠 Setting up a core model</h3></summary>

#### :one: Set the `databaseKey` in your Model extended class

```js
class MyModel extends Model {

	get databaseKey() {
		return 'core';
	}
}
```

#### :two: Model will try to find your databaseKey in database service settings

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
	<summary><h3 style="display: inline;">👥 Setting up a client model</h3></summary>

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
Set if model should use the read DB in all methods that reads data from DB. (Same as using `{ readonly: true }` param in read methods). Default: `false`.

---

## :gear: API

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getDb()</tt></summary>

- Get the configured/sessionated DBDriver instance to use methods not supported by model.

```js
const dbDriver = await myModel.getDb();

await myModel.dbDriver.specialMethod(myModel);
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>hasReadDB()</tt></h4></summary>

- Returns `true` if the model databaseKey has a read DB available in settings, `false` otherwise or if the model is a core model.

```js
const hasReadDB = await myModel.hasReadDB();
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>get(params)</tt></h4></summary>

- Returns items from database

`params` is an optional Object with filters, order, paginator.

```js
const items = await myModel.get({ filters: { status: 'active' } });
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getById(id, [params])</tt></h4></summary>

- It's an alias of get(), passing and ID as filter and handling return value as an array if `id` is an array, or an object otherwise.

`id` is required. It can be one ID or an array of IDs
`params` is an optional Object with filters, order, paginator, changeKeys.

```js
const items = await myModel.getById(123, { filters: { status: 'active' } });
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getBy(field, id, [params])</tt></h4></summary>

- It's an alias of get(), passing and field and the values of that field as filter and handling return value as an array if `value` is an array, or an object otherwise.

`field` is required. A string as a field
`value` is required. It can be one value or an array of values
`params` is an optional Object with filters, order, paginator.

```js
const items = await myModel.getBy(orderId, 123, { filters: { status: 'active' } });
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getPaged(params, callback)</tt></h4></summary>

- Returns items from database using pages, the default limit is 500 items per page.

`params` See get() method
`callback` A function to be executed for each page. Receives three arguments: the items found, the current page and the page limit

```js
await myModel.getPaged({ filters: { status: 'active' } }, (items, page, limit) => {
	// items is an array with the result from DB
});
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getTotals()</tt></h4></summary>

- After performing a `get()` sometimes you need data of totals. This method returns an object with that information.

Result object structure:
**pages**: The total pages for the filters applied
**page**: The current page
**limit**: The limit applied in get
**total**: The total number of items in DB for the applied filters

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>mapIdByReferenceId(referencesIds)</tt></h4></summary>

- Search all References Ids and return an Object with key: `referenceIds` and values: `id`, only those founds.
- **referencesIds**: `Array<strings>` List of References Ids


```js
await myModel.mapIdByReferenceId(['some-ref-id', 'other-ref-id', 'foo-ref-id']);

/**
	{
		some-ref-id: 'some-id',
		foo-ref-id: 'foo-id'
	}
*/
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>distinct(key, params)</tt></h4></summary>

- Returns unique values of the key field from database

`params` is an optional Object with filters.

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>insert(item)</tt></h4></summary>

- Inserts an item in DB. This method is only for insert, will not perform an update.

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>save(item, setOnInsert)</tt></h4></summary>

- Inserts/updates an item in DB. This method will perfrom an upsert.
- `setOnInsert` to add default values on Insert, optional

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>update(values, filter)</tt></h4></summary>

- Update items that match with the `filter`.

```js
await myModel.update({ updated: 1 }, { status: 5 });
// will set updated = 1 for the items that has status = 5
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>remove(item)</tt></h4></summary>

- Remove an item from DB.

```js
await myModel.remove({ foo: 'bar' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	items content:
	[]
*/
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>multiInsert(items)</tt></h4></summary>

- Perform a bulk insert of items in DB. This action will insert elements, and will not update elements.

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>multiSave(items, setOnInsert)</tt></h4></summary>

- Perform a bulk save of items in DB. This action will insert/update (upsert) elements.
- `setOnInsert` to add default values on Insert, optional

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>multiRemove(filter)</tt></h4></summary>

- Perform a bulk remove of items in DB.

```js
await myModel.multiRemove({ status: 2 });

const items = await myModel.get({ filters: { status: 2 }});

/**
	items content:
	[]
*/
```
</details>

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>increment(filters, incrementData)</tt></h4></summary>

- Increment/decrement values from an item in DB. This method will not perfrom an upsert.

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

<details>
	<summary><h4 style="display: inline;font-weight:400;"><b style="color:darkred;">static</b> <tt>changeKeys(items, newKey)</tt></h4></summary>

- Creates an `object` list from the received array of items, using the specified field as keys.
- `items` The items array
- `newKey` The common field in items that will be used as key for each item

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

### :bookmark_tabs: Indexes Manipulation 
##### :warning: Only if database supports it

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>getIndexes()</tt></summary>

- Get an *array* of indexes in Database table

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

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>createIndex(index)</tt></summary>

- Create a single index in Database Table.

```js
await myModel.createIndex({ name: 'name', key: { name: 1}, unique: true });
```
</details>

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>createIndexes(indexes)</tt></summary>

- Create a multiple indexes in Database Table.

```js
await myModel.createIndexes([{ name: 'name', key: { name: 1}, unique: true }, { name: 'code', key: { code: -1 }}]);
```
</details>

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>dropIndex(name)</tt></summary>

- Drop a single in Database Table.

```js
await myModel.dropIndex('name');
```
</details>

<details>
	<summary><h4 style="display:inline;font-weight:400;"><b style="color:darkmagenta;">async</b> <tt>dropIndexes(names)</tt></summary>

- Drop multiple indexes in Database Table.

```js
await myModel.dropIndexes(['name', 'code']);
```
</details>

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

#### You can disable this functionality by setting the `static getter` `shouldCreateLogs` to false:
```js
class MyModel extends Model {

	static get shouldCreateLogs() {
		return false;
	}
}

```

### Excluding fields from logs
You can exclude fields for logs in case you have sensitive information in your entries such as passwords, addresses, etc.

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