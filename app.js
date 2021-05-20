const log = console.log;
const target_Long = 2.295284992068256;
const target_Lat = 48.87397517044594;

/// VIDEO STREAM PART ///

// Set constraints for the video stream
var constraints = {
    audio: false,
    video: {
        mandatory: {
            minWidth: 0,
            minHeight: 0,
            maxWidth: window.screen.width/2,
            maxHeight: window.screen.height/2,
            facingMode: {exact: environment}
            }
    }
};
const cameraView = document.querySelector("#camera--view"),
    cameraOutput = document.querySelector("#camera--output"),
    cameraSensor = document.querySelector("#camera--sensor"),
    cameraTrigger = document.querySelector("#camera--trigger")// Access the device camera and stream to cameraView
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

/// /// ///

window.addEventListener("load", cameraStart, false); // camera loading event

/// GEOLOCATION EVENT ///

window.onload = () => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(function (position) {
        // Managing logging on the left of the screen
        var displayed_Logs_Geo = document.getElementById('logs_Geoloc');
        var bearing_Device_Target = bearing(
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
      });
    }
};

/// ORIENTATION ///

if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', update, true);
    function update(event){
        var displayed_Logs_Orientation = document.getElementById('logs_Orientation');
        console.log(event);
        // Angles are in degrees right now
        var absolute = event.absolute;
        var alpha = event.alpha;
        var beta = event.beta;
        var gamma = event.gamma;
        var compass_Heading = compassHeading(alpha, beta, gamma);
        console.log("inside orientation handler");
        displayed_Logs_Orientation.innerHTML = `The compass angle is : ${compass_Heading}
        and alpha is : ${alpha}`;
    }
  } else {
    console.log('device orientation not supported');
  }

/// /// AUXILIARIES /// ///

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(lat1, lon1, lat2, lon2) 
{
    var R = 6371; // km
    var dLat = toRadians(lat2-lat1);
    var dLon = toRadians(lon2-lon1);
    var lat1 = toRadians(lat1);
    var lat2 = toRadians(lat2);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
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
  
// Bearing formula, bewteen two 2D points, clockwise angle between north and (start,dest)
function bearing(startLat, startLng, destLat, destLng){
    startLat = toRadians(startLat);
    startLng = toRadians(startLng);
    destLat = toRadians(destLat);
    destLng = toRadians(destLng);
    y = Math.sin(destLng - startLng) * Math.cos(destLat);
    x = Math.cos(startLat) * Math.sin(destLat) -
          Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    brng = Math.atan2(y, x);
    brng = toDegrees(brng);
    return (brng + 360) % 360;
}

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