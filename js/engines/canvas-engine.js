export class CanvasEngine {
	#canvas;
	#context;

	constructor(options){
		this.#canvas = options.canvas;
		this.#context = options.canvas.getContext("2d");
	}
	start(){
		this.renderLoop();
	}
	async intitialize(){}
	renderLoop(){
		requestAnimationFrame((timestamp) => {
			this.render(timestamp);
			this.renderLoop();
		});
	}
	render(){
		this.#context.clearRect(0,0,this.#canvas.width, this.#canvas.height);
		this.#context.fillStyle = "#ff0000";
		this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
	}
}