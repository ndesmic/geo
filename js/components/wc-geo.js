import { GpuEngine as Engine } from "../engines/gpu-engine/gpu-engine.js";
import { DEGREES_PER_RADIAN } from "../utilities/math-helpers.js";
import { downloadBlob } from "../utilities/data-utils.js";

export class WcGeo extends HTMLElement {
	static observedAttributes = ["height", "width"];
	#height = 720;
	#width = 1280;
	#initialPointer;
	#initialCameraPosition;

	#isRecording = false;
	#recordedChunks;
	#mediaRecorder;

	#engineReady = false;

	constructor() {
		super();
		this.bind(this);
	}
	bind(element) {
		element.createShadowDom = element.createShadowDom.bind(element);
		element.attachEvents = element.attachEvents.bind(element);
		element.cacheDom = element.cacheDom.bind(element);
		element.onKeyDown = element.onKeyDown.bind(element);
		element.onPointerDown = element.onPointerDown.bind(element);
		element.onPointerUp = element.onPointerUp.bind(element);
		element.onPointerMove = element.onPointerMove.bind(element);
		element.onWheel = element.onWheel.bind(element);
	}
	createShadowDom() {
		this.shadow = this.attachShadow({ mode: "open" });
		this.shadow.innerHTML = `
				<style>
					:host { display: inline-grid; flex-flow: column nowrap; grid-template-rows: auto; grid-template-columns: auto; }
					canvas { grid-row: 1 / 2; grid-column: 1 / 2; display: block; }
					#overlay { grid-row: 1 / 2; grid-column: 1 / 2; position: relative; pointer-events: none; }
					#message { position: absolute; top: 8px; right: 8px; color: red; }
				</style>
				<canvas width="${this.#width}" height="${this.#height}"></canvas>
				<div id="overlay">
					<div id="message"></div>
				</div>
			`;
	}
	async connectedCallback() {
		this.createShadowDom();
		this.cacheDom();
		this.attachEvents();
		this.engine = new Engine({ canvas: this.dom.canvas });
		await this.engine.initialize();
		this.engine.start();
		this.#engineReady = true;
	}
	cacheDom() {
		this.dom = {
			canvas: this.shadow.querySelector("canvas"),
			message: this.shadow.querySelector("#message")
		};
	}
	attachEvents() {
		document.body.addEventListener("keydown", this.onKeyDown);
		this.dom.canvas.addEventListener("pointerdown", this.onPointerDown);
		this.dom.canvas.addEventListener("wheel", this.onWheel);
	}
	onKeyDown(e) {
		if (!this.#engineReady) return;
		switch (e.code) {
			case "KeyA": {
				this.engine.cameras.get("main").panBy({ x: 0.1 });
				break;
			}
			case "KeyD": {
				this.engine.cameras.get("main").panBy({ x: -0.1 });
				break;
			}
			case "KeyW": {
				this.engine.cameras.get("main").panBy({ z: 0.1 });
				break;
			}
			case "KeyR": {
				this.onRKeyPressed(e);
				break;
			}
			case "KeyS": {
				this.onSPressed(e);
				break;
			}
			case "NumpadAdd": {
				this.engine.cameras.get("main").zoomBy(2);
				break;
			}
			case "NumpadSubtract": {
				this.engine.cameras.get("main").zoomBy(0.5);
				break;
			}
			case "ArrowUp": {
				this.engine.cameras.get("main").orbitBy({ lat: Math.PI / 32 });
				break;
			}
			case "ArrowDown": {
				this.engine.cameras.get("main").orbitBy({ lat: -Math.PI / 32 });
				break;
			}
			case "ArrowRight": {
				this.engine.cameras.get("main").orbitBy({ long: Math.PI / 32 });
				break;
			}
			case "ArrowLeft": {
				this.engine.cameras.get("main").orbitBy({ long: -Math.PI / 32 });
				break;
			}
			case "Escape": {
				this.onEscPressed(e);
			}

		}
		e.preventDefault();
	}
	onPointerDown(e) {
		if (!this.#engineReady) return;
		this.#initialPointer = [e.offsetX, e.offsetY];
		this.#initialCameraPosition = this.engine.cameras.get("main").getPosition();
		this.dom.canvas.setPointerCapture(e.pointerId);
		this.dom.canvas.addEventListener("pointermove", this.onPointerMove);
		this.dom.canvas.addEventListener("pointerup", this.onPointerUp);
	}
	onPointerMove(e) {
		const pointerDelta = [
			e.offsetX - this.#initialPointer[0],
			e.offsetY - this.#initialPointer[1]
		];

		const radsPerWidth = (180 / DEGREES_PER_RADIAN) / this.#width;
		const xRads = pointerDelta[0] * radsPerWidth;
		const yRads = pointerDelta[1] * radsPerWidth * (this.#height / this.#width);

		this.engine.cameras.get("main").setPosition(this.#initialCameraPosition);
		this.engine.cameras.get("main").orbitBy({ long: xRads, lat: yRads });
	}
	onPointerUp(e) {
		this.dom.canvas.removeEventListener("pointermove", this.onPointerMove);
		this.dom.canvas.removeEventListener("pointerup", this.onPointerUp);
		this.dom.canvas.releasePointerCapture(e.pointerId);
	}
	onWheel(e) {
		if (!this.#engineReady) return;
		e.preventDefault();
		const delta = e.deltaY / 1000;
		this.engine.cameras.get("main").orbitBy({ radius: delta });
	}
	onRKeyPressed(e) {
		if (!e.shiftKey) return; //record function is shift+R
		this.#isRecording = !this.#isRecording;
		if (this.#isRecording) {
			this.dom.message.textContent = "Recording video";
			const stream = this.dom.canvas.captureStream(25);
			this.#mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'video/webm;codecs=vp9'
			});
			this.#recordedChunks = [];
			this.#mediaRecorder.ondataavailable = e => {
				if (e.data.size > 0) {
					this.#recordedChunks.push(e.data);
				}
			};
			this.#mediaRecorder.start();
		} else {
			this.setTemporaryMessage("Recording stopped");
			this.#mediaRecorder.stop();
			setTimeout(() => {
				const blob = new Blob(this.#recordedChunks, {
					type: "video/webm"
				});
				downloadBlob(blob, "recording.webm");
			}, 0);
		}
	}
	onSPressed(e){
		this.engine.cameras.get("main").panBy({ z: -0.1 });
	}
	onEscPressed(e){
		if (this.engine.isRunning) {
			this.engine.stop();
			this.dom.message.textContent = "Paused";
		} else {
			this.engine.start();
			this.setTemporaryMessage("Started");
		}
		return;
	}
	setTemporaryMessage(text){
		this.dom.message.textContent = text;
		setTimeout(() => {
			this.dom.message.textContent = "";
		}, 3000);
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
