import { getOrthoMatrix, getProjectionMatrix, getCameraToWorldMatrixFromDirection, UP, subtractVector, normalizeVector, getWorldToCameraMatrixFromDirection, multiplyMatrixVector, addVector, multiplyMatrix, printMatrix } from "../utilities/vector.js";
import { sphericalToCartesian, cartesianToSpherical } from "../utilities/math-helpers.js";
import { Transformable } from "./transformable.js";

export class Camera extends Transformable {
	#name;
	#position = new Float32Array([0,0,-1,1]);
	#direction;
	#screenWidth;
	#screenHeight;
	#near;
	#far;
	#left;
	#right;
	#top;
	#bottom;
	#fieldOfView;
	#isPerspective;

	/**
	 * 
	 * @param {{
	 *   position: ArrayLike,
	 *   screenWidth: number,
	 *   screenHeight: number,
	 *   left: number,
	 *   right: number,
	 *   top: number,
	 *   bottom: number,
	 *   near: number,
	 *   far: number,
	 *   fieldOfView: number,
	 *   isPerspective: boolean
	 * }} camera 
	 */
	constructor(camera){
		super();
		if(!camera.name){
			throw new Error("Camera must have a name");
		}
		this.name = camera.name;
		this.position = camera.position;
		
		if(camera.direction){
			this.direction = normalizeVector(camera.direction);
		} else {
			this.lookAt(camera.target ?? new Float32Array([0,0,0,1]));
		}

		this.#screenWidth = camera.screenWidth;
		this.#screenHeight = camera.screenHeight;
		this.#left = camera.left;
		this.#right = camera.right;
		this.#top = camera.top;
		this.#bottom = camera.bottom;
		this.#near = camera.near;
		this.#far = camera.far;
		this.#fieldOfView = camera.fieldOfView;
		this.#isPerspective = camera.isPerspective;

		if (this.#isPerspective && (this.#screenWidth === undefined || this.#screenHeight === undefined || this.#near === undefined || this.#far === undefined || this.#fieldOfView === undefined)){
			throw new Error(`Missing required value for perspective projection`);
		}
		if (!this.#isPerspective && (this.#left === undefined || this.#right === undefined || this.#near === undefined || this.#far === undefined || this.#top === undefined || this.#bottom === undefined)) {
			throw new Error(`Missing required value for ortho projection`);
		}
	}
	lookAt(target){
		const normalizedTarget = target.length === 3
			? new Float32Array([...target, 1])
			: new Float32Array(target);
		this.direction = normalizeVector(subtractVector(normalizedTarget, this.position)); 
	}

	moveTo(x, y, z){
		this.position = [x,y,z,1];
	}

	moveBy({ x = 0, y = 0, z = 0 }){
		const result = addVector(this.position, new Float32Array([x,y,z,1]));
		result[3] = 1; //homogenized
		this.position = result; 
	}

	panBy({ right = 0, up = 0, forward = 0 }){
		const cameraToWorld = getCameraToWorldMatrixFromDirection(this.position, this.direction);

		const delta = multiplyMatrixVector(cameraToWorld, new Float32Array([right, up, forward, 0]), 4);
		this.position = addVector(this.position, delta); 
	}

	orbitBy({ radius = 0, lat = 0, long = 0 }, target){
		const [currentLat, currentLng, r] = this.getOrbit(target); 
		const newLat = currentLat + lat;
		const newLong = currentLng - long;
		const newRadius = Math.max(0.1, r + radius);
		this.position = sphericalToCartesian([newLat, newLong, newRadius]);
	}

	getOrbit(target){
		const homgeneousTarget = target.length === 3 ? new Float32Array([...target, 1]) : new Float32Array(target);
	 	const targetDelta = subtractVector(this.position, homgeneousTarget);
	 	return cartesianToSpherical(targetDelta);
	}

	get viewMatrix(){
		const direction = multiplyMatrixVector(this.worldMatrix, this.direction, 4);
		const position = multiplyMatrixVector(this.worldMatrix, this.position, 4);
		return getWorldToCameraMatrixFromDirection(position, direction, UP);
	}

	get projectionMatrix(){
		return this.#isPerspective 
			? getProjectionMatrix(this.#screenHeight, this.#screenWidth, this.#fieldOfView, this.#near, this.#far)
			: getOrthoMatrix(this.#left, this.#right, this.#bottom, this.#top, this.#near, this.#far);
	}

	get fieldOfView() {
		return this.#fieldOfView;
	}

	/**
	 * 
	 * @param {ArrayLike<number>} position 
	 */
	set position(val){
		if(val.length === 3){
			this.#position = new Float32Array([...val, 1]);
		} else {
			this.#position = new Float32Array(val);
		}
	}
	get position(){
		return this.#position;
	}

	set direction(val){
		if(val.length === 3){
			this.#direction = new Float32Array([...val, 0]);
		} else {
			this.#direction = new Float32Array(val);
		}
	}
	get direction(){
		return this.#direction;
	}

	set name(val){
		this.#name = val;
	}
	get name(){
		return this.#name;
	}
}