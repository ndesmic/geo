import { Camera } from "../entities/camera.js";
import { Material } from "../entities/material.js";
import { Mesh } from "../entities/mesh.js";
import { Group } from "../entities/group.js";
import { Light } from "../entities/light.js";
import { loadImage } from "../utilities/image-utils.js";
import { fetchObjMesh } from "./data-utils.js";
import { surfaceGrid, quad, cube } from "./mesh-generator.js";

function parseVector(text, length = 4, defaultValue = null) {
	return text
		? text.split(",").map(x => parseFloat(x.trim()))
		: defaultValue
}

function parseIntOrDefault(text, defaultValue = null) {
	return text
		? parseInt(text, 10)
		: defaultValue;
}

function parseFloatOrDefault(text, defaultValue = null) {
	return text
		? parseFloat(text)
		: defaultValue;
}

function parseListOrDefault(text, defaultValue = null) {
	return text
		? text.split(",").map(x => x.trim())
		: defaultValue
}

function getKey(element, entityType) {
	const key = element.getAttribute("key");
	if (!key) {
		throw new Error(`${element} must have key`);
	}
	return key;
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

	const attributes = parseListOrDefault(meshEl.getAttribute("attributes"));
	if (attributes) {
		mesh.useAttributes(attributes);
	}

	const translate = parseVector(meshEl.getAttribute("translate"), 3);
	if (translate) {
		mesh.translate({ x: translate[0], y: translate[1], z: translate[2] });
	}

	const rotate = parseVector(meshEl.getAttribute("rotate"), 3);
	if (rotate) {
		mesh.rotate({ x: rotate[0], y: rotate[1], z: rotate[2] });
	}

	const scale = parseVector(meshEl.getAttribute("scale"), 3);
	if (scale) {
		mesh.scale({ x: scale[0], y: scale[1], z: scale[2] });
	}

	//must come last because it updates mesh
	const bakeTransforms = meshEl.hasAttribute("bake-transforms");
	if (bakeTransforms) {
		mesh.bakeTransforms();
	}
}

function parseCamera(cameraEl, options) {
	const key = getKey(cameraEl, "camera");

	return [
		key,
		new Camera({
			position: parseVector(cameraEl.getAttribute("position"), 3),
			screenHeight: cameraEl.getAttribute("height") ?? options.defaultHeight,
			screenWidth: cameraEl.getAttribute("width") ?? options.defaultHWidth,
			fieldOfView: cameraEl.getAttribute("fov") ?? 90,
			near: cameraEl.getAttribute("near") ?? 0.01,
			far: cameraEl.getAttribute("far") ?? 5,
			isPerspective: !cameraEl.hasAttribute("is-orthographic")
		})
	]
}

async function parseTexture(textureEl){
	const key = getKey(textureEl, "texture")
	const src = textureEl.getAttribute("src");
	const color = textureEl.getAttribute("color");
	let value;
	if (src) {
		value = { image: await loadImage(src) };
	} else if (color) {
		value = { color: parseVector(color, 4) };
	}

	return [key, value];
}

function parseMaterial(materialEl) {
	const key = getKey(materialEl, "material");
	const roughnessMap = materialEl.getAttribute("roughness-map");
	const albedoMap = materialEl.getAttribute("albedo-map");

	return [
		key,
		new Material({
			name: key,
			albedoMap: albedoMap,
			useRoughnessMap: !!roughnessMap,
			roughness: parseFloatOrDefault(materialEl.getAttribute("roughness")),
			metalness: parseFloatOrDefault(materialEl.getAttribute("metalness")),
			baseReflectance: parseVector(materialEl.getAttribute("base-reflectance"), 3)
		})
	]
}

async function parseMesh(meshEl) {
	const key = getKey(meshEl, "mesh");
	const reverseWinding = meshEl.hasAttribute("reverse-winding");
	const src = meshEl.getAttribute("src");
	const mesh = await fetchObjMesh(src, { reverseWinding });

	updateMeshAttributes(meshEl, mesh);

	return [key, mesh];
}

function parseSurfaceGrid(meshEl) {
	const key = getKey(meshEl, "surface-grid");
	const rowCount = parseInt(meshEl.getAttribute("row-count"), 10);
	const colCount = parseInt(meshEl.getAttribute("col-count"), 10);
	const mesh = new Mesh(surfaceGrid(rowCount, colCount));

	updateMeshAttributes(meshEl, mesh);

	return [key, mesh];
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

/**
 * 
 * @param {HTMLElement} groupEl 
 */
async function parseGroup(groupEl){
	const key = getKey(groupEl, "group");
	const children = await Promise.all(Array.from(groupEl.children).map(async c => {
		switch(c.tagName){
			case "GEO-MESH": {
				return (await parseMesh(c))[1];
			}
			case "GEO-SURFACE-GRID": {
				return parseSurfaceGrid(c)[1];
			}
			case "GEO-QUAD": {
				return parseQuad(c);
			}
			case "GEO-CUBE": {
				return parseCube(c)
			}
			case "GEO-GROUP": {
				return (await parseGroup(c))[1]
			}
			default: {
				throw new Error(`Group doesn't support ${c.tagName} children`)
			}
		}
	}));
		
	const group = new Group({
		children
	});

	const translate = parseVector(groupEl.getAttribute("translate"), 3);
	if (translate) {
		group.translate({ x: translate[0], y: translate[1], z: translate[2] });
	}

	const rotate = parseVector(groupEl.getAttribute("rotate"), 3);
	if (rotate) {
		group.rotate({ x: rotate[0], y: rotate[1], z: rotate[2] });
	}

	const scale = parseVector(groupEl.getAttribute("scale"), 3);
	if (scale) {
		group.scale({ x: scale[0], y: scale[1], z: scale[2] });
	}

	return [key, group];
}

function parseLights(lightEl) {
	const key = getKey(lightEl, "light");
	const light = new Light({
		type: lightEl.getAttribute("type") ?? "point",
		color: parseVector(lightEl.getAttribute("color"), 4, [1, 1, 1, 1]),
		direction: parseVector(lightEl.getAttribute("direction"), 3, [0, 0, 0]),
		castsShadow: lightEl.hasAttribute("casts-shadow")
	});

	return [key, light];
}

function getPipelineMesh(meshEl) {
	const pipeline = meshEl.getAttribute("pipeline");
	const meshKey = meshEl.getAttribute("key");

	return {
		pipeline,
		meshKey
	};
}

export async function parseScene(element) {
	const cameras = Object.fromEntries(Array.from(element.querySelectorAll("geo-camera"))
		.map(c => parseCamera(c, { defaultHeight: element.dom.canvas.height, defaultHWidth: element.dom.canvas.width })));

	const textures = Object.fromEntries(await Promise.all(Array.from(element.querySelectorAll("geo-texture"))
		.map(parseTexture)));

	const materials = Object.fromEntries(Array.from(element.querySelectorAll("geo-material"))
		.map(parseMaterial));

	const meshes = Object.fromEntries(await Promise.all(Array.from(element.children).filter(c => c.tagName === "GEO-MESH")
		.map(parseMesh)));

	const groups = Object.fromEntries(await Promise.all(Array.from(element.children).filter(c => c.tagName === "GEO-GROUP")
		.map(parseGroup)));

	const surfaceGrids = Object.fromEntries(Array.from(element.querySelectorAll("geo-surface-grid"))
		.map(parseSurfaceGrid));

	const lights = Object.fromEntries(Array.from(element.querySelectorAll("geo-light"))
		.map(parseLights));

	const pipelineMeshes = Array.from(element.querySelectorAll("geo-mesh, geo-surface-grid, geo-group"))
		.filter(c => c.getAttribute("pipeline"))
		.map(getPipelineMesh);

	if (cameras.length === 0) {
		throw new Error("Need a 'main' camera defined");
	}
	return {
		cameras,
		textures,
		materials,
		meshes: { ...meshes, ...surfaceGrids },
		groups,
		lights,
		pipelineMeshes
	};
}
