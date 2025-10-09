import { scaleVector, subtractVector, getOrthoMatrix, getWorldToCameraMatrixFromTarget } from "./vector.js";

const distance = 0.75;
const center = [0, 0, 0];
const frustumScale = 2;

export function getLightViewMatrix(direction) {
	const lightPosition = scaleVector(subtractVector(center, direction), distance);
	return getWorldToCameraMatrixFromTarget(lightPosition, center);
}

export function getLightProjectionMatrix(aspectRatio) {
	const right = aspectRatio * frustumScale;
	return getOrthoMatrix(-right, right, -frustumScale, frustumScale, 0.1, Math.min(distance * 2, 2.0));
}