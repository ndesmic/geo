import { Camera } from "../entities/camera.js";
import { Material } from "../entities/material.js";
import { Mesh } from "../entities/mesh.js";
import { Group } from "../entities/group.js";
import { Light } from "../entities/light.js";
import { loadImage } from "../utilities/image-utils.js";
import { fetchObjMesh } from "./data-utils.js";
import { surfaceGrid, quad, cube } from "./mesh-generator.js";
import { Probe } from "../entities/probe.js";

export function parseFloatVector(text, length = 4, defaultValue = null) {
	return text?.trim()
		? text.split(",").map(x => parseFloat(x.trim())).slice(0, length)
		: defaultValue
}

export function parseIntOrDefault(text, defaultValue = null) {
	return text?.trim()
		? parseInt(text, 10)
		: defaultValue;
}

export function parseFloatOrDefault(text, defaultValue = null) {
	return text?.trim()
		? parseFloat(text)
		: defaultValue;
}

export function parseListOrDefault(text, defaultValue = null) {
	return text?.trim()
		? text.split(",").map(x => x.trim())
		: defaultValue
}

export function parseListOfFloatVector(text, length, defaultValue){
	return text?.trim()
		? text.split(";").map(v => v.trim().split(",").map(x => parseFloat(x.trim())).slice(0, length))
		: defaultValue
}

function updateMeshAttributes(meshEl, mesh) {
	const normalize = meshEl.hasAttribute("normalize");
	if (normalize) {
		mesh.normalizePositions();
	}

	const resizeUvs = parseIntOrDefault(meshEl.getAttribute("resize-uvs"));
	if (resizeUvs) {
		mesh.resizeUvs(resizeUvs)
	}

	const material = meshEl.getAttribute("material");
	mesh.setMaterial(material);

	const ambientLightMap = meshEl.getAttribute("ambient-light-map");
	mesh.ambientLightMap = ambientLightMap;

	const attributes = parseListOrDefault(meshEl.getAttribute("attributes"));
	if (attributes) {
		mesh.useAttributes(attributes);
	}

	const translate = parseFloatVector(meshEl.getAttribute("translate"), 3);
	if (translate) {
		mesh.translate({ x: translate[0], y: translate[1], z: translate[2] });
	}

	const rotate = parseFloatVector(meshEl.getAttribute("rotate"), 3);
	if (rotate) {
		mesh.rotate({ x: rotate[0], y: rotate[1], z: rotate[2] });
	}

	const scale = parseFloatVector(meshEl.getAttribute("scale"), 3);
	if (scale) {
		mesh.scale({ x: scale[0], y: scale[1], z: scale[2] });
	}

	//must come last because it updates mesh
	const bakeTransforms = meshEl.hasAttribute("bake-transforms");
	if (bakeTransforms) {
		mesh.bakeTransforms();
	}
}

function parseCamera(cameraEl, options = {}) {
	return new Camera({
		name: cameraEl.getAttribute("name"),
		position: parseFloatVector(cameraEl.getAttribute("position"), 3),
		screenHeight: cameraEl.getAttribute("height") ?? options.defaultHeight,
		screenWidth: cameraEl.getAttribute("width") ?? options.defaultWidth,
		fieldOfView: cameraEl.getAttribute("fov") ?? 90,
		near: cameraEl.getAttribute("near") ?? 0.01,
		far: cameraEl.getAttribute("far") ?? 5,
		isPerspective: !cameraEl.hasAttribute("is-orthographic")
	});
}

async function parseTexture(textureEl){
	const name = textureEl.getAttribute("name");
	const src = textureEl.getAttribute("src");
	const srcs = parseListOrDefault(textureEl.getAttribute("srcs"));
	const color = textureEl.getAttribute("color");
	const colors = textureEl.getAttribute("colors");
	let value;
	if (src) {
		value = { entity: "texture", image: await loadImage(src), name  };
	} else if(srcs){
		value = { entity: "texture", images: await Promise.all(srcs.map(s => loadImage(s))), name } 
	} else if (color) {
		value = { entity: "texture", color: parseFloatVector(color, 4), name };
	} else if (colors){
		value = { entity: "texture", colors: parseListOfFloatVector(colors, 4), name }
	}

	return value;
}

function parseMaterial(materialEl) {
	const roughnessMap = materialEl.getAttribute("roughness-map");
	const albedoMap = materialEl.getAttribute("albedo-map");

	return new Material({
		name: materialEl.getAttribute("name"),
		albedoMap: albedoMap,
		useRoughnessMap: !!roughnessMap,
		roughness: parseFloatOrDefault(materialEl.getAttribute("roughness")),
		metalness: parseFloatOrDefault(materialEl.getAttribute("metalness")),
		baseReflectance: parseFloatVector(materialEl.getAttribute("base-reflectance"), 3)
	});
}

async function parseMesh(meshEl) {
	const reverseWinding = meshEl.hasAttribute("reverse-winding");
	const src = meshEl.getAttribute("src");
	const mesh = await fetchObjMesh(src, { reverseWinding });

	updateMeshAttributes(meshEl, mesh);

	return mesh;
}

function parseSurfaceGrid(meshEl) {
	const rowCount = parseInt(meshEl.getAttribute("row-count"), 10);
	const colCount = parseInt(meshEl.getAttribute("col-count"), 10);
	const mesh = new Mesh(surfaceGrid(rowCount, colCount));

	updateMeshAttributes(meshEl, mesh);

	return mesh;
}

function parseQuad(meshEl){
	const mesh = new Mesh(quad());
	updateMeshAttributes(meshEl, mesh);
	return mesh;
}

function parseCube(meshEl){
	const mesh = new Mesh(cube());
	updateMeshAttributes(meshEl, mesh);
	return mesh;
}

function parseProbe(probeEl){
	const name = probeEl.getAttribute("name");
	const type = probeEl.getAttribute("type");
	const outputName = probeEl.getAttribute("outputName");
	const samples = parseInt(probeEl.getAttribute("samples"), 10);
	const position = parseFloatVector(probeEl.getAttribute("position"), 3);

	const probe = new Probe({
		name,
		type,
		outputName,
		position,
		samples
	});

	return probe;
}

/**
 * 
 * @param {HTMLElement} groupEl 
 */
async function parseGroup(groupEl, options){
	const children = await Promise.all(Array.from(groupEl.children).map(async c => {
		switch(c.tagName){
			case "GEO-BACKGROUND": {
				return parseBackground(c);
			}
			case "GEO-MESH": {
				return (await parseMesh(c));
			}
			case "GEO-SURFACE-GRID": {
				return parseSurfaceGrid(c);
			}
			case "GEO-QUAD": {
				return parseQuad(c);
			}
			case "GEO-CAMERA": {
				return parseCamera(c, options);
			}
			case "GEO-CUBE": {
				return parseCube(c)
			}
			case "GEO-GROUP": {
				return (await parseGroup(c, options))
			}
			case "GEO-LIGHT": {
				return parseLight(c)
			}
			case "GEO-PROBE": {
				return parseProbe(c);
			}
			case "GEO-TEXTURE": {
				return parseTexture(c);
			}
			case "GEO-MATERIAL": {
				return parseMaterial(c);
			}
			default: {
				throw new Error(`Group doesn't support ${c.tagName} children`)
			}
		}
	}));
		
	const group = new Group({
		children
	});

	const translate = parseFloatVector(groupEl.getAttribute("translate"), 3);
	if (translate) {
		group.translate({ x: translate[0], y: translate[1], z: translate[2] });
	}

	const rotate = parseFloatVector(groupEl.getAttribute("rotate"), 3);
	if (rotate) {
		group.rotate({ x: rotate[0], y: rotate[1], z: rotate[2] });
	}

	const scale = parseFloatVector(groupEl.getAttribute("scale"), 3);
	if (scale) {
		group.scale({ x: scale[0], y: scale[1], z: scale[2] });
	}

	return group;
}

function parseLight(lightEl) {
	const light = new Light({
		name: lightEl.getAttribute("name"),
		type: lightEl.getAttribute("type") ?? "point",
		color: parseFloatVector(lightEl.getAttribute("color"), 4, [1, 1, 1, 1]),
		direction: parseFloatVector(lightEl.getAttribute("direction"), 3, [0, 0, 0]),
		castsShadow: lightEl.hasAttribute("casts-shadow")
	});

	const translate = parseFloatVector(lightEl.getAttribute("translate"), 3);
	if (translate) {
		light.translate({ x: translate[0], y: translate[1], z: translate[2] });
	}

	const rotate = parseFloatVector(lightEl.getAttribute("rotate"), 3);
	if (rotate) {
		light.rotate({ x: rotate[0], y: rotate[1], z: rotate[2] });
	}

	return light;
}

function parseBackground(backgroundEl){
	if(!backgroundEl) return null;
	return {
		entity: "background",
		environmentMap: backgroundEl.getAttribute("environment-map"),
		sampler: backgroundEl.getAttribute("sampler")
	};
}

export async function parseScene(element) {
	const sceneRoot = await parseGroup(element, {
		defaultWidth: element.width,
		defaultHeight: element.height
	});

	return {
		sceneRoot,
	};
}
