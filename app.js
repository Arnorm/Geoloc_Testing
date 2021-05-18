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
        var displayed_Logs = document.getElementById('logs');
        var distance_Device_Target = calcCrow(
            position.coords.latitude,
            position.coords.longitude,
            target_Lat,
            target_Long);
        console.log("inside geoloc loop");
        displayed_Logs.innerHTML = `longitude:${position.coords.longitude}; 
            latitude:${position.coords.latitude};
            and you are ${distance_Device_Target} km away from target.`;
        /* window.onorientationchange = function(event) {
            console.log("in orientation function");
            console.log("the orientation of the device is now " + event.target.screen.orientation.angle);
            displayed_Logs.innerHTML = `longitude:${position.coords.longitude}; 
            latitude:${position.coords.latitude};
            and you are ${distance_Device_Target} km away from target. 
            Also, orientation is ${event.target.screen.orientation.angle}`;
        };
        */
      });
    }
};

/// /// AUXILIARIES /// ///

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(lat1, lon1, lat2, lon2) 
{
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}
// Converts numeric degrees to radians
function toRad(Value) 
{
    return Value * Math.PI / 180;
}