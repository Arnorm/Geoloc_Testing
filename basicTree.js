// Module is directly included in the project, we might want to change this
import * as THREE from './threeJs/build/three.module.js';
import {target_Long, target_Lat, angle_Treshold, is_IOS, xr_Button, info} from './const.js';
import {calc_Crow_Distance, bearing} from './auxiliaries.js';

// Variables for sensors
let is_Fullscreen_Active = false; // boolean needs to be removed later
let compass = 0;
var bearing_Device_Target = 0; // Angles declared as globals for now

// Variables for AR
let object_Placed = 0;
let visual_Debug = document.getElementById("visual_Debug"); // Div that the user sees in overlay
let renderer = null;
let scene = null;
let camera = null;
let mixer = null;
let reticle = null; // Circle that the user sees when we may place an object (plane detection)
let geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(0, 0.1, 0); // Object placed "onTouch"
let last_Frame = Date.now();
let xr_Session = null;
// reference space used within an application https://developer.mozilla.org/en-US/docs/Web/API/xr_Session/requestReferenceSpace
let xr_Ref_Space = null;
// for hit testing with detected surfaces
let xr_Hit_Test_Source = null;
// Canvas OpenGL context used for rendering
let gl = null;

const init_Scene = (gl, session) => {
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
    if (!is_IOS) {
    // if not on IOS, we add this listener to handle Orientation
        window.addEventListener("deviceorientationabsolute", handler_Orientation, true);
    }
}

function check_XR() {
    if (!window.isSecureContext) {
        document.getElementById("warning").innerText = "WebXR unavailable. Please use secure context";
    }
    if (navigator.xr) {
        navigator.xr.addEventListener('devicechange', check_Supported_State);
        check_Supported_State();
    } else {
        document.getElementById("warning").innerText = "WebXR unavailable for this browser"; 
    }
}

function check_Supported_State() {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        if (supported) {
        // calling init_Sensors to get informations
        // Need to call them before fullscreen for permission to be seen by user
        init_Sensors();
        xr_Button.innerHTML = 'Enter AR';
        xr_Button.addEventListener('click', on_Button_Clicked);
        } else {
        xr_Button.innerHTML = 'AR not found';
        }
        xr_Button.disabled = !supported;
    });
}

function on_Button_Clicked() {
    if (!xr_Session) {
        is_Fullscreen_Active = true;
        console.log("we just enterd button click");
        navigator.xr.requestSession('immersive-ar', {
            optionalFeatures: ['dom-overlay'],
            requiredFeatures: ['local', 'hit-test'],
            domOverlay: {root: document.getElementById('overlay')}
        }).then(on_Session_Started, on_Request_Session_Error);
    } else {
        xr_Session.end();
    }
}

function on_Session_Started(session) {
    xr_Session = session;
    xr_Button.innerHTML = 'Exit AR';

    // Show which type of DOM Overlay got enabled (if any)
    if (session.domOverlayState) {
        info.innerHTML = 'DOM Overlay type: ' + session.domOverlayState.type;
    }

    // create a canvas element and WebGL context for rendering
    session.addEventListener('end', on_Session_Ended);
    let canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', { xrCompatible: true });
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    // here we ask for viewer reference space, since we will be casting a ray
    // from a viewer towards a detected surface. The results of ray and surface intersection
    // will be obtained via xr_Hit_Test_Source variable
    session.requestReferenceSpace('viewer').then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((hitTestSource) => {
        xr_Hit_Test_Source = hitTestSource;
        });
    });

    session.requestReferenceSpace('local').then((refSpace) => {
        xr_Ref_Space = refSpace;
        session.requestAnimationFrame(on_XR_Frame);
    });

    document.getElementById("overlay").addEventListener('click', place_Object);

    // initialize three.js scene
    init_Scene(gl, session);
}

function on_Request_Session_Error(ex) {
    info.innerHTML = "Failed to start AR session.";
    console.error(ex.message);
}

function on_Session_Ended(event) {
    is_Fullscreen_Active = false;
    visual_Debug.innerHTML = ``;
    xr_Session = null;
    xr_Button.innerHTML = 'Enter AR';
    info.innerHTML = '';
    gl = null;
    if (xr_Hit_Test_Source) xr_Hit_Test_Source.cancel();
    xr_Hit_Test_Source = null;
}

function place_Object() {
    if (reticle.visible) {
        const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.setFromMatrixPosition(reticle.matrix);
        mesh.scale.y = Math.random() * 2 + 1;
        scene.add(mesh);
    }
}

// Utility function to update animated objects
function update_Animation() {
    let dt = (Date.now() - last_Frame) / 1000;
    last_Frame = Date.now();
    if (mixer) {
        mixer.update(dt);
    }  
}

function on_XR_Frame(t, frame) {
    let session = frame.session;
    session.requestAnimationFrame(on_XR_Frame);

    if (xr_Hit_Test_Source) {
        // obtain hit test results by casting a ray from the center of device screen
        // into AR view. Results indicate that ray intersected with one or more detected surfaces
        const hitTestResults = frame.getHitTestResults(xr_Hit_Test_Source);
        if (hitTestResults.length) {
        // obtain a local pose at the intersection point
        const pose = hitTestResults[0].getPose(xr_Ref_Space);
        // place a reticle at the intersection point
        reticle.matrix.fromArray(pose.transform.matrix);
        reticle.visible = true;
        }
    } else {  // do not show a reticle if no surfaces are intersected
        reticle.visible = false;
    }

    // update object animation
    update_Animation();
    // bind our gl context that was created with WebXR to threejs renderer
    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
    // render the scene
    renderer.render(scene, camera);
}

/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///
/// /// SENSORS /// /// /// ///
/// /// /// /// /// /// /// ///
/// /// /// /// /// /// /// ///

// Only for IOS, not tested YET
function start_Compass() {
    if (is_IOS) {
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
    var distance_Device_Target = calc_Crow_Distance(
        position.coords.latitude,
        position.coords.longitude,
        target_Lat,
        target_Long
    );
    visual_Debug.innerHTML = `you are ${distance_Device_Target.toFixed(1)} km away from target (let's say that if user is too far from any target, we don't enter AR mode)`;
}

// Handles overlay display
// temporarly handles object placement, to be removed
function handler_Display(delta_Angle) {
    var abs_Delta_Angle = ((delta_Angle % 360) + 360) % 360; //Js % is not mod (see doc for more info)
    var min_Angle = Math.min(360 - abs_Delta_Angle, abs_Delta_Angle);
    if (is_Fullscreen_Active==true) {
        if(min_Angle<angle_Treshold){
            if (reticle.visible && object_Placed<1) {
                object_Placed = object_Placed + 1;
                const material = new THREE.MeshPhongMaterial({color: 0xffffff * Math.random()});
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.setFromMatrixPosition(reticle.matrix);
                mesh.scale.y = Math.random() * 2 + 1;
                scene.add(mesh);
            }
            if (object_Placed<1) {
                visual_Debug.innerHTML = `Please move the reticle to a plane surface so that the object can be rendered !`;
            }
            visual_Debug.innerHTML = `You found it ! Congratulations`;
        }
        else{
            visual_Debug.innerHTML = `Try to reduce the angle : ${min_Angle.toFixed(0)}`;
        }
    }
}

// triggers everything
check_XR();