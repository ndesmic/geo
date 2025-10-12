export type TransformValues = { x?: number, y?: number, z?: number };

export interface ITransformable {
  readonly modelMatrix: Float32Array;
  worldMatrix: Float32Array;
  translate(params: TransformValues): this;
  scale(params: TransformValues): this;
  rotate(params: TransformValues): this;
  resetTransforms(): void;
}