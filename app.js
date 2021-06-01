// File that will handle every operation related to geolocation and display

// Importing ThreeJs which handles the VR part
import * as THREE from './threeJs/build/three.module.js';
const scene = new THREE.Scene();
const logs_Mobile = document.getElementById('logs_Mobile');
logs_Mobile.innerHTML = `ThreeJs Importedd.`;
/// ///

// Variables //
const log = console.log;
const target_Long = 2.295284992068256;
const target_Lat = 48.87397517044594;
const angle_Treshold = 30; // To be changed later, maybe even based on the camera of the device
const displayed_Logs_Orientation = document.getElementById('logs_Orientation');
var displayed_Logs_Geo = document.getElementById('logs_Geoloc');
const visualisation_Target = document.getElementById('visualisation_Target');
var bearing_Device_Target = 0; // Angles declared as globals for now
var constraints = {
    audio: false,
    video: {
        facingMode: {
          exact: "environment" // remove this one if tested in a laptop because it require rear camera
        }
    }
};
const cameraView = document.querySelector("#camera--view"),
    cameraOutput = document.querySelector("#camera--output"),
    cameraSensor = document.querySelector("#camera--sensor"),
    cameraTrigger = document.querySelector("#camera--trigger")// Access the device camera and stream to cameraView

const isIOS = // different handlings
    navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
    navigator.userAgent.match(/AppleWebKit/);

window.addEventListener("load", cameraStart, false); // camera loading event

// Handling the video flux, triggered by "load" event
function cameraStart() {
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function(stream) {
        track = stream.getTracks()[0];
        cameraView.srcObject = stream;
    })
    .catch(function(error) {
        console.error("Oops. Something is broken.", error);
    });
}

function init() {
    navigator.geolocation.watchPosition(handler_Location);
    if (!isIOS) {
    // if not on IOS, we add this listener to handle Orientation
        window.addEventListener("deviceorientationabsolute", handler_Orientation, true);
    }
}

// Need to activate compass sensor on device to get orientation on IOS
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

function handler_Orientation(e) {
    compass = e.webkitCompassHeading || Math.abs(e.alpha - 360); // not always defined otherwise
    var delta_Angle = bearing_Device_Target - compass;
    displayed_Logs_Orientation.innerHTML = `Delta angle is : ${delta_Angle.toFixed(1)}, we are in orientation still`;
    handler_Display(delta_Angle);
}

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
    console.log("inside geoloc loop");
    displayed_Logs_Geo.innerHTML = `longitude:${position.coords.longitude}; 
        latitude:${position.coords.latitude};
        and you are ${distance_Device_Target} km away from target.
        Also, bearing is : ${bearing_Device_Target}`;
}

// This function aims at handling the display
// Arguments are to be added later (eventually, relative angle will be useful)
function handler_Display(delta_Angle) {
    var abs_Delta_Angle = ((delta_Angle % 360) + 360) % 360; //Js % is not mod (see doc for more info)
    var min_Angle = Math.min(360 - abs_Delta_Angle, abs_Delta_Angle);
    if(min_Angle<angle_Treshold){
        visualisation_Target.innerHTML = `Min angle is : ${min_Angle.toFixed(1)}.
         Here we are within the cone (limit angle being : ${angle_Treshold}) 
        so we may Display some information about the object, like size, color, picture ...`;
    }
    else{
        visualisation_Target.innerHTML = `Min angle is : ${min_Angle.toFixed(1)}.`;
    }
}

init();

/// /// AUXILIARIES /// ///

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