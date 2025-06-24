'use strict';

const deleteProp = (object, prop) => {
	const { [prop]: propToRemove, ...newObject } = object;
	return newObject;
};

const deleteManyProps = (object, props) => {
	return props.reduce((obj, prop) => deleteProp(obj, prop), { ...object });
};

module.exports = {
	deleteProp,
	deleteManyProps
};
