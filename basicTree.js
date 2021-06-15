// Module is directly included in the project, we might want to change this
import * as THREE from './threeJs/build/three.module.js';

// Variables for sensors
// distance at which we consider the user to be "near" the object, in km
const minimal_Display_Distance = 0.05;
let distance_Device_Target = null;
let is_Fullscreen_Active = false; // boolean needs to be removed later
let delta_Angle = null;
let compass = 0;
const target_Long = -1.5401977068857935;
const target_Lat = 47.214438493730896;
const angle_Threshold = 20; // To be changed later, maybe even based on the camera of the device
var bearing_Device_Target = 0; // Angles declared as globals for now
const isIOS = // different handlings, IOS is not tested yet
    navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
    navigator.userAgent.match(/AppleWebKit/);

// Variables for AR
let object_Placed = 0;
let visual_Display = document.getElementById("visual_Display"); // Div that the user sees in overlay
let renderer = null;
let scene = null;
let camera = null;
let mixer = null;
let reticle = null; // Circle that the user sees when we may place an object (plane detection)
let geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0); // Object placed "onTouch"
let lastFrame = Date.now();
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
    navigator.geolocation.watchPosition(handler_Location);
    if (!isIOS) {
    // if not on IOS, we add this listener to handle Orientation
        window.addEventListener("deviceorientationabsolute", handler_Orientation, true);
    }
}

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
        is_Fullscreen_Active = true;
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
    xrSession = session;
    xrButton.innerHTML = 'Exit AR';

    // Show which type of DOM Overlay got enabled (if any)
    if (session.domOverlayState) {
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
    is_Fullscreen_Active = false;
    visual_Display.innerHTML = ``;
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
    compass = e.webkitCompassHeading || Math.abs(e.alpha - 360); // not always defined otherwise
    delta_Angle = bearing_Device_Target - compass;
    console.log(`alpha : ${e.alpha}`);
    console.log(`compass : ${compass}`);
    handler_Display();
}

// Handles location sensor
function handler_Location(position) {
    bearing_Device_Target = bearing(
        position.coords.latitude,
        position.coords.longitude,
        target_Lat,
        target_Long
    );
    distance_Device_Target = calcCrow(
        position.coords.latitude,
        position.coords.longitude,
        target_Lat,
        target_Long
    );
    visual_Display.innerHTML = `you are ${distance_Device_Target.toFixed(3)} km away from target (let's say that if user is too far from any target, we don't enter AR mode)`;
}

// Handles overlay display
// temporarily handles object placement, to be removed
function handler_Display() {
    var abs_Delta_Angle = ((delta_Angle % 360) + 360) % 360; //Js % is not mod (see doc for more info)
    var min_Angle = Math.min(360 - abs_Delta_Angle, abs_Delta_Angle);
    if (is_Fullscreen_Active==true) {
        if (min_Angle<angle_Threshold){
            if (reticle.visible && object_Placed<1) {
                object_Placed = object_Placed + 1;
                const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.setFromMatrixPosition(reticle.matrix);
                mesh.scale.y = Math.random() * 2 + 1;
                scene.add(mesh);
            }
        }
        get_Overlay_Message(abs_Delta_Angle, min_Angle);
    }
}

function get_Overlay_Message(abs_Delta_Angle, min_Angle) {
    var overlay_Distance = ``;
    var overlay_Orientation_Angle = ``;
    var orientation_Direction = abs_Delta_Angle > 180 ? `left` : `right`;
    if (distance_Device_Target > minimal_Display_Distance) {
        // notifying the user that he is too far from the object
        overlay_Distance = `You have to get closer (${(distance_Device_Target - minimal_Display_Distance).toFixed(3)}km) \n`;
    }
    else {
        overlay_Distance = `You are close enough ! \n`;
        if (abs_Delta_Angle < angle_Threshold){
            overlay_Orientation_Angle = `You should be able to see the object !`;
        }
        else{
            overlay_Orientation_Angle = `Try to reduce the angle : ${min_Angle.toFixed(0)} \n by rotating `;
        }
    }
    // Adding direction only if it's needed
    overlay_Orientation_Angle = min_Angle < angle_Threshold ? overlay_Orientation_Angle : overlay_Orientation_Angle.concat(orientation_Direction);
    visual_Display.innerHTML = distance_Device_Target < minimal_Display_Distance ? 
        overlay_Distance.concat(overlay_Orientation_Angle) : overlay_Distance;
    visual_Display.innerHTML = visual_Display.innerHTML + `\n Also : ${abs_Delta_Angle.toFixed(0)}`;      
    return;
}

/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///
/// ///   AUXILIARIES   /// ///
/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(startLat, startLng, destLat, destLng) 
{
    var R = 6371; // km
    var dLat = toRadians(destLat - startLat);
    var dLon = toRadians(destLng - startLng);
    var startLat = toRadians(startLat);
    var destLat = toRadians(destLat);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon/2) * Math.cos(startLat) * Math.cos(destLat); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
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
    const y = Math.sin(destLng - startLng) * Math.cos(destLat);
    const x = Math.cos(startLat) * Math.sin(destLat) -
          Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    var bearing_ = Math.atan2(y, x);
    bearing_ = toDegrees(bearing_);
    return (((bearing_ % 360) + 360) % 360);
}