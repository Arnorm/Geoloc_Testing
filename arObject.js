// arObject class

export class Position {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
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