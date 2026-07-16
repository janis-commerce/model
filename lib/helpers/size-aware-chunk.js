'use strict';

/**
 * Splits an array of items into chunks bounded by BOTH a maximum item count and a maximum
 * accumulated serialized-byte budget, cutting on whichever limit is reached first.
 *
 * The byte budget exists because grouped logs are shipped to Firehose, which truncates
 * (destructively) any single record over ~1 MiB. Keeping each chunk's serialized payload well
 * under that budget guarantees the resulting log record stays within the Firehose per-record limit.
 *
 * A single item whose serialized size already exceeds the byte budget cannot be split further, so
 * it is placed alone in its own chunk.
 *
 * @param {Array<Object>} items The items to split
 * @param {number} maxCount The maximum amount of items per chunk
 * @param {number} maxBytes The maximum accumulated serialized bytes of the items per chunk
 * @returns {Array<Array<Object>>} The resulting chunks, preserving the original item order
 */
module.exports = (items, maxCount, maxBytes) => {

	const chunks = [];

	let currentChunk = [];
	let currentBytes = 0;

	for(const item of items) {

		const itemBytes = Buffer.byteLength(JSON.stringify(item));

		const exceedsCount = currentChunk.length >= maxCount;
		const exceedsBytes = currentChunk.length > 0 && currentBytes + itemBytes > maxBytes;

		if(exceedsCount || exceedsBytes) {
			chunks.push(currentChunk);
			currentChunk = [];
			currentBytes = 0;
		}

		currentChunk.push(item);
		currentBytes += itemBytes;
	}

	if(currentChunk.length)
		chunks.push(currentChunk);

	return chunks;
};
