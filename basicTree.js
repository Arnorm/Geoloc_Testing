// Pasted file from https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html
// The goal is then to adapt this logic to our application, so that we may have the same AR
// effects, but ideally the objects would be automatically placed within the image

import * as THREE from './threeJs/build/three.module.js';
import { ARButton } from './threeJs/examples/jsm/webxr/ARButton.js';

let container;
let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

init();
animate();

function init() {
	// Change the entry point
    container = document.getElementById('right_View');
	document.body.appendChild(container);

	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
	const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
	light.position.set(0.5, 1, 0.25);
	scene.add(light);
	renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;
	container.appendChild(renderer.domElement);
    // This button will trigger fullscreen XR, we call dom-overlay here
	container.appendChild(ARButton.createButton(renderer, 
        {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ["dom-overlay"],
        domOverlay: {
        root: document.getElementById("overlay")
        }
    }));
	const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);

	function onSelect() {
		if (reticle.visible) {
			const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.setFromMatrixPosition(reticle.matrix);
			mesh.scale.y = Math.random() * 2 + 1;
			scene.add(mesh);
		}
	}
	controller = renderer.xr.getController(0);
	controller.addEventListener('select', onSelect);
	scene.add(controller);
	reticle = new THREE.Mesh(
		new THREE.RingGeometry(0.15, 0.2, 32).rotateX(- Math.PI / 2),
		new THREE.MeshBasicMaterial()
	);
	reticle.matrixAutoUpdate = false;
	reticle.visible = false;
	scene.add(reticle);
	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}

function onSessionStarted(session) {
    document.getElementById("xr-button").innerHTML = "Exit AR";

    // Show which type of DOM Overlay got enabled (if any)
    if (session.domOverlayState) {
        document.getElementById("session-info").innerHTML =
        "DOM Overlay type: " + session.domOverlayState.type;
    }
}

function onXRFrame(t, frame) {
    // Update the clear color so that we can observe the color in the
    // headset changing over time. Use a scissor rectangle to keep the AR
    // scene visible.
    const width = session.renderState.baseLayer.framebufferWidth;
    const height = session.renderState.baseLayer.framebufferHeight;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(width / 4, height / 4, width / 2, height / 2);
    let time = Date.now();
    gl.clearColor(
        Math.cos(time / 2000), Math.cos(time / 4000), Math.cos(time / 6000),
        0.5
    );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function animate() {
	renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
	if (frame) {
		const referenceSpace = renderer.xr.getReferenceSpace();
		const session = renderer.xr.getSession();
		if (hitTestSourceRequested === false) {
			session.requestReferenceSpace('viewer').then(function(referenceSpace) {
				session.requestHitTestSource({space: referenceSpace}).then(function(source) {
					hitTestSource = source;
				});
			});
			session.addEventListener('end', function() {
				hitTestSourceRequested = false;
				hitTestSource = null;
			});
			hitTestSourceRequested = true;
		}
		if (hitTestSource) {
			const hitTestResults = frame.getHitTestResults(hitTestSource);
			if (hitTestResults.length) {
				const hit = hitTestResults[0];
				reticle.visible = true;
				reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
			} else {
				reticle.visible = false;
			}
		}
	}
	renderer.render(scene, camera);
}