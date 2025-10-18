//@ts-check
/** @typedef {import("./ambient-lit.d.ts").IAmbientLit} IAmbientLit */

/** @implements {IAmbientLit} */
export class AmbientLit {
    #ambientLightMap;

    constructor(options = {}){
        this.#ambientLightMap = options.ambientLightMap;
    }

    set ambientLightMap(val){
        this.#ambientLightMap = val;
    }
    get ambientLightMap(){
        return this.#ambientLightMap;
    }
}