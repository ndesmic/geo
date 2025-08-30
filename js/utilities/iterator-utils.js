/**
 * Chunks an iterator based on size
 * @param {Iterator} iterator 
 * @param {number} size 
 */
export function* chunk(iterator, size) {
	let chunk = new Array(size);
	let i = 0;
	for (const element of iterator) {
		chunk[i] = element;
		i++;
		if (i === size) {
			yield chunk;
			chunk = new Array(size);
			i = 0;
		}
	}
	if (i > 0) {
		yield chunk;
	}
}

/**
 * Gets a range of numbers
 * @param {{ start?: number, end: number, step?: number }} options 
 */
export function* getRange({ start, end, step }) {
	let i = start ?? 0;
	step = step ?? 1;
	for (; i <= end; i += step) {
		yield i;
	}
}
