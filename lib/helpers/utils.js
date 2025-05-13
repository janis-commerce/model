'use strict';

/**
 * Returns a new object excluding one or more properties recursively
 *
 * @param {object} object - The input object to process.
 * @param {string|string[]} pathPatterns - Property path(s) to exclude (e.g. ['a.b', 'x.y']).
 * @returns {object} A new object with specified properties omitted.
 */
const omitRecursive = (object, pathPatterns) => {

	// Convert dot-notation path patterns into arrays of path segments.
	const patterns = pathPatterns.map(p => p.split('.'));

	// Deep clone the original object to avoid modifying it directly.
	const clonedObject = structuredClone(object);

	/**
	 * Checks if a given property path matches a specific pattern.
	 *
	 * @param {string[]} path - The current property path segments.
	 * @param {string[]} pattern - The pattern segments to match against.
	 * @param {number} i - Current index in the path array.
	 * @param {number} j - Current index in the pattern array.
	 * @returns {boolean} True if the path matches the pattern, false otherwise.
	 */
	function isPathMatch(path, pattern, i = 0, j = 0) {

		if(pattern.length === 1)
			return path[path.length - 1] === pattern[0] || pattern[0] === '*';

		if(j === pattern.length)
			return i === path.length;

		if(pattern[j] === '**') {

			for(let k = i; k <= path.length; k++) {
				if(isPathMatch(path, pattern, k, j + 1))
					return true;
			}

			return false;
		}

		if(i === path.length)
			return false;

		if(pattern[j] !== '*' && pattern[j] !== path[i])
			return false;

		return isPathMatch(path, pattern, i + 1, j + 1);
	}

	/**
	 * Recursively traverses the object/array structure to find and remove matching properties.
	 *
	 * @param {*} current - The current element being processed (object, array, or primitive).
	 * @param {string[]} currentPath - The path segments leading to the current element.
	 */
	function recurse(current, currentPath = []) {

		if(Array.isArray(current))
			current.forEach((item, index) => recurse(item, [...currentPath, String(index)]));
		else if(current && typeof current === 'object') {

			for(const [key, value] of Object.entries(current)) {

				const newPath = [...currentPath, key];

				if(patterns.some(p => isPathMatch(newPath, p)))
					delete current[key];
				else
					recurse(value, newPath);
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
