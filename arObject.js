// arObject class

export class Position {
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

export class ArObject {
    constructor(position, name, text) {
        this.position = position;
        this.name = name;
        this.text = text;
    }

    // setters
    set position(_position) {
        this.position = _position;
    }
    set name(_name) {
        this.name = _name;
    }
    set text(_text) {
        this.text = _text;
    }

    // getters
    get position() {
        return this.position;
    }
    get name() {
        return this.name;
    }
    get text() {
        return this.text;
    }
}