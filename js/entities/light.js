import { Transformable } from "./transformable.js";
/**
 * @typedef {"point" | "directional" | "spot" } LightType
 */

export class Light extends Transformable {
	/**@type {LightType} */
	#name;
	#type;
	#position;
	#direction;
	#color;
	#castsShadow;

	constructor(light) {
		super();
		this.name = light.name;
		this.type = light.type ?? "point";
		this.position = light.position ?? [0, 0, 0, 1];
		this.direction = light.direction ?? [0, 0, 0, 0];
		this.color = light.color ?? [1, 1, 1, 1];
		this.castsShadow = light.castsShadow ?? false;
	}

	static getLightInt(lightType) {
		switch (lightType) {
			case "point": return 0;
			case "directional": return 1;
			case "spot": return 2;
			default: throw new Error(`Invalid light type ${lightType}`);
		}
	}

	/**
	 * @param {string} val 
	 */
	set type(val) {
		this.#type = val;
	}
	/**
	 * @returns {string}
	 */
	get type() {
		return this.#type;
	}
	/**
	 * @returns {number}
	 */
	get typeInt() {
		return Light.getLightInt(this.#type);
	}

	set name(val){
		this.#name = val;
	}
	get name(){
		return this.#name;
	}

	set position(val) {
		if(val.length === 3){
			this.#position = new Float32Array([...val, 1]);
		} else {
			this.#position = new Float32Array(val);
		}
	}
	get position() {
		return this.#position;
	}

	set direction(val) {
		if(val.length === 3){
			this.#direction = new Float32Array([...val, 0]);
		} else {
			this.#direction = new Float32Array(val);
		}
	}
	get direction() {
		return this.#direction;
	}

	set color(val) {
		this.#color = new Float32Array(val);
	}
	get color() {
		return this.#color;
	}

	set castsShadow(val){
		this.#castsShadow = val;
	}

	get castsShadow(){
		return this.#castsShadow;
	}
}