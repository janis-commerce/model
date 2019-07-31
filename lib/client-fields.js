'use strict';

const Settings = require('@janiscommerce/settings');

class ClientFields {

	static get() {

		if(typeof this._fields === 'undefined') {

			const settings = Settings.get('clients');

			this._fields = settings ? settings.fields : {};

			if(typeof this._fields !== 'object' || Array.isArray(this._fields))
				this._fields = {};

			this._prepareFields();
		}

		return this._fields;
	}

	static _prepareFields() {

		if(!this._fields.read)
			this._fields.read = {};

		if(!this._fields.read.type)
			this._fields.read.type = 'dbReadType';

		if(!this._fields.read.host)
			this._fields.read.host = 'dbReadHost';

		if(!this._fields.read.database)
			this._fields.read.database = 'dbReadDatabase';

		if(!this._fields.read.user)
			this._fields.read.user = 'dbReadUser';

		if(!this._fields.read.password)
			this._fields.read.password = 'dbReadPassword';

		if(!this._fields.read.port)
			this._fields.read.port = 'dbReadPort';

		if(!this._fields.read.protocol)
			this._fields.read.protocol = 'dbReadProtocol';

		if(!this._fields.write)
			this._fields.write = {};

		if(!this._fields.write.type)
			this._fields.write.type = 'dbWriteType';

		if(!this._fields.write.host)
			this._fields.write.host = 'dbWriteHost';

		if(!this._fields.write.database)
			this._fields.write.database = 'dbWriteDatabase';

		if(!this._fields.write.user)
			this._fields.write.user = 'dbWriteUser';

		if(!this._fields.write.password)
			this._fields.write.password = 'dbWritePassword';

		if(!this._fields.write.port)
			this._fields.write.port = 'dbWritePort';

		if(!this._fields.write.protocol)
			this._fields.write.protocol = 'dbWriteProtocol';
	}

}

module.exports = ClientFields;

/**
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
 */
