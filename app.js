const log = console.log;

// Set constraints for the video stream
var constraints = {
    audio: false,
    video: {
        mandatory: {
            minWidth: 0,
            minHeight: 0,
            maxWidth: window.screen.width/2,
            maxHeight: window.screen.height/2,
            facingMode: "environment" }
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
}// Take a picture when cameraTrigger is tapped
cameraTrigger.onclick = function() {
    cameraSensor.width = cameraView.videoWidth;
    cameraSensor.height = cameraView.videoHeight;
    cameraSensor.getContext("2d").drawImage(cameraView, 0, 0);
    cameraOutput.src = cameraSensor.toDataURL("image/webp");
    cameraOutput.classList.add("taken");
};// Start the video stream when the window loads
window.addEventListener("load", cameraStart, false);

  window.onload = () => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(function (position) {
        // Managing logging on the left of the screen
        var displayed_Logs = document.getElementById('logs');
        displayed_Logs.innerHTML = `longitude:${position.coords.longitude}; 
        latitude:${position.coords.latitude}`;
        // Managing form pre-filling with gps coordinates
        var lat = document.getElementById('lat');
        var long = document.getElementById('long');
        lat.value=position.coords.latitude;
        long.value=position.coords.longitude;
      });
    }
};