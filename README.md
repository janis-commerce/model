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

1. Using [Settings](https://www.npmjs.com/package/@janiscommerce/settings), with settings in file `/path/to/root/.janiscommercerc.json`:

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

2. Using ENV variables:
```bash
DB_CORE_HOST = "http://my-host-name.org";
DB_CORE_DATABASE = "db-name";
DB_CORE_USER = "user";
DB_CORE_PASSWORD = "foo123456";
```

### Database connection configurated with client injected
When your `Model` is a Client Model, and the database connection settings are in the client injected, you don't need to configurate the `databaseKey`.
You can add settings for the fields in the connection, the fields are the following.

For settings the package use [Settings](https://www.npmjs.com/package/@janiscommerce/settings).

| Field | Default value | Description |
|--|--|--|
| clients.fields.read.host | dbReadHost | The host for DB Read |
| clients.fields.read.database | dbReadDatabase | The database name for DB Read |
| clients.fields.read.user | dbReadUser | The database username for DB Read |
| clients.fields.read.password | dbReadPassword | The database password for DB Read |
| clients.fields.read.port | dbReadPort | The database port for DB Read |
| clients.fields.write.host | dbWriteHost | The host for DB Write |
| clients.fields.write.database | dbWriteDatabase | The database name for DB Write |
| clients.fields.write.user | dbWriteUser | The database username for DB Write |
| clients.fields.write.password | dbWritePassword | The database password for DB Write |
| clients.fields.write.port | dbWritePort | The database port for DB Write |

**Example of settings:**
```json
// .janiscommercerc.json
{
	"clients": {
		"fields": {
			"read": {
				"host": "dbReadHost",
				"database": "dbReadDatabase",
				"user": "dbReadUser",
				"password": "dbReadPassword",
				"port": "dbReadPort"
			},
			"write": {
				"host": "dbWriteHost",
				"database": "dbWriteDatabase",
				"user": "dbWriteUser",
				"password": "dbWritePassword",
				"port": "dbWritePort"
			}
		}
	}
}
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
