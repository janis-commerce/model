'use strict';

const cloneDeep = require('lodash.clonedeep');

/**
 * Checks if a given property path matches a specific pattern.
 *
 * @param {string[]} path - The current property path segments.
 * @param {string[]} pattern - The pattern segments to match against.
 * @param {number} i - Current index in the path array.
 * @param {number} j - Current index in the pattern array.
 * @returns {boolean} True if the path matches the pattern, false otherwise.
 */
const isPathMatch = (path, pattern, i = 0, j = 0) => {

	// Special case: if pattern has only one segment, check if it matches the last path segment or is a wildcard
	if(pattern.length === 1)
		return path[path.length - 1] === pattern[0] || pattern[0] === '*';

	// If all pattern segments are consumed, check if all path segments are also consumed
	if(j === pattern.length)
		return i === path.length;

	// Handle double wildcard '**' which matches zero or more path segments
	if(pattern[j] === '**') {

		// Try matching the rest of the pattern starting from each possible position in the path
		for(let k = i; k <= path.length; k++) {
			// Recursively check if the remaining pattern matches from position k
			if(isPathMatch(path, pattern, k, j + 1))
				return true;
		}

		// If no match found with any position, return false
		return false;
	}

	// If all path segments are consumed but still have pattern segments left, no match
	if(i === path.length)
		return false;

	// If current pattern segment is not a wildcard and doesn't match current path segment, no match
	if(pattern[j] !== '*' && pattern[j] !== path[i])
		return false;

	// Move to next segments in both path and pattern
	return isPathMatch(path, pattern, i + 1, j + 1);
};

/**
 * Recursively iterates over the object/array structure to find and remove matching properties.
 *
 * @param {string[]} patterns - The patterns as path segments of the properties to exclude when matching.
 * @param {*} current - The current element being processed (object, array, or primitive).
 * @param {string[]} currentPath - The path segments leading to the current element.
 */
const recurse = (patterns, current, currentPath = []) => {

	// If current element is an array, recursively process each item with its index as path segment
	if(Array.isArray(current))
		current.forEach((item, index) => recurse(patterns, item, [...currentPath, String(index)]));
	// If current element is an object (but not null), process its properties
	else if(current && typeof current === 'object') {

		// Iterate through all key-value pairs in the object
		for(const [key, value] of Object.entries(current)) {

			// Build the new path by adding the current key to the existing path
			const newPath = [...currentPath, key];

			// Check if the current path matches any of the exclusion patterns
			if(patterns.some(p => isPathMatch(newPath, p)))
				// If it matches, delete this property from the object
				delete current[key];
			else
				// If it doesn't match, recursively process the value with the new path
				recurse(patterns, value, newPath);
		}
	}
};

/**
 * Returns a new object excluding one or more properties recursively
 *
 * @param {object} object - The input object to process that will be cloned and modified.
 * @param {string[]} pathPatterns - Property path(s) to exclude (e.g. ['a.b', '*.x.y', 'some-field']).
 * @returns {object} A new object with specified properties omitted.
 */
const omitRecursive = (object, pathPatterns) => {

	// Convert dot-notation path patterns into arrays of path segments.
	const patterns = pathPatterns.map(p => p.split('.'));

	// Deep clone the original object to avoid modifying it directly.
	const clonedObject = cloneDeep(object);

	// Recursive removal process from the root of the cloned object
	recurse(patterns, clonedObject);

	// Return the modified clone with specified properties removed
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
