'use strict';

const omit = require('lodash.omit');

/**
 * Returns a new object excluding one or more properties recursively
 *
 * @param {Object<string, *>} object
 * @param {string|Array<string>} exclude
 */
const omitRecursive = (object, exclude) => {

	object = { ...object }; // Avoid original object modification

	Object.entries(object).forEach(([key, value]) => {
		object[key] = typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
			? omitRecursive(value, exclude)
			: value;
	});

	return omit(object, exclude);
};

/**
 * @param {string} string
 * @returns {string}
 */
const titleCaseToDashCase = string => {
	return string
		.replace(/([A-Z])/g, match => `-${match[0].toLowerCase()}`)
		.replace(/^-/, '');
};

/**
 * @param {string} name
 * @returns {string}
 */
const modelNameSanitizer = name => {
	return titleCaseToDashCase(name.replace(/model/ig, ''));
};

/**
 * Determines if the passed value is an object.
 *
 * @param {*} value The value
 * @return {boolean} True if object, False otherwise.
 */
const isObject = value => {
	return !!value && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Validates if is empty
 *
 * @param param
 * @returns {boolean}
 */
const isEmpty = param => !!(
	param === null ||
	(typeof param === 'undefined') ||
	(typeof param === 'string' && !param) ||
	(typeof param === 'number' && Number.isNaN(param)) ||
	(Array.isArray(param) && !param.length)
);

module.exports = {
	omitRecursive,
	titleCaseToDashCase,
	modelNameSanitizer,
	isObject,
	isEmpty
};
