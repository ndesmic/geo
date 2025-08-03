import { multiplyMatrix, getIdentityMatrix, getTranslationMatrix, getScaleMatrix, getRotationXMatrix, getRotationYMatrix, getRotationZMatrix, getTranspose } from "../utilities/vector.js";

export class Mesh {
	#positions;
	#colors;
	#normals;
	#uvs;
	#centroids;
	#indices;
	#tangents;
	#material;
	#length;
	#transforms = [];

	constructor(mesh) {
		this.positions = mesh.positions;
		this.colors = mesh.colors;
		this.normals = mesh.normals;
		this.uvs = mesh.uvs;
		this.centroids = mesh.centroids;
		this.indices = mesh.indices;
		this.tangents = mesh.tangents;
		this.material = mesh.material;
		this.length = mesh.length;
		this.positionsSize = mesh.positionsSize ?? 3;
	}

	set positions(val) {
		this.#positions = new Float32Array(val);
	}
	get positions() {
		return this.#positions;
	}
	set colors(val) {
		this.#colors = new Float32Array(val);
	}
	get colors() {
		return this.#colors;
	}
	set normals(val) {
		this.#normals = new Float32Array(val);
	}
	get normals() {
		return this.#normals;
	}
	set uvs(val) {
		this.#uvs = new Float32Array(val);
	}
	get uvs() {
		return this.#uvs;
	}
	set centroids(val){
		this.#centroids = new Float32Array(val);
	}
	get centroids(){
		return this.#centroids;
	}
	set tangents(val){
		this.#tangents = val;
	}
	get tangents(){
		return this.#tangents;
	}
	get material() {
		return this.#material;
	}
	set material(val) {
		this.#material = val;
	}
	set indices(val) {
		this.#indices = new Uint16Array(val);
	}
	get indices() {
		return this.#indices;
	}
	set length(val){
		this.#length = val;
	}
	get length(){
		return this.#length;
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
		//there's an order dependency here... something something quaterions...
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
	getModelMatrix() {
		const modelMatrix = this.#transforms.reduce((mm, tm) => multiplyMatrix(tm, mm), getIdentityMatrix());
		return getTranspose(modelMatrix, [4,4]);
	}
	normalizePositions(scale){
		let max = -Infinity;

		for(let i = 0; i < this.#positions.length; i += this.positionsSize){
			for(let j = 0; j < this.positionsSize; j++){
				const coord = this.#positions[i * this.positionsSize + j];
				if(coord > max){
					max = coord
				}
			}
		}

		for(let i = 0; i < this.#positions.length; i++){
			this.#positions[i] /= max;
			if(scale){
				this.#positions[i] *= scale;
			}
		}

		return this;
	}
}