/**
 * 2D Vector class for simulation math.
 */
class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    clone() { return new Vec2(this.x, this.y); }

    set(x, y) { this.x = x; this.y = y; return this; }

    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }

    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }

    scale(s) { return new Vec2(this.x * s, this.y * s); }

    dot(v) { return this.x * v.x + this.y * v.y; }

    cross(v) { return this.x * v.y - this.y * v.x; }

    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }

    lengthSq() { return this.x * this.x + this.y * this.y; }

    normalize() {
        const len = this.length();
        if (len < 1e-10) return new Vec2(0, 0);
        return new Vec2(this.x / len, this.y / len);
    }

    rotate(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
    }

    distTo(v) { return this.sub(v).length(); }

    lerp(v, t) { return this.add(v.sub(this).scale(t)); }

    angle() { return Math.atan2(this.y, this.x); }

    perp() { return new Vec2(-this.y, this.x); }

    negate() { return new Vec2(-this.x, -this.y); }

    truncate(maxLen) {
        const len = this.length();
        if (len > maxLen) return this.scale(maxLen / len);
        return this.clone();
    }

    static fromAngle(angle, length = 1) {
        return new Vec2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    static zero() { return new Vec2(0, 0); }
}
