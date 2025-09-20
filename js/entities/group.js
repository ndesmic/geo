import { getIdentityMatrix, getRotationXMatrix, getRotationYMatrix, getRotationZMatrix, getScaleMatrix, getTranslationMatrix, multiplyMatrix } from "../utilities/vector.js";

export class Group {
    #children = [];
    #transforms = [];
    #worldMatrix = getIdentityMatrix();

    constructor(options) {
        this.#children = options.children;
    }

    get children() {
        return this.#children;
    }

    get modelMatrix() {
        return this.#transforms.reduce((mm, tm) => multiplyMatrix(tm, [4, 4], mm, [4, 4]), getIdentityMatrix());
    }

    get worldMatrix(){
        return this.#worldMatrix;
    }

    set worldMatrix(value){
        this.#worldMatrix = value;
        this.updateWorldMatrix();
    }

    updateWorldMatrix(){
        const worldMatrix = multiplyMatrix(this.modelMatrix, [4,4], this.#worldMatrix, [4,4]);
        for(const child of this.#children){
            child.worldMatrix = worldMatrix;
        }
    }

    translate({ x = 0, y = 0, z = 0 }) {
        this.#transforms.push(getTranslationMatrix(x, y, z));
        this.updateWorldMatrix();
        return this;
    }
    scale({ x = 1, y = 1, z = 1 }) {
        this.#transforms.push(getScaleMatrix(x, y, z));
        this.updateWorldMatrix();
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
        this.updateWorldMatrix();
        return this;
    }
}