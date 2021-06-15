// Position class

export default class Position {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }

    // setters 
    set lat(_lat) {
        this.lat = lat;
    }

    set lng(_lng) {
        this.lng = _lng
    }

    // getters 
    get lat() {
        return this.lat;
    }
    get lng() {
        return this.lng;
    }
}