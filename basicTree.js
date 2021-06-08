// Pasted file from https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html
// The goal is then to adapt this logic to our application, so that we may have the same AR
// effects, but ideally the objects would be automatically placed within the image

import * as THREE from './threeJs/build/three.module.js';
import { ARButton } from './threeJs/examples/jsm/webxr/ARButton.js';

    //Setting up AR variables
    /* Here are the "old" constants
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
    // Removing this button to test alternatives
    /*
	container.appendChild(ARButton.createButton(renderer, 
        {
        requiredFeatures: ['hit-test']["dom-overlay"],
        domOverlay: {
            root: document.getElementById("overlay")
            }
        }
    ));
    */

let renderer = null;
let scene = null;
let camera = null;
let reticle = null;
// Target object for now
const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);

const initScene = (gl, session) => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
	light.position.set(0.5, 1, 0.25);
	scene.add(light);

    // create and configure three.js renderer with XR support
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        autoClear: true,
        context: gl,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setSession(session);

    // simple sprite to indicate detected surfaces
    reticle = new THREE.Mesh(
        new THREE.RingBufferGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    // we will update it's matrix later using WebXR hit test pose matrix
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    controller = renderer.xr.getController(0);
	controller.addEventListener('select', placeObject);
	scene.add(controller);
};

// button to start XR experience
const xrButton = document.getElementById('xr-button');
// to display debug information
const info = document.getElementById('info');
// to control the xr session
let xrSession = null;
// for hit testing with detected surfaces
let xrHitTestSource = null;

// Canvas OpenGL context used for rendering
let gl = null;

// Checking XR, triggers checkSupportedState event
function checkXR() {
    if (!window.isSecureContext) {
        document.getElementById("warning").innerText = "WebXR unavailable. Please use secure context";
    }
    if (navigator.xr) {
        navigator.xr.addEventListener('devicechange', checkSupportedState);
        checkSupportedState();
    } else {
        document.getElementById("warning").innerText = "WebXR unavailable for this browser"; 
    }
}

// Checking if supported, triggers onButtonClicked event
function checkSupportedState() {
navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (supported) {
    xrButton.innerHTML = 'Enter AR';
    xrButton.addEventListener('click', onButtonClicked);
    } else {
    xrButton.innerHTML = 'AR not found';
    }
    xrButton.disabled = !supported;
});
}

// Creating the AR session onclick
function onButtonClicked() {
if (!xrSession) {
    navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['dom-overlay'],
        requiredFeatures: ['local', 'hit-test'],
        domOverlay: {root: document.getElementById('overlay')}
    }).then(onSessionStarted, onRequestSessionError);
} else {
    xrSession.end();
}
}

// Triggered by the button click
function onSessionStarted(session) {
    xrSession = session;
    xrButton.innerHTML = 'Exit AR';

    // Show which type of DOM Overlay got enabled (if any)
    if (session.domOverlayState) {
        info.innerHTML = 'DOM Overlay type: ' + session.domOverlayState.type;
    }

    // create a canvas element and WebGL context for rendering
    // Here we'll want to modify the overlay to display smth 
    session.addEventListener('end', onSessionEnded);
    let canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', { xrCompatible: true });
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    // here we ask for viewer reference space, since we will be casting a ray
    // from a viewer towards a detected surface. The results of ray and surface intersection
    // will be obtained via xrHitTestSource variable
    session.requestReferenceSpace('viewer').then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((hitTestSource) => {
        xrHitTestSource = hitTestSource;
        });
    });

    session.requestReferenceSpace('local').then((refSpace) => {
        xrRefSpace = refSpace;
        session.requestAnimationFrame(onXRFrame);
    });

    // initialize three.js scene
    initScene(gl, session);
}

function onRequestSessionError(ex) {
    info.innerHTML = "Failed to start AR session.";
    console.error(ex.message);
}

function onSessionEnded(event) {
    xrSession = null;
    xrButton.innerHTML = 'Enter AR';
    info.innerHTML = '';
    gl = null;
    if (xrHitTestSource) xrHitTestSource.cancel();
    xrHitTestSource = null;
}

// Placing a random cylinder for now onclick
function placeObject() {
    if (reticle.visible) {
        const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.setFromMatrixPosition(reticle.matrix);
        mesh.scale.y = Math.random() * 2 + 1;
        scene.add(mesh);
    }
}

// Raycasting logic
function onXRFrame(t, frame) {
    //let session = frame.session;
    //session.requestAnimationFrame(onXRFrame);
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession(); //old way to get session
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

function animate() {
	renderer.setAnimationLoop(render);
}

checkXR();
animate();