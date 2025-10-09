import { getTranslationMatrix, getRotationXMatrix, getRotationYMatrix, getRotationZMatrix, getScaleMatrix, multiplyMatrix, getIdentityMatrix } from "../utilities/vector.js";

export class Transformable {
    #transforms = [];
    #worldMatrix = getIdentityMatrix();

    get modelMatrix() {
        return this.#transforms.reduce((mm, tm) => multiplyMatrix(tm, [4,4], mm, [4,4]), getIdentityMatrix());
    }
    get worldMatrix() {
        return this.#worldMatrix;
    }
    /**
     * @param {Float32Array} value 
     */
    set worldMatrix(value){
        this.#worldMatrix = value;
    }

    translate({ x = 0, y = 0, z = 0 }) {
        this.#transforms.push(getTranslationMatrix(x, y, z));
        return this;
    }
    scale({ x = 1, y = 1, z = 1 }) {
        this.#transforms.push(getScaleMatrix(x, y, z));
        return this;
    }
    rotate({ x, y, z }) {
        //there's an order dependency here... something something quaternions...
        if (x) {
            this.#transforms.push(getRotationXMatrix(x));
        }
        if (y) {
            this.#transforms.push(getRotationYMatrix(y));
        }
        if (z) {
            this.#transforms.push(getRotationZMatrix(z));
        }
        return this;
    }
    resetTransforms() {
        this.#transforms = [];
    }
}