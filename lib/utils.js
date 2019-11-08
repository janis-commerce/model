'use strict';

const omit = require('lodash.omit');

const omitRecursive = (object, exclude) => {

	object = { ...object }; // Avoid original object modification

	Object.entries(object).forEach(([key, value]) => {
		object[key] = typeof value === 'object' && !Array.isArray(value) ? omitRecursive(value, exclude) : value;
	});

	return omit(object, exclude);
};

const titleCaseToDashCase = string => {
	return string
		.replace(/([A-Z])/g, match => `-${match[0].toLowerCase()}`)
		.replace(/^-/, '');
};

const isObject = object => {

	if(object === null || typeof object !== 'object' || Array.isArray(object))
		return false;

	return true;
};

module.exports = {
	omitRecursive,
	titleCaseToDashCase,
	isObject
};
