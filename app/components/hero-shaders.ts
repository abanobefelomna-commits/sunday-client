// GLSL sources for the autonomous hero particle artwork.

export const SIM_VS = `#version 300 es
layout(location = 0) in vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const SIM_FS = `#version 300 es
precision highp float;

uniform sampler2D uState;
uniform sampler2D uSeeds;
uniform float uTime;
uniform float uDt;
uniform float uMix;
uniform float uTurbulence;
uniform float uSwirl;
uniform vec2 uSpread;
uniform int uShapeA;
uniform int uShapeB;

out vec4 outState;

const float TAU = 6.283185307179586;
const float PI = 3.141592653589793;

vec2 shapeNebula(vec4 s, float t) {
    float ang = s.x * TAU + t * 0.02;
    float rad = pow(s.y, 0.62) * 0.9;
    vec2 p = vec2(cos(ang), sin(ang)) * rad;
    p *= vec2(1.12, 0.74);
    p += 0.09 * vec2(
        sin(t * 0.31 + s.z * TAU),
        cos(t * 0.27 + s.w * TAU)
    );
    return p;
}

vec2 shapeGalaxy(vec4 s, float t) {
    float arms = 4.0;
    float r = pow(s.y, 0.68) * 0.92;
    float arm = floor(s.z * arms);
    float jitter = (s.w - 0.5) * 0.55;
    float ang = arm * (TAU / arms) + r * 3.1 + t * 0.1 + jitter;
    float bev = (s.w - 0.5) * 0.12 * (0.35 + 0.65 * r);
    vec2 p = vec2(cos(ang) * r, sin(ang) * r * 0.6);
    p += vec2(-sin(ang), cos(ang) * 0.6) * bev;
    p += (vec2(s.x, s.z) - 0.5) * 0.035 * (1.0 - r);
    return p * vec2(1.18, 1.0);
}

vec2 shapeRibbon(vec4 s, float t) {
    float u = (s.x - 0.5) * 1.9;
    float v = s.y - 0.5;
    float y = sin(u * 2.4 + t * 0.55) * 0.18
            + sin(u * 1.2 - t * 0.35 + v * 3.2) * 0.1
            + v * 0.62 * (0.85 + 0.15 * sin(u * 1.7 + t * 0.3))
            + (s.z - 0.5) * 0.13;
    float x = u + sin(v * 2.0 + t * 0.3) * 0.06 + (s.w - 0.5) * 0.05;
    return vec2(x, y * 0.9);
}

vec2 shapeHelix(vec4 s, float t) {
    float u = (s.x - 0.5) * 1.7;
    float strand = step(0.5, s.y);
    float ang = u * 3.0 + t * 0.5 + strand * PI;
    float rad = 0.34 + 0.05 * sin(u * 5.0 - t * 0.4);
    vec2 p = vec2(u, cos(ang) * rad);
    p.y += (s.z - 0.5) * 0.07;
    p.x += sin(t * 0.22) * 0.06;
    return p;
}

vec2 shapeTorus(vec4 s, float t) {
    float a = s.x * TAU + t * 0.12;
    float b = s.y * TAU - t * 0.18;
    float R = 0.6;
    float r = 0.19 * (0.6 + 0.8 * s.z);
    float x = (R + r * cos(b)) * cos(a);
    float y = (R + r * cos(b)) * sin(a);
    vec2 p = vec2(x, y * 0.72);
    p += 0.02 * vec2(sin(b * 2.0 + t), cos(a * 3.0 - t));
    return p * 1.05;
}

vec2 shapeShell(vec4 s, float t) {
    float y = 1.0 - 2.0 * fract(s.x * 1.618 + s.z * 0.37);
    float rr = sqrt(max(0.0, 1.0 - y * y));
    float phi = s.y * TAU + t * 0.14 + s.w * 0.8;
    vec3 p = vec3(cos(phi) * rr, y, sin(phi) * rr);
    float ca = cos(t * 0.18);
    float sa = sin(t * 0.18);
    p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    return vec2(p.x, p.y * 0.92) * 0.84;
}

vec2 shapeMobius(vec4 s, float t) {
    float u = s.x * TAU + t * 0.16;
    float v = (s.y - 0.5) * 0.62;
    float rr = 1.0 + v * cos(u * 0.5);
    vec2 p = vec2(rr * cos(u), rr * sin(u)) * 0.62;
    p.y *= 0.95;
    return p;
}

vec2 shapeRings(vec4 s, float t) {
    float ring = 0.22 + s.x * 0.62;
    float dir = mod(floor(s.z * 5.0), 2.0) * 2.0 - 1.0;
    float ang = s.y * TAU + t * (0.42 - ring * 0.24) * dir;
    vec2 p = vec2(cos(ang) * ring * 1.28, sin(ang) * ring * 0.72);
    p += (s.w - 0.5) * 0.03;
    return p;
}

vec2 shape(int id, vec4 s, float t) {
    if (id == 1) return shapeGalaxy(s, t);
    if (id == 2) return shapeRibbon(s, t);
    if (id == 3) return shapeHelix(s, t);
    if (id == 4) return shapeTorus(s, t);
    if (id == 5) return shapeShell(s, t);
    if (id == 6) return shapeMobius(s, t);
    if (id == 7) return shapeRings(s, t);
    return shapeNebula(s, t);
}

vec2 flowField(vec2 p, float t) {
    float a = sin(p.y * 2.2 + t * 0.55);
    float b = cos(p.x * 1.9 - t * 0.42);
    float c = sin((p.x + p.y) * 3.3 + t * 0.27);
    float d = cos((p.x - p.y) * 2.8 - t * 0.33);
    return vec2(a + 0.45 * c, b + 0.45 * d);
}

void main() {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(uState, 0));
    vec4 st = texture(uState, uv);
    vec4 seed = texture(uSeeds, uv);

    vec2 pos = st.xy;
    vec2 prev = st.zw;

    vec2 target = mix(shape(uShapeA, seed, uTime), shape(uShapeB, seed, uTime), uMix) * uSpread;
    vec2 acc = (target - pos) * 12.0;

    float radius = length(pos) + 0.0001;
    vec2 tangent = vec2(-pos.y, pos.x) / radius;
    acc += tangent * uSwirl * (0.9 + seed.z * 1.4) / (1.0 + radius * 1.6);

    acc += flowField(pos * 1.3 + seed.xy * 0.7, uTime) * uTurbulence;
    acc += normalize(pos + vec2(0.0001)) * sin(uTime * 0.8 + seed.w * TAU) * uTurbulence * 0.22;

    float dt = clamp(uDt, 0.001, 0.033);
    vec2 vel = (pos - prev) * 0.9;
    float speed = length(vel);
    if (speed > 0.085) vel *= 0.085 / speed;

    vec2 nextPos = pos + vel + acc * dt * dt;
    float len = length(nextPos);
    if (len > 1.45) nextPos *= 1.45 / len;

    outState = vec4(nextPos, pos);
}
`;

export const FADE_FS = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uFade;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    outColor = texture(uTexture, uv) * uFade;
}
`;

export const PARTICLE_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aUv;

uniform sampler2D uState;
uniform sampler2D uSeeds;
uniform float uTime;
uniform float uPixelScale;

out vec2 vSeed;
out float vDepth;
out float vSpeed;
out float vCenter;

void main() {
    vec4 st = texture(uState, aUv);
    vec4 seed = texture(uSeeds, aUv);
    vec2 pos = st.xy;
    vec2 vel = pos - st.zw;

    float depth = 0.5 + 0.5 * sin(seed.z * 6.2831 + uTime * 0.5 + dot(pos, vec2(1.9, 2.7)) * 1.5);
    vSeed = seed.xy;
    vDepth = depth;
    vSpeed = length(vel);
    vCenter = smoothstep(0.14, 0.72, length(pos));

    gl_Position = vec4(pos, 0.0, 1.0);
    float size = mix(1.0, 4.4, depth) * (1.0 + min(vSpeed * 16.0, 1.2));
    gl_PointSize = clamp(size * uPixelScale * 1.15, 1.0, 24.0);
}
`;

export const PARTICLE_FS = `#version 300 es
precision highp float;

in vec2 vSeed;
in float vDepth;
in float vSpeed;
in float vCenter;

uniform float uIntensity;
out vec4 outColor;

void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = dot(q, q) * 4.0;
    if (d > 1.0) discard;

    float core = exp(-d * 7.0);
    float halo = exp(-d * 2.2) * 0.62;
    float energy = core + halo;

    float hue = fract(vSeed.x * 1.31 + vSeed.y * 0.73 + vSeed.x * vSeed.y * 0.9);
    vec3 col = mix(vec3(0.30, 0.88, 1.0), vec3(0.15, 0.48, 1.0), smoothstep(0.0, 0.34, hue));
    col = mix(col, vec3(0.34, 0.40, 1.0), smoothstep(0.34, 0.66, hue));
    col = mix(col, vec3(0.66, 0.47, 1.0), smoothstep(0.66, 1.0, hue));
    col = mix(col, vec3(0.88, 0.96, 1.0), core * 0.28);

    float bright = mix(0.45, 1.25, vDepth) * uIntensity;
    float alpha = clamp(energy * bright * 0.09, 0.0, 0.3);
    alpha *= mix(0.48, 1.0, vCenter);

    outColor = vec4(col * alpha, alpha * 0.3);
}
`;

export const STAR_VS = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uPixelScale;

out float vAlpha;
out vec3 vColor;

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

void main() {
    float id = float(gl_VertexID) + 1.0;
    float x = hash11(id * 1.13) * 2.0 - 1.0;
    float y = hash11(id * 2.71 + 5.0) * 2.0 - 1.0;
    float phase = hash11(id * 3.7) * 6.2831;
    float speed = 0.35 + hash11(id * 4.3) * 1.1;
    float twinkle = 0.55 + 0.45 * sin(uTime * speed + phase);

    vAlpha = (0.25 + 0.75 * hash11(id * 7.9)) * twinkle;
    vColor = mix(vec3(0.55, 0.72, 1.0), vec3(0.84, 0.9, 1.0), hash11(id * 9.1));

    gl_Position = vec4(x, y, 0.0, 1.0);
    gl_PointSize = (1.0 + hash11(id * 6.3) * 2.2) * uPixelScale;
}
`;

export const STAR_FS = `#version 300 es
precision highp float;

in float vAlpha;
in vec3 vColor;

uniform float uIntensity;
out vec4 outColor;

void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = dot(q, q) * 4.0;
    if (d > 1.0) discard;
    float a = (1.0 - d) * vAlpha * uIntensity;
    outColor = vec4(vColor * a, a);
}
`;

export const BLIT_FS = `#version 300 es
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec4 c = texture(uTexture, uv);
    vec3 col = 1.0 - exp(-max(c.rgb, 0.0) * 1.35);
    float a = max(col.r, max(col.g, col.b));
    outColor = vec4(col, a);
}
`;
