//@ts-check
/** @typedef {import("./ambient-lit.d.ts").IAmbientLit} IAmbientLit */

/** @implements {IAmbientLit} */
export class AmbientLit {
    #lightingEnvironmentMap;

    constructor(options = {}){
        this.#lightingEnvironmentMap = options.environmentMap;
    }

    get lightingEnvironmentMap(){
        return this.#lightingEnvironmentMap;
    }
}