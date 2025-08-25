import { Light } from "./light.js";
import { getLookAtMatrix, getOrthoMatrix, scaleVector, subtractVector } from "../utilities/vector.js";

const distance = 0.75;
const center = [0, 0, 0];
const frustumScale = 2;

export class ShadowMappedLight extends Light {
	getViewMatrix(light) {
		const lightPosition = scaleVector(subtractVector(center, this.direction), distance);
		return getLookAtMatrix(lightPosition, center);
	}

	getProjectionMatrix(aspectRatio) {
		const right = aspectRatio * frustumScale;
		return getOrthoMatrix(-right, right, -frustumScale, frustumScale, 0.1, Math.min(distance * 2, 2.0));
	}
}