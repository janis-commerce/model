'use strict';

/**
 * Returns a new object excluding one or more properties recursively
 *
 * @param {Object} object - The input object to process.
 * @param {string|string[]} pathPatterns - Property path(s) to exclude (e.g. ['a.b', 'x.y']).
 * @returns {Object} A new object with specified properties omitted.
 */
const omitRecursive = (object, pathPatterns) => {

	const patterns = pathPatterns.map(p => p.split('.'));

	const clonedObject = structuredClone(object); // Clones to avoid modifying the original object

	function isPathMatch(path, pattern) {

		if(path.length !== pattern.length)
			return false;

		// Verify if every part of the path matches the pattern or pattern is a wildcard
		return path.every((part, i) => pattern[i] === '*' || pattern[i] === part);

	}

	function recurse(current, currentPath = []) {

		if(Array.isArray(current)) {
			current.forEach((item, index) => {
				recurse(item, [...currentPath, String(index)]); // Recursively process the item with updated path including index

			});
		} else if(current && typeof current === 'object') {

			for(const [key, value] of Object.entries(current)) {

				const newPath = [...currentPath, key]; // Create new path by appending the current key

				if(patterns.some(pattern => isPathMatch(newPath, pattern))) // Check if the new path matches any pattern
					delete current[key]; // Delete the key if the path matches a pattern
				else
					recurse(value, newPath); // Recursively process the value with the updated path

			}
		}
	}

	recurse(clonedObject);

	return clonedObject;
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
