export class Probe {
    #name;
    #type;
    #position;
    #outputName;
    #samples;

    constructor(probe){
        this.name = probe.name;
        this.type = probe.type;
        this.position = probe.position;
        this.outputName = probe.outputName;
        this.samples = probe.samples;
    }

    set name(val){
        this.#name = val;
    }
    get name(){
        return this.#name;
    }

    set type(val){
        this.#type = val;
    }
    get type(){
        return this.#type;
    }

    set position(val){
		if(val.length === 3){
			this.#position = new Float32Array([...val, 1]);
		} else {
			this.#position = new Float32Array(val);
		}
    }
    get position(){
        return this.#position;
    }

    set outputName(val){
        this.#outputName = val;
    }
    get outputName(){
        return this.#outputName;
    }

    set samples(val){
        this.#samples = val;
    }
    get samples(){
        return this.#samples;
    }
}