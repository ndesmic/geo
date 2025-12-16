import { DEFAULT_SAMPLER, PLACEHOLDER_TEXTURE } from "../engines/gpu-engine/constants.js";

export class Material {
	#useRoughnessMap;
	#roughnessMap;
	#roughnessSampler;
	#roughness;

	#metalness;
	#baseReflectance;

	#albedoMap;
	#albedoSampler;
	#name;

	constructor(options){
		if(!options.name){
			throw new Error("Material must have a name");
		}
		this.name = options.name;

		this.useRoughnessMap = options.useRoughnessMap ?? false;
		this.roughnessMap = options.roughnessMap ?? PLACEHOLDER_TEXTURE;
		this.roughnessSampler = options.roughnessSampler ?? DEFAULT_SAMPLER;
		this.roughness = options.roughness ?? 0.0;

		this.albedoMap = options.albedoMap ?? PLACEHOLDER_TEXTURE;
		this.albedoSampler = options.albedoSampler ?? DEFAULT_SAMPLER;

		this.#metalness = options.metalness ?? 0.0;
		this.#baseReflectance = options.baseReflectance ?? [0.04, 0.04, 0.04];
	}

	set name(val){
		this.#name = val;
	}
	get name(){
		return this.#name;
	}
	set useRoughnessMap(val){
		this.#useRoughnessMap = val;
	}
	get useRoughnessMap(){
		return this.#useRoughnessMap;
	}
	set roughnessMap(val){
		this.#roughnessMap = val;
	}
	get roughnessMap(){
		return this.#roughnessMap;
	}
	set roughnessSampler(val){
		this.#roughnessSampler = val;
	}
	get roughnessSampler(){
		return this.#roughnessSampler;
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
	set albedoMap(val){
		this.#albedoMap = val;
	}
	get albedoMap() {
		return this.#albedoMap;
	}
	set albedoSampler(val){
		this.#albedoSampler = val;
	}
	get albedoSampler(){
		return this.#albedoSampler;
	}
}