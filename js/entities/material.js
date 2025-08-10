export class Material {
	#useSpecularMap;
	#specularMap;
	#specularSampler;
	#glossColor;

	#texture;
	#textureSampler;
	#name;

	constructor(options){
		this.name = options.name;
		this.useSpecularMap = options.useSpecularMap ?? false;
		this.specularMap = options.specularMap ?? "dummy";
		this.specularSampler = options.specularSampler ?? "default";
		this.glossColor = options.glossColor ?? new Float32Array([0,0,0,1]);
		this.texture = options.texture ?? "dummy";
		this.textureSampler = options.textureSampler ?? "default";
	}

	set name(val){
		this.#name = val;
	}
	get name(){
		return this.#name;
	}
	set useSpecularMap(val){
		this.#useSpecularMap = val;
	}
	get useSpecularMap(){
		return this.#useSpecularMap;
	}
	set specularMap(val){
		this.#specularMap = val;
	}
	get specularMap(){
		return this.#specularMap;
	}
	set specularSampler(val){
		this.#specularSampler = val;
	}
	get specularSampler(){
		return this.#specularSampler;
	}
	set glossColor(val){
		if(Array.isArray(val)){
			this.#glossColor = new Float32Array(val);
		} else {
			this.#glossColor = val;
		}
	}
	get glossColor(){
		return this.#glossColor;
	}
	set texture(val){
		this.#texture = val;
	}
	get texture() {
		return this.#texture;
	}
	set textureSampler(val){
		this.#textureSampler = val;
	}
	get textureSampler(){
		return this.#textureSampler;
	}
}