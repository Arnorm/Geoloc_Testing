// File that contains auxiliary functions

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calc_Crow_Distance(start_Lat, start_Long, dest_Lat, dest_Long) 
{
    var R = 6371; // km
    var delta_Lat = to_Radians(dest_Lat-start_Lat);
    var delta_Long = to_Radians(dest_Long-start_Long);
    var start_Lat = to_Radians(start_Lat);
    var dest_Lat = to_Radians(dest_Lat);
    var a = Math.sin(delta_Lat/2) * Math.sin(delta_Lat/2) +
        Math.sin(delta_Long/2) * Math.sin(delta_Long/2) * Math.cos(start_Lat) * Math.cos(dest_Lat); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

// Converts from degrees to radians.
function to_Radians(degrees) {
    return degrees * Math.PI / 180;
  };
   
// Converts from radians to degrees.
function to_Degrees(radians) {
    return radians * 180 / Math.PI;
}
  
// Bearing formula, between two 2D points, clockwise angle between north and (start,dest)
function bearing(start_Lat, start_Long, dest_Lat, dest_Long){
    start_Lat = to_Radians(start_Lat);
    start_Long = to_Radians(start_Long);
    dest_Lat = to_Radians(dest_Lat);
    dest_Long = to_Radians(dest_Long);
    const y = Math.sin(dest_Long - start_Long) * Math.cos(dest_Lat);
    const x = Math.cos(start_Lat) * Math.sin(dest_Lat) -
          Math.sin(start_Lat) * Math.cos(dest_Lat) * Math.cos(dest_Long - start_Long);
    var bearing_ = Math.atan2(y, x);
    bearing_ = to_Degrees(bearing_);
    return (bearing_ + 360) % 360;
}

// Compass heading (not used at the moment)
function compass_Heading(alpha, beta, gamma) {
    // Convert degrees to radians
    var alpha_Rad = alpha * (Math.PI / 180);
    var beta_Rad = beta * (Math.PI / 180);
    var gamma_Rad = gamma * (Math.PI / 180);
    // Calculate equation components
    var cA = Math.cos(alpha_Rad);
    var sA = Math.sin(alpha_Rad);
    var cB = Math.cos(beta_Rad);
    var sB = Math.sin(beta_Rad);
    var cG = Math.cos(gamma_Rad);
    var sG = Math.sin(gamma_Rad);
    // Calculate A, B, C rotation components
    var rA = - cA * sG - sA * sB * cG;
    var rB = - sA * sG + cA * sB * cG;
    //var rC = - cB * cG;
    // Calculate compass heading
    var compass_Heading = Math.atan(rA / rB);
    // Convert from half unit circle to whole unit circle
    if(rB < 0) {
      compass_Heading += Math.PI;
    }else if(rA < 0) {
      compass_Heading += 2 * Math.PI;
    }
    // Convert radians to degrees
    compass_Heading *= 180 / Math.PI;
    return compass_Heading;
}

export {calc_Crow_Distance, to_Radians, to_Degrees, bearing,compass_Heading};