## Entity shared attributes

`name` is required on nearly all objects for tracking purposes.

| attribute name | type | required | default | description |
|-|-|-|-|-|
| name | string | true | - | The identifier for the entity |

## Camera 📷

### `<geo-camera>`

A camera into the scene.  A default camera with key "main" is required.

| attribute name | type | required | default | description |
|-|-|-|-|-|
| position | vec3<float> | true | - | The position of the camera |
| direction | vec3<float> | false | (toward 0,0,0) | The direction of the camera |
| is-orthographic | boolean | false | false | The camera uses orthographic projection

Example:

```xml
<geo-camera name="main" position="0.5, 0.2, -0.5"></geo-camera>
```

## Texture 🧱

### `<geo-texture>`

An image or solid color (1x1) texture map

| attribute name | type | required | default | description |
|-|-|-|-|-|
| src | string / vec<string> | false | - | The remote image url or image urls for multi-layer texture |
| color | vec4<float> | false | - | The color of the texuture to create |

Example:

```xml
<geo-texture name="red-fabric-roughness" src="./img/red-fabric/red-fabric-roughness.jpg"></geo-texture>
<geo-texture name="gold" color="0, 0, 0, 1"></geo-texture>
```

## Material 💎

### `<geo-material>`

A material for mesh objects

| attribute name | type | required | default | description |
|-|-|-|-|-|
| albedo-map | string | false | - | The albedo (base color) map ref for the material |
| roughness-map | string | false | - | The roughness map ref for the material |
| roughness | float | false | - | The roughness for the material (not used if roughness-map present) |
| metalness | float | false | - | The metalness for the material |
| base-reflectance | vec3<float> | false | - | The base reflectance (F0) value of the material per color channel |

Example:

```xml
<geo-material name="gold" roughness="0.2" metalness="1" base-reflectance="1.059, 0.773, 0.307" albedo-map="gold"></geo-material>
```

## Background ⛰️

### `<geo-background>`

A cubemap to set the scene.

| attribute name | type | required | default | description |
|-|-|-|-|-|
| environment-map | string | true | - | The name of the cubemap texture |
| sampler | string | false | default sampler | The name of the sampler |

## Lights 💡

### `<geo-light>`

A light. Can be point or directional.

| attribute name | type | required | default | description |
|-|-|-|-|-|
| type | "point" / "directional" | true | - | The type of light |
| color | vec4<float> | true | - | The light color |
| position | vec3<float> | when type=point | - | The light position |
| direction | vec3<float> | when type=directional | - | The light direction |
| casts-shadow | boolean | false | fasle | If present the light will cast a shadow |

Example:

```xml
<geo-light color="r,g,b" name="light-1" type="point" direction="x,y,z" position="x,y,z" />
```

## Meshes 🌐

### Mesh Shared attributes

These attributes are shared among all mesh elements

| attribute name | type | required | default | description |
|-|-|-|-|-|
| normalize | boolean | false | false | Sizes the mesh to fit in a 1,1,1 volume and centers at 0,0,0 |
| bake-transforms | boolean | false | false | updates the underlying positions buffer with current transforms (eg custom normalization) |
| resize-uvs | int | false | false | changes the length of the UV vectors (eg some models use vec3 UVs) |
| material | string | true | - | The material to render the mesh with |
| attributes | vec<"positions"/"normals"/"uvs"> | false | - | attributes to use (eg to remove attributes that are not used by the pipeline as they may not align with vertex buffer descriptions) |
| pipeline | string | true | - | The key for the pipeline this mesh is run on |
| rotate | vec3<float> | | rotates x,y,z by the 3 valued tuple in radians
| translate | vec3<float> | | translates x,y,z by the 3 valued tuple
| scale | vec3<float> | | scales x,y,z by the 3 valued tuple

### `<geo-mesh>`

Loads .obj files

| attribute name | type | required | default | description |
|-|-|-|-|-|
| reverse-winding | boolean | false | false | reverses the winding order of the triangles (eg for correct culling) |
| src | string | true | - | The remote url for the .obj file |

Example:

```xml
<geo-mesh 
	name="teapot" 
	normalize
	bake-transforms 
	reverse-winding 
	src="./objs/teapot.obj" 
	resize-uvs="2" 
	material="gold" 
	attributes="positions, normals, uvs" 
	pipeline="main">
</geo-mesh>
```

### `<geo-surface-grid>`

Creates a surface tesselated into a grid of squares.  Default orientation is along XZ plane.

| attribute name | type | required | default | description |
|-|-|-|-|-|
| row-count | int | true | - | The number of rows in the surface |
| col-count | int | true | - | The number of columns in the surface |

Example:

```xml
<geo-surface-grid 
	name="rug" 
	row-count="2" 
	col-count="2" 
	translate="0, -0.25, 0" 
	bake-transforms 
	material="red-fabric" 
	attributes="positions, normals, uvs" 
	pipeline="main">
</geo-surface-grid>
```

### `<geo-cube>`

Creates a cube with each position at 1 or -1, volume = 4.

| attribute name | type | required | default | description |
|-|-|-|-|-|

Example:

```xml
<geo-cube 
	name="cube" 
	material="gold" 
	attributes="positions, normals, uvs" 
	pipeline="main">
</geo-cube>
```

### `<geo-quad>`

Creates a quad with each position at 1 or -1 facing -Z

| attribute name | type | required | default | description |
|-|-|-|-|-|

Example:

```xml
<geo-quad
	name="quad" 
	material="gold" 
	attributes="positions, normals, uvs" 
	pipeline="main">
</geo-quad>
```

## Groups 📦

### Group

Creates a group which can transform multiple objects (only meshes supported).

| attribute name | type | required | default | description |
|-|-|-|-|-|
| rotate | vec3<float> | | rotates x,y,z by the 3 valued tuple in radians
| translate | vec3<float> | | translates x,y,z by the 3 valued tuple
| scale | vec3<float> | | scales x,y,z by the 3 valued tuple

Example:

```xml
<geo-group name="quad" pipeline="main">
	<geo-quad
		key="gold-quad" 
		material="gold" 
		attributes="positions, normals, uvs">
	</geo-quad>
	<geo-quad
		id="red-quad" 
		material="red" 
		attributes="positions, normals, uvs"
		rotate="1.6, 0, 0">
	</geo-quad>
</geo-group>
```