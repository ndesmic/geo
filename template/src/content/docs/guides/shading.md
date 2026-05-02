## Diffuse (Lambert)

This is light that is being reflected at statistically random angles.  Visually it produces soft opaque color (eg "matte").  We calculate the weight of this light by taking the dot product of the inverse of the light direction (ie a vector towards the light) and the normal.  This is because more light it reflected if the surface it more perpendicular to the light.

## Specular (Blinn-Phong)

This is light that is reflected in a uniform way.  Visually the light that is at a reflection angle to the viewer will appear as a bright spot.  This gives a shiny appearance.  It is calculated by reflecting the light across the surface normal, if it hits the camera then we will see it.