# model

[![Build Status](https://travis-ci.org/janis-commerce/model.svg?branch=master)](https://travis-ci.org/janis-commerce/model)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/model/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/model?branch=master)

## Installation
```sh
npm install @janiscommerce/model
```

> :warning: From version 4.0.0,  in order to use this package , [@janiscommerce/log@3.x](https://www.npmjs.com/package/@janiscommerce/log) is required as peer dependecy.


## Session injection
The session injection is useful when you have a dedicated database per client.
Using the public setter `session`, the session will be stored in the `controller` instance.
All the controllers and models getted using that controller will have the session injected.

## Database Dispatcher
The `Model` uses [Database Dispatcher](https://www.npmjs.com/package/@janiscommerce/database-dispatcher) for getting the correct **DBDriver** for a `Model`.
The *DBDriver* will perform all the queries to the database.

### Configure Database connection with databaseKey
If you have the connection settings you should add a `databaseKey` getter in you `Model`.

```js
class MyModel extends Model {

	get databaseKey() {
		return 'core';
	}
}

```

Database Dispatcher will try to use one of the following settings

Using [Settings](https://www.npmjs.com/package/@janiscommerce/settings), with settings in file `/path/to/root/.janiscommercerc.json`:

```json
{
	"database": {
		"core": {
			"host": "http://my-host-name.org",
			"type": "mysql",
			// ...
		}
	}
}
```

### Database connection configurated with session injected
When your `Model` is a Client Model, and the database connection settings are in the injected session, you don't need to configurate the `databaseKey`.
You can add database connection settings by adding the field names from the received client that contains the settings, with the setting what will be passed to the DBDriver. Also you can add config for read/write databases.

**Example of settings:**
```json
// .janiscommercerc.json
{
	"databaseWriteType" : "someDBDriver",
	"databaseReadType": "someOtherDBDriver",
	"clients": {
		"database": {
			"fields": {
				"databaseKey": "core",
				"table": "clients",
				"identifierField": "code",
				"read": {
					"dbReadHost" : "host",
					"dbReadProtocol" : "protocol",
					"dbReadPort" : "port",
					"elasticSearchPrefix" : "name",
					"elasticSearchAws" : "awsCredentials"
				},
				"write": {
					"dbWriteHost" : "host",
					"dbWriteProtocol" : "protocol",
					"dbWriteDatabase" : "database",
					"dbWriteUser" : "user",
					"dbWritePassword" : "password",
					"dbWritePort" : "port"
				}
			}
		}
	}
}

/*

	Received client:

	{
		"name": "someclient",
		"dbReadHost": "http://localhost",
		"dbReadPort": 27017,
		"elasticSearchPrefix": "someclient",
		"elasticSearchAws": true
	}

	Database connection settings:

	{
		"host": "http://localhost",
		"port": 27017,
		"prefix": "someclient",
		"awsCredentials": true
	}

*/
```

## API

### Getters

* **shouldCreateLogs** (*static getter*).
Returns if the model should log the write operations. Default: `true`. For more details about logging, read the [logging](#Logging) section.

* **excludeFieldsInLog** (*static getter*).
Returns the fields that will be removed from the logs as an array of strings. For example: `['password', 'super-secret']`. For more details about logging, read the [logging](#Logging) section.

* **statuses** (*class getter*).
Returns an `object` with the default statuses (`active` / `inactive`)

```js
console.log(Model.statuses);

/*
	{
		active: 'active',
		inactive: 'inactive'
	}
*/
```

### const items = await myModel.get(params)

- Returns items from database

`params` is an optional Object with filters, order, paginator.

```js
const items = await myModel.get({ filters: { status: 'active' } });
```

### const item = await myModel.getById(id, [params])
- It's an alias of get(), passing and ID as filter and handling return value as an array if `id` is an array, or an object otherwise.

`id` is required. It can be one ID or an array of IDs
`params` is an optional Object with filters, order, paginator.

```js
const items = await myModel.getById(123, { filters: { status: 'active' } });
```

### const item = await myModel.getBy(field, id, [params])
- It's an alias of get(), passing and field and the values of that field as filter and handling return value as an array if `value` is an array, or an object otherwise.

`field` is required. A string as a field
`value` is required. It can be one value or an array of values
`params` is an optional Object with filters, order, paginator.

```js
const items = await myModel.getBy(orderId, 123, { filters: { status: 'active' } });
```

### myModel.getPaged(params, callback)
- Returns items from database using pages, the default limit is 500 items per page.

`params` See get() method
`callback` A function to be executed for each page. Receives three arguments: the items found, the current page and the page limit

```js
await myModel.getPaged({ filters: { status: 'active' } }, (items, page, limit) => {
	// items is an array with the result from DB
});
```

### myModel.getTotals()

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

### myModel.mapIdByReferenceId(referencesIds)

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

### const uniqueValues = await myModel.distinct(key, params)

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

### myModel.insert(item)

- Inserts an item in DB. This method is only for insert, will not update perform an update.

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

### myModel.save(item, setOnInsert)

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

### myModel.update(values, filter)

- Update items that match with the `filter`.

```js
await myModel.update({ updated: 1 }, { status: 5 });
// will set updated = 1 for the items that has status = 5
```

### myModel.remove(item)

- Remove an item from DB.

```js
await myModel.remove({ foo: 'bar' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	items content:
	[]
*/

```

### myModel.multiInsert(items)

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


### myModel.multiSave(items, setOnInsert)

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

### myModel.multiRemove(filter)

- Perform a bulk remove of items in DB.

```js
await myModel.multiRemove({ status: 2 });

const items = await myModel.get({ filters: { status: 2 }});

/**
	items content:
	[]
*/

```

### myModel.increment(filters, incrementData)

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

### Indexes Manipulation

> Only if Database support it

#### myModel.getIndexes()

- Get an *array<Object>* of Indexes in Database table

```js
await myModel.getIndexes();

/*
	[
		{ name: '_id_', key: { _id_: 1}, unique: true },
		{ name: 'code', key: { code: 1} }
	]
*/

```

#### myModel.createIndex(index)

- Create a single index in Database Table.

```js
await myModel.createIndex({ name: 'name', key: { name: 1}, unique: true });

```

#### myModel.createIndexes(indexes)

- Create a multiple indexes in Database Table.

```js
await myModel.createIndexes([{ name: 'name', key: { name: 1}, unique: true }, { name: 'code', key: { code: -1 }}]);

```

#### myModel.dropIndex(name)

- Drop a single in Database Table.

```js
await myModel.dropIndex('name');

```

#### myModel.dropIndexes(names)

- Drop multiple indexes in Database Table.

```js
await myModel.dropIndexes(['name', 'code']);

```

#### myModel.getDb()

- Get the configured/sessionated DBDriver instance to use methods not supported by model.

```js
const dbDriver = await myModel.getDb();

await dbDriver.specialMethod(myModel);

```

## Logging
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