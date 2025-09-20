/**
 * @typedef {"point" | "directional" | "spot" } LightType
 */

export class Light {
	/**@type {LightType} */
	#type;
	#position;
	#direction;
	#color;
	#castsShadow;

	constructor(light) {
		this.#type = light.type ?? "point";
		this.#position = light.position ?? [0, 0, 0, 0];
		this.#direction = light.direction ?? [0, 0, 0, 0];
		this.#color = light.color ?? [1, 1, 1, 1];
		this.#castsShadow = light.castsShadow ?? false;
	}

	static getLightInt(lightType) {
		switch (lightType) {
			case "point": return 0;
			case "directional": return 1;
			case "spot": return 2;
			default: throw new Error(`Invalid light type ${lightType}`);
		}
	}

	set type(val) {
		this.#type = new Float32Array(val);
	}
	get type() {
		return this.#type;
	}
	get typeInt() {
		return Light.getLightInt(this.#type);
	}

	set position(val) {
		this.#position = new Float32Array(val);
	}
	get position() {
		return this.#position;
	}

	set direction(val) {
		this.#direction = new Float32Array(val);
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