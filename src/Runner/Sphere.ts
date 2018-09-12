export enum Type {
    SWEET = 1,
    COOL = 2,
    POP = 3,
}

export class Sphere {
    type: Type;

    constructor(type: Type) {
        this.type = type;
    }

    get strongerType(): Type {
        switch (this.type) {
        case Type.SWEET:
            return Type.POP;
        case Type.COOL:
            return Type.SWEET;
        case Type.POP:
            return Type.COOL;
        }
    }
}
