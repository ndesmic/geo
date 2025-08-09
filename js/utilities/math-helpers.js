export const TWO_PI = Math.PI * 2
export const QUARTER_TURN = Math.PI / 2;
export const DEGREES_PER_RADIAN = 180 / Math.PI;

export function normalizeAngle(angle) {
	return (angle % TWO_PI) + TWO_PI;
}

export function radiansToDegrees(rad){
	return rad * 180/Math.PI;
}

/**
 * 
 * @param {[number, number, number]} coords 
 * @returns 
 */

export function cartesianToSpherical([x, y, z]) {
	const radius = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
	return [
		Math.asin(y / radius),
		Math.atan2(z, x),
		radius
	];
}

/**
 * 
 * @param {[number, number, number]} latLng
 * @returns 
 */
export function sphericalToCartesian([phi, theta, radius = 1]){
	return [
		radius * Math.cos(phi) * Math.cos(theta),
		radius * Math.sin(phi),
		radius * Math.cos(phi) * Math.sin(theta),
	];
}

export function clamp(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
	return Math.max(Math.min(value, max), min);
}

export function wrap(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
	const range = max - min;
	return value < min
		? max - Math.abs(min - value) % range
		: min + (value + range) % range;
}

export function mirrorWrap(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
	const range = max - min;
	const minDistance = Math.abs(min - value);
	const intervalValue = minDistance % range;
	if (value % (max + max) > max) return max - intervalValue //too high (mirrored)
	if (value >= max) return min + intervalValue; //to high (unmirrored)
	if (value < min && minDistance % (range + range) > range) return max - intervalValue; //too low (mirrored)
	if (value <= min) return min + intervalValue; //to low (mirrored)
	return value;
}

export function lerp(start, end, normalValue) {
	return start + (end - start) * normalValue;
}

export function inverseLerp(start, end, value) {
	return (value - start) / (end - start);
}

export function normalizeNumber(num, len){
	num = parseFloat(num.toFixed(len));
	num = num === -0 ? 0 : num;

	return num;
}