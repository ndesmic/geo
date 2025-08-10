//@ts-check
/**
 * 
 * @param {string} txt 
 * @param {{ color?: [number, number, number, number], reverseWinding?: boolean}} options 
 * @returns 
 */
export function loadObj(txt, options = {}) {
	const positions = [];
	const normals = [];
	const uvs = [];
	const colors = [];
	const indices = [];
	const faceCombos = [];
	let positionSize = 3;
	let normalSize = 3;
	let colorSize = 4;
	let uvSize = 2;

	const lines = txt.split("\n");

	for (const line of lines) {
		const normalizedLine = line.trim();
		if (!normalizedLine || normalizedLine.startsWith("#")) continue;
		const parts = normalizedLine.split(/\s+/g);
		const values = parts.slice(1);

		switch (parts[0]) {
			case "v": {
				positions.push(values.map(x => parseFloat(x)));
				positionSize = values.length;
				break;
			}
			case "c": { //custom extension
				if (!options.color) {
					colors.push(values.map(x => parseFloat(x)));
					colorSize = values.length;
				}
				break;
			}
			case "vt": {
				uvs.push(values.map(x => parseFloat(x)));
				uvSize = values.length;
				break;
			}
			case "vn": {
				normals.push(values.map(x => parseFloat(x)));
				normalSize = values.length;
				break;
			}
			case "f": {
				if(values[0].includes("/")){
					faceCombos.push(values.map(value => value.split("/").map(x => parseFloat(x) - 1)));
				} else {
					const oneBasedIndicies = values.map(x => parseFloat(x) - 1);
					indices.push(
						...(options.reverseWinding ? oneBasedIndicies.reverse() : oneBasedIndicies)
					);
				}
				break;
			}
		}
	}

	if(faceCombos.length === 0){
		return {
			positions: positions.flat(Infinity),
			positionSize,
			colors: colors.flat(Infinity),
			colorSize,
			uvs: uvs.flat(Infinity),
			uvSize,
			normals: normals.flat(Infinity),
			normalSize,
			indices,
			vertexLength: positions.length,
		};
	}

	//For multi value faces we need to get position/uv/normal combos and put each into the pool of vertices

	const comboPositions = [];
	const comboUvs = [];
	const comboNormals = [];
	const comboIndices = [];
	let startIndex = 0;

	for(const combo of faceCombos){
		for(const attrIndex of combo){
			comboPositions.push(positions[attrIndex[0]]);
			comboUvs.push(uvs[attrIndex[1]]);
			comboNormals.push(normals[attrIndex[2]]);
		}
		if (combo.length === 3) {
			if(options.reverseWinding){
				comboIndices.push(startIndex + 2, startIndex + 1, startIndex);
			} else {
				comboIndices.push(startIndex, startIndex + 1, startIndex + 2);
			}
			
		} else if(combo.length === 4){
			if(options.reverseWinding){
				comboIndices.push(
					startIndex + 2,
					startIndex + 1,
					startIndex,
					startIndex + 3,
					startIndex + 2,
					startIndex);
			} else {
				comboIndices.push(
					startIndex, 
					startIndex + 1, 
					startIndex + 2, 
					startIndex, 
					startIndex + 2, 
					startIndex + 3);
			}
		}
		startIndex += combo.length;
	}

	return {
		positions: comboPositions.flat(Infinity),
		positionSize,
		colors: [],
		colorSize: 0,
		uvs: comboUvs.flat(Infinity),
		uvSize,
		normals: comboNormals.flat(Infinity),
		normalSize,
		indices: comboIndices.flat(Infinity),
		vertexLength: comboPositions.length,
	};
}