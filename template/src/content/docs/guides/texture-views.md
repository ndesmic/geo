---
title: Texture Views
description: WGSL Texture Views
---

When textures are passed to bindings they have to have a view which is determines how they can be operated on.  It's similar to how `TypedArrays` operate on top of a `ArrayBuffer`.

## 2D

This is just a texture as an image, with a U and V coordinate.

## Basic example

`texture.createView({ dimension: "2d" })`;

### Texture array or cubemap layer as 2d

`texture.createView({ dimension: "2d", baseArrayLayer: index, arrayLayerCount: 1 })`

## Cube

This is a texture array as a cubemap.

| index | direction |
|-|-|
| 0 | +X |
| 1 | -X |
| 2 | +Y |
| 3 | -Y |
| 4 | +Z |
| 5 | -Z |

### Basic example

`texture.createView({ dimension: "cube" })`
