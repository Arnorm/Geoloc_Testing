// Pasted file from https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html
// The goal is then to adapt this logic to our application, so that we may have the same AR
// effects, but ideally the objects would be automatically placed within the image

import * as THREE from './threeJs/build/three.module.js';

// Variables for sensors
const log = console.log;
const target_Long = 2.295284992068256;
const target_Lat = 48.87397517044594;
const angle_Treshold = 30; // To be changed later, maybe even based on the camera of the device
var bearing_Device_Target = 0; // Angles declared as globals for now
const isIOS = // different handlings
    navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
    navigator.userAgent.match(/AppleWebKit/);

// Variables for AR
let visual_Debug = document.getElementById("visual_Debug");
let renderer = null;
let scene = null;
let camera = null;
let mixer = null;
let action = null;
let reticle = null;
let geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0);
let lastFrame = Date.now();

const initScene = (gl, session) => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    var light = new THREE.PointLight(0xffffff, 2, 100); // soft white light
    light.position.z = 1;
    light.position.y = 5;
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
        new THREE.MeshPhongMaterial({ color: 0x0fff00 })
    );
    // we will update it's matrix later using WebXR hit test pose matrix
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
};

function init_Sensors() {
    console.log("inside Sensors");
    navigator.geolocation.watchPosition(handler_Location);
    if (!isIOS) {
    // if not on IOS, we add this listener to handle Orientation
        window.addEventListener("deviceorientationabsolute", handler_Orientation, true);
    }
}

// button to start XR experience
const xrButton = document.getElementById('xr-button');
// to display debug information
const info = document.getElementById('info');
// to control the xr session
let xrSession = null;
// reference space used within an application https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace
let xrRefSpace = null;
// for hit testing with detected surfaces
let xrHitTestSource = null;

// Canvas OpenGL context used for rendering
let gl = null;

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

function checkSupportedState() {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
        // calling init_Sensors to get informations
        // Need to call them before fullscreen for permission to be seen by user
        init_Sensors();
        xrButton.innerHTML = 'Enter AR';
        xrButton.addEventListener('click', onButtonClicked);
        } else {
        xrButton.innerHTML = 'AR not found';
        }
        xrButton.disabled = !supported;
    });
}

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

function onSessionStarted(session) {
    visual_Debug.innerHTML = "Direction/Instructions";
    xrSession = session;
    xrButton.innerHTML = 'Exit AR';

    // Show which type of DOM Overlay got enabled (if any)
    if (session.domOverlayState) {
        info.innerHTML = 'DOM Overlay type: ' + session.domOverlayState.type;
    }

    // create a canvas element and WebGL context for rendering
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

    document.getElementById("overlay").addEventListener('click', placeObject);

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

function placeObject() {
    if (reticle.visible) {
        const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.setFromMatrixPosition(reticle.matrix);
        mesh.scale.y = Math.random() * 2 + 1;
        scene.add(mesh);
    }
}

// Utility function to update animated objects
function updateAnimation() {
    let dt = (Date.now() - lastFrame) / 1000;
    lastFrame = Date.now();
    if (mixer) {
        mixer.update(dt);
    }  
}

function onXRFrame(t, frame) {
    let session = frame.session;
    session.requestAnimationFrame(onXRFrame);

    if (xrHitTestSource) {
        // obtain hit test results by casting a ray from the center of device screen
        // into AR view. Results indicate that ray intersected with one or more detected surfaces
        const hitTestResults = frame.getHitTestResults(xrHitTestSource);
        if (hitTestResults.length) {
        // obtain a local pose at the intersection point
        const pose = hitTestResults[0].getPose(xrRefSpace);
        // place a reticle at the intersection point
        reticle.matrix.fromArray(pose.transform.matrix);
        reticle.visible = true;
        }
    } else {  // do not show a reticle if no surfaces are intersected
        reticle.visible = false;
    }

    // update object animation
    updateAnimation();
    // bind our gl context that was created with WebXR to threejs renderer
    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
    // render the scene
    renderer.render(scene, camera);
}

// triggers everything
checkXR();

/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///
/// /// SENSORS /// /// /// ///
/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///

// Only for IOS, not tested YET
function startCompass() {
    if (isIOS) {
    DeviceOrientationEvent.requestPermission()
        .then((response) => {
        if (response === "granted") {
            window.addEventListener("deviceorientation", handler_Orientation, true);
        } else {
            alert("has to be allowed!");
        }
        })
        .catch(() => alert("not supported"));
    }
}

// Handles angles sensor
function handler_Orientation(e) {
    console.log(e.alpha);
    compass = e.webkitCompassHeading || Math.abs(e.alpha - 360); // not always defined otherwise
    var delta_Angle = bearing_Device_Target - compass;
    //displayed_Logs_Orientation.innerHTML = `Delta angle is : ${delta_Angle.toFixed(1)}, we are in orientation still`;
    handler_Display(delta_Angle);
}

// Handles location sensor
function handler_Location(position) {
    bearing_Device_Target = bearing(
        position.coords.latitude,
        position.coords.longitude,
        target_Lat,
        target_Long
    );
    var distance_Device_Target = calcCrow(
        position.coords.latitude,
        position.coords.longitude,
        target_Lat,
        target_Long
    );
    /*displayed_Logs_Geo.innerHTML = `longitude:${position.coords.longitude}; 
        latitude:${position.coords.latitude};
        and you are ${distance_Device_Target} km away from target.
        Also, bearing is : ${bearing_Device_Target}`;
    */
    visual_Debug.innerHTML = `you are ${distance_Device_Target.toFixed(1)} km away from target`;
}

// Handles overlay display
function handler_Display(delta_Angle) {
    var abs_Delta_Angle = ((delta_Angle % 360) + 360) % 360; //Js % is not mod (see doc for more info)
    var min_Angle = Math.min(360 - abs_Delta_Angle, abs_Delta_Angle);
    if(min_Angle<angle_Treshold){
        /*visualisation_Target.innerHTML = `Min angle is : ${min_Angle.toFixed(1)}.
         Here we are within the cone (limit angle being : ${angle_Treshold}) 
         so we may Display some information about the object, like size, color, picture ...`;
         */
    }
    else{
        //visualisation_Target.innerHTML = `Min angle is : ${min_Angle.toFixed(1)}.`;
    }
}

/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///
/// /// AUXILIARIES /// /// ///
/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(startLat, startLng, destLat, destLng) 
{
    var R = 6371; // km
    var dLat = toRadians(destLat-startLat);
    var dLon = toRadians(destLng-startLng);
    var startLat = toRadians(startLat);
    var destLat = toRadians(destLat);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(startLat) * Math.cos(destLat); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

// Converts from degrees to radians.
function toRadians(degrees) {
    return degrees * Math.PI / 180;
  };
   
// Converts from radians to degrees.
function toDegrees(radians) {
    return radians * 180 / Math.PI;
}
  
// Bearing formula, between two 2D points, clockwise angle between north and (start,dest)
function bearing(startLat, startLng, destLat, destLng){
    startLat = toRadians(startLat);
    startLng = toRadians(startLng);
    destLat = toRadians(destLat);
    destLng = toRadians(destLng);
    y = Math.sin(destLng - startLng) * Math.cos(destLat);
    x = Math.cos(startLat) * Math.sin(destLat) -
          Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    bearing_ = Math.atan2(y, x);
    bearing_ = toDegrees(bearing_);
    return (bearing_ + 360) % 360;
}

// Compass heading (not used at the moment)
function compassHeading(alpha, beta, gamma) {
    // Convert degrees to radians
    var alphaRad = alpha * (Math.PI / 180);
    var betaRad = beta * (Math.PI / 180);
    var gammaRad = gamma * (Math.PI / 180);
    // Calculate equation components
    var cA = Math.cos(alphaRad);
    var sA = Math.sin(alphaRad);
    var cB = Math.cos(betaRad);
    var sB = Math.sin(betaRad);
    var cG = Math.cos(gammaRad);
    var sG = Math.sin(gammaRad);
    // Calculate A, B, C rotation components
    var rA = - cA * sG - sA * sB * cG;
    var rB = - sA * sG + cA * sB * cG;
    var rC = - cB * cG;
    // Calculate compass heading
    var compassHeading = Math.atan(rA / rB);
    // Convert from half unit circle to whole unit circle
    if(rB < 0) {
      compassHeading += Math.PI;
    }else if(rA < 0) {
      compassHeading += 2 * Math.PI;
    }
    // Convert radians to degrees
    compassHeading *= 180 / Math.PI;
    return compassHeading;
}