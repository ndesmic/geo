import { GpuEngine as Engine } from "../engines/gpu-engine.js";

export class WcGeo extends HTMLElement {
	static observedAttributes = ["height", "width"];
	#height = 720;
	#width = 1280;
	constructor() {
		super();
		this.bind(this);
	}
	bind(element) {
		element.createShadowDom = element.createShadowDom.bind(element);
		element.attachEvents = element.attachEvents.bind(element);
		element.cacheDom = element.cacheDom.bind(element);
	}
	createShadowDom() {
		this.shadow = this.attachShadow({ mode: "open" });
		this.shadow.innerHTML = `
				<style>
					:host { display: block; flex-flow: column nowrap; }
					canvas { display: block; }
				</style>
				<canvas width="${this.#width}" height="${this.#height}"></canvas>
			`;
	}
	async connectedCallback() {
		this.createShadowDom();
		this.cacheDom();
		this.attachEvents();
		this.engine = new Engine({ canvas: this.dom.canvas });
		await this.engine.initialize();
		this.engine.start();
	}
	cacheDom() {
		this.dom = {};
		this.dom.canvas = this.shadow.querySelector("canvas");
	}
	attachEvents() {

	}
	attributeChangedCallback(name, oldValue, newValue) {
		this[name] = newValue;
	}
	renderLoop() {
		requestAnimationFrame((timestamp) => {
			this.render(timestamp);
			this.renderLoop();
		});
	}
}

customElements.define("wc-geo", WcGeo);
