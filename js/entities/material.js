export class Material {
	#specular;
	#diffuse;
	#texture;
	#name;

	constructor(options){
		this.name = options.name;
		this.specular = options.specular ?? 0;
		this.diffuse = options.diffuse ?? 0;
		this.texture = options.texture;
	}

	set name(val){
		this.#name = val;
	}
	get name(){
		return this.#name;
	}
	set specular(val){
		this.#specular = val;
	}
	get specular(){
		return this.#specular;
	}
	set diffuse(val){
		this.#diffuse = val;
	}
	get diffuse(){
		return this.#diffuse;
	}
	set texture(val){
		this.#texture = val;
	}
	get texture(){
		return this.#texture;
	}
}