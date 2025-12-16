export function getValuesFromEntriesRecursive(entries){
	return entries.map(keyval => {
		if(Array.isArray(keyval[1])){
			return getValuesFromEntriesRecursive(keyval[1]);
		}
		return keyval[1];
	});
}