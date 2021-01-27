'use strict';

/**
 * @param {*} object
 * @return {boolean}
 */
module.exports = object => object && typeof object === 'object' && !Array.isArray(object);
