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