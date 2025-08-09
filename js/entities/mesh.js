import { multiplyMatrix, getIdentityMatrix, getTranslationMatrix, getScaleMatrix, getRotationXMatrix, getRotationYMatrix, getRotationZMatrix, getTranspose, multiplyMatrixVector, addVector, divideVector, subtractVector, getInverse, trimMatrix, normalizeVector } from "../utilities/vector.js";
import { chunk } from "../utilities/iterator-utils.js";
import { inverseLerp } from "../utilities/math-helpers.js";

export class Mesh {
	#positions;
	#positionSize;
	#colors;
	#colorSize;
	#uvs;
	#uvSize;
	#normals;
	#normalSize;
	#tangents;
	#tangentSize;
	#indices;
	#vertexLength;
	#material;
	#transforms = [];

	/** @typedef { "positions" | "colors" | "uvs" | "normals" | "tangents" } AttributeKey */
	/** @type { readonly [AttributeKey, string][] } */
	static attributeOrdering = [
		["positions", "positionSize"],
		["colors", "colorSize"],
		["uvs", "uvSize"],
		["normals", "normalSize"],
		["tangents", "tangentSize"]
	];

	static empty = new Float32Array(0);

	constructor(mesh) {
		this.positions = mesh.positions ?? Mesh.empty;
		this.colors = mesh.colors ?? Mesh.empty;
		this.normals = mesh.normals ?? Mesh.empty;
		this.uvs = mesh.uvs ?? Mesh.empty;
		this.indices = mesh.indices ?? Mesh.empty;
		this.tangents = mesh.tangents ?? Mesh.empty;
		this.positionSize = mesh.positionSize ?? 3;
		this.uvSize = mesh.uvSize ?? 2;
		this.normalSize = mesh.normalSize ?? 3;
		this.colorSize = mesh.colorSize ?? 4;
		this.tangentSize = mesh.tangentSize ?? 3;
		this.vertexLength = mesh.vertexLength;
		this.material = mesh.material;
	}

	set positions(val) {
		if(!val || val.length === 0){
			this.#positions = Mesh.empty;
		}
		this.#positions = new Float32Array(val);
	}
	get positions() {
		return this.#positions;
	}
	set positionSize(val){
		this.#positionSize = val;
	}
	get positionSize(){
		return this.#positions.length > 0 ? this.#positionSize : 0;
	}
	set colors(val) {
		if (!val || val.length === 0) {
			this.#colors = Mesh.empty;
		}
		this.#colors = new Float32Array(val);
	}
	get colors() {
		return this.#colors;
	}
	set colorSize(val) {
		this.#colorSize = val;
	}
	get colorSize() {
		return this.#colors.length > 0 ? this.#colorSize : 0;
	}
	set uvs(val) {
		if (!val || val.length === 0) {
			this.#uvs = Mesh.empty;
		}
		this.#uvs = new Float32Array(val);
	}
	get uvs() {
		return this.#uvs;
	}
	set uvSize(val) {
		this.#uvSize = val;
	}
	get uvSize() {
		return this.#uvs.length > 0 ? this.#uvSize : 0;
	}
	set normals(val) {
		if (!val || val.length === 0) {
			this.#normals = Mesh.empty;
		}
		this.#normals = new Float32Array(val);
	}
	get normals() {
		return this.#normals;
	}
	set normalSize(val) {
		this.#normalSize = val;
	}
	get normalSize() {
		return this.#normals.length > 0 ? this.#normalSize : 0;
	}
	set tangents(val){
		if (!val || val.length === 0) {
			this.#tangents = Mesh.empty;
		}
		this.#tangents = new Float32Array(val);
	}
	get tangents(){
		return this.#tangents;
	}
	set tangentSize(val) {
		this.#tangentSize = val;
	}
	get tangentSize() {
		return this.#tangents.length > 0 ? this.#tangentSize : 0;
	}
	set indices(val) {
		this.#indices = new Uint16Array(val);
	}
	get indices() {
		return this.#indices;
	}
	set vertexLength(val){
		this.#vertexLength = val;
	}
	get vertexLength(){
		return this.#vertexLength;
	}
	get material() {
		return this.#material;
	}
	set material(val) {
		this.#material = val;
	}
	setMaterial(val){
		this.#material = val;
		return this;
	}
	/**
	 * 
	 * @param {(AttributeKey[]} attrNames 
	 * @returns 
	 */
	useAttributes(attrNames){
		for(const [attrName, _attrSizeName] of Mesh.attributeOrdering){
			if(!attrNames.includes(attrName)){
				this[attrName] = null;
			}
		}
		return this;
	}
	translate({ x = 0, y = 0, z = 0 }) {
		this.#transforms.push(getTranslationMatrix(x, y ,z));
		return this;
	}
	scale({ x = 1, y = 1, z = 1 }) {
		this.#transforms.push(getScaleMatrix(x, y, z));
		return this;
	}
	rotate({ x, y, z }) {
		//there's an order dependency here... something something quaternions...
		if (x) {
			this.#transforms.push(getRotationXMatrix(x));
		}
		if (y) {
			this.#transforms.push(getRotationYMatrix(y));
		}
		if (z) {
			this.#transforms.push(getRotationZMatrix(z));
		}
		return this;
	}
	resetTransforms() {
		this.#transforms = [];
	}
	bakeTransforms(){
		//positions
		const modelMatrix = this.getModelMatrix();
		const transformedPositions = chunk(this.positions, this.positionSize)
			.map(values => {
				const lengthToPad = 4 - values.length;
				switch(lengthToPad){
					case 1:{
						return [...values, 1.0]
					}
					case 2:{
						return [...values, 0.0, 1.0];
					}
					case 3: {
						return [...values, 0.0, 0.0, 1.0];
					}
					default: {
						return [0.0, 0.0, 0.0, 1.0];
					}
				}
			})
			.map(values => multiplyMatrixVector(values, modelMatrix, this.positionSize + 1)) //need homogenous coordinates for positions
			.toArray();

		const normalMatrix = getTranspose(
			getInverse(
				trimMatrix(modelMatrix, [4,4], [this.normalSize,this.normalSize]), 
			[this.normalSize,this.normalSize]), 
		[this.normalSize,this.normalSize]);
		const transformedNormals = chunk(this.normals, this.normalSize)
			.map(values => multiplyMatrixVector(values, normalMatrix, this.normalSize))
			.map(values => normalizeVector(values))
			.toArray();

		//collect
		const newPositionsBuffer = new Float32Array(this.vertexLength * this.positionSize);
		for(let i = 0; i < transformedPositions.length; i++){
			newPositionsBuffer.set(transformedPositions[i].slice(0, this.positionSize), i * this.positionSize)
		}

		const newNormalsBuffer = new Float32Array(this.vertexLength * this.normalSize);
		for (let i = 0; i < transformedNormals.length; i++) {
			newNormalsBuffer.set(transformedNormals[i].slice(0, this.normalSize), i * this.normalSize)
		}

		this.positions = newPositionsBuffer;
		this.normals = newNormalsBuffer;
		this.resetTransforms();
		return this;
	}
	getModelMatrix() {
		return this.#transforms.reduce((mm, tm) => multiplyMatrix(tm, [4,4], mm, [4,4]), getIdentityMatrix());
	}
	getNormalMatrix(){
		return getTranspose(getInverse(trimMatrix(modelMatrix, [3, 3])));
	}
	/**
	 * Normalizes positions to be unit volume and centers
	 * @param {{ scale?: boolean, center?: boolean }} options
	 * @returns 
	 */
	normalizePositions(options = {}){
		const shouldCenter = options.center ?? true;
		const shouldScale = options.scale ?? true;
		const max = new Array(this.positionSize).fill(-Infinity);
		const min = new Array(this.positionSize).fill(Infinity);

		for(let i = 0; i < this.vertexLength; i++){
			for(let j = 0; j < this.positionSize; j++){
				const coord = this.#positions[i * this.positionSize + j];
				if(coord > max[j]){
					max[j] = coord
				}
				if(coord < min[j]){
					min[j] = coord;
				}
			}
		}

		const length = subtractVector(max, min);
		const maxLength = Math.max(...length);

		let currentCenter;
		if(shouldScale){
			for(let i = 0; i < this.positions.length; i++){
				this.#positions[i] /= maxLength;
			}
			currentCenter = addVector(divideVector(min, maxLength), divideVector(divideVector(length, maxLength), 2));
		} else {
			currentCenter = addVector(min, divideVector(length, 2));
		}

		if(shouldCenter){
			for (let i = 0; i < this.positions.length; i++) {
				const dimension = i % this.positionSize;
				this.#positions[i] -= currentCenter[dimension];
			}
		}

		return this;
	}
}