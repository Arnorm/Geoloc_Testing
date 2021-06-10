// This file will contain globals of the app

// Variables for sensors
const target_Long = 2.295284992068256;
const target_Lat = 48.87397517044594;
const angle_Treshold = 20; 
const is_IOS = 
    navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
    navigator.userAgent.match(/AppleWebKit/);
// button to start XR experience
const xr_Button = document.getElementById('xr-button');
// to display debug information
const info = document.getElementById('info');

export {target_Long, target_Lat, angle_Treshold, is_IOS, xr_Button, info};
