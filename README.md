# model

[![Build Status](https://travis-ci.org/janis-commerce/model.svg?branch=master)](https://travis-ci.org/janis-commerce/model)
[![Coverage Status](https://coveralls.io/repos/github/janis-commerce/model/badge.svg?branch=master)](https://coveralls.io/github/janis-commerce/model?branch=master)

## Installation
```sh
npm install @janiscommerce/model
```

## Client injection
The client injection is useful when you have a dedicated database per client.
Using the public setter `client`, the client will be stored in the `controller` instance.
All the controllers and models getted using that controller will have the client injected.

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

### Database connection configurated with client injected
When your `Model` is a Client Model, and the database connection settings are in the injected client, you don't need to configurate the `databaseKey`.  
You can add database connection settings by adding the field names from the received client that contains the settings, with the setting what will be passed to the DBDriver. Also you can add config for read/write databases.

**Example of settings:**
```json
// .janiscommercerc.json
{
	"clients": {
		"database": {
			"databaseWriteType" : "someDBDriver",
			"databaseReadType": "someOtherDBDriver",
			"fields": {
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

### const items = await myModel.get(params)
- Returns items from database
Params is an optional Object with filters, order, paginator.
```js
const items = await myModel.get({ filters: { status: 'active' } });
```

### myModel.getPaged(params, callback)
- Returns items from database using pages, the default limit is 500 items per page.

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

### myModel.insert(item)
- Insert an item in DB. This method is only for insert, will not update perform an update.

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

### myModel.save(item)
- Insert/update an item in DB. This method will perfrom an upsert.

```js
await myModel.save({ foo: 'bar' });

const items = await myModel.get({ filters: { foo: 'bar' }});

/**
	items content:
	[
		{
			foo: 'bar'
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


### myModel.multiSave(items)
- Perform a bulk save of items in DB. This action will insert/update (upsert) elements.

```js
await myModel.multiSave([{ foo: 1 }, { foo: 2 }]);

const items = await myModel.get();

/**
	items content:
	[
		{ foo: 1 },
		{ foo: 2 }
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
