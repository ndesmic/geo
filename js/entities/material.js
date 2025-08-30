export class Material {
	#useSpecularMap;
	#specularMap;
	#specularSampler;
	#roughness;

	#metalness;
	#baseReflectance;

	#texture;
	#textureSampler;
	#name;

	constructor(options){
		this.name = options.name;
		this.useSpecularMap = options.useSpecularMap ?? false;
		this.specularMap = options.specularMap ?? "placeholder";
		this.specularSampler = options.specularSampler ?? "default";
		this.roughness = options.roughness ?? 0.0;

		this.#metalness = options.metalness ?? 0.0;
		this.#baseReflectance = options.baseReflectance ?? [0.04, 0.04, 0.04];

		this.texture = options.texture ?? "placeholder";
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
	set roughness(val){
		this.#roughness = val;
	}
	get roughness(){
		return this.#roughness;
	}
	set metalness(val){
		this.#metalness = val;
	}
	get metalness(){
		return this.#metalness;
	}
	set baseReflectance(val){
		this.#baseReflectance = new Float32Array(val);
	}
	get baseReflectance(){
		return this.#baseReflectance;
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