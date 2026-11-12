"use client";

import { useEffect, useRef } from "react";
import {
  BLIT_FS,
  FADE_FS,
  PARTICLE_FS,
  PARTICLE_VS,
  SIM_FS,
  SIM_VS,
  STAR_FS,
  STAR_VS,
} from "./hero-shaders";

// =============================================================================
// Autonomous particle choreography for the hero section.
//
// A WebGL2 GPGPU simulation stores (position, previousPosition) in a float
// texture. Within each particle the previous position provides Verlet inertia,
// so the mass of tens of thousands of particles glides between sculpted
// formations: nebula, spiral galaxy, ribbon, double helix, torus, orbital
// shell, Möbius strip and concentric orbits. A curl-like flow field, a central
// swirl and spring attraction keep the composition breathing. An accumulation
// buffer adds soft glow and motion trails.
//
// Everything is driven by elapsed time only — there is no pointer input.
// =============================================================================

const ACT_DURATION = 9;
const TRANSITION = 3.4;
const ACT_COUNT = 8;
const ACT_SWIRL = [0.25, 0.8, 0.35, 0.3, 0.55, 0.4, 0.65, 0.95];
const ACT_TURB = [0.22, 0.5, 0.75, 0.3, 0.45, 0.5, 0.6, 0.55];
const TAU = Math.PI * 2;

type FboTarget = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Hero shader compile error: ${log ?? "unknown"}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Hero program link error: ${log ?? "unknown"}`);
  }
  return program;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createHeroScene(canvas: HTMLCanvasElement): (() => void) | null {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  if (!gl.getExtension("EXT_color_buffer_float")) return null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = window.innerWidth < 820 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const SIM_SIZE = compact ? 192 : 256;
  const COUNT = SIM_SIZE * SIM_SIZE;
  const STAR_COUNT = compact ? 260 : 460;

  // ---------------------------------------------------------------- geometry
  const quadVao = gl.createVertexArray();
  const quadBuffer = gl.createBuffer();
  if (!quadVao || !quadBuffer) return null;
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const seedData = new Float32Array(COUNT * 4);
  const stateData = new Float32Array(COUNT * 4);
  const uvData = new Float32Array(COUNT * 2);

  for (let i = 0; i < COUNT; i++) {
    const sx = Math.random();
    const sy = Math.random();
    const sz = Math.random();
    const sw = Math.random();
    seedData[i * 4] = sx;
    seedData[i * 4 + 1] = sy;
    seedData[i * 4 + 2] = sz;
    seedData[i * 4 + 3] = sw;

    let x: number;
    let y: number;
    if (reducedMotion) {
      const r = Math.pow(sy, 0.68) * 0.92;
      const arm = Math.floor(sz * 4);
      const angle = arm * (TAU / 4) + r * 3.1 + (sw - 0.5) * 0.55;
      x = Math.cos(angle) * r * 1.18;
      y = Math.sin(angle) * r * 0.6;
    } else {
      const angle = sx * TAU;
      const radius = Math.pow(sy, 0.62) * 0.9;
      x = Math.cos(angle) * radius * 1.12;
      y = Math.sin(angle) * radius * 0.74;
    }
    stateData[i * 4] = x;
    stateData[i * 4 + 1] = y;
    stateData[i * 4 + 2] = x;
    stateData[i * 4 + 3] = y;

    uvData[i * 2] = ((i % SIM_SIZE) + 0.5) / SIM_SIZE;
    uvData[i * 2 + 1] = (Math.floor(i / SIM_SIZE) + 0.5) / SIM_SIZE;
  }

  const particleVao = gl.createVertexArray();
  const uvBuffer = gl.createBuffer();
  if (!particleVao || !uvBuffer) return null;
  gl.bindVertexArray(particleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const starVao = gl.createVertexArray();

  // ---------------------------------------------------------------- textures
  const createSeedTexture = () => {
    const texture = gl.createTexture();
    if (!texture) throw new Error("Unable to create seed texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, gl.FLOAT, seedData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };

  const createStateTarget = (): FboTarget => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) throw new Error("Unable to create simulation target");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SIM_SIZE, SIM_SIZE, 0, gl.RGBA, gl.FLOAT, stateData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
  };

  const seedTexture = createSeedTexture();
  const stateTargets = [createStateTarget(), createStateTarget()];

  // ----------------------------------------------------------------- programs
  const simProgram = createProgram(gl, SIM_VS, SIM_FS);
  const fadeProgram = createProgram(gl, SIM_VS, FADE_FS);
  const particleProgram = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
  const starProgram = createProgram(gl, STAR_VS, STAR_FS);
  const blitProgram = createProgram(gl, SIM_VS, BLIT_FS);

  const simU = {
    state: gl.getUniformLocation(simProgram, "uState"),
    seeds: gl.getUniformLocation(simProgram, "uSeeds"),
    time: gl.getUniformLocation(simProgram, "uTime"),
    dt: gl.getUniformLocation(simProgram, "uDt"),
    mix: gl.getUniformLocation(simProgram, "uMix"),
    turbulence: gl.getUniformLocation(simProgram, "uTurbulence"),
    swirl: gl.getUniformLocation(simProgram, "uSwirl"),
    spread: gl.getUniformLocation(simProgram, "uSpread"),
    shapeA: gl.getUniformLocation(simProgram, "uShapeA"),
    shapeB: gl.getUniformLocation(simProgram, "uShapeB"),
  };
  const fadeU = {
    texture: gl.getUniformLocation(fadeProgram, "uTexture"),
    resolution: gl.getUniformLocation(fadeProgram, "uResolution"),
    fade: gl.getUniformLocation(fadeProgram, "uFade"),
  };
  const particleU = {
    state: gl.getUniformLocation(particleProgram, "uState"),
    seeds: gl.getUniformLocation(particleProgram, "uSeeds"),
    time: gl.getUniformLocation(particleProgram, "uTime"),
    pixelScale: gl.getUniformLocation(particleProgram, "uPixelScale"),
    intensity: gl.getUniformLocation(particleProgram, "uIntensity"),
  };
  const starU = {
    time: gl.getUniformLocation(starProgram, "uTime"),
    pixelScale: gl.getUniformLocation(starProgram, "uPixelScale"),
    intensity: gl.getUniformLocation(starProgram, "uIntensity"),
  };
  const blitU = {
    texture: gl.getUniformLocation(blitProgram, "uTexture"),
    resolution: gl.getUniformLocation(blitProgram, "uResolution"),
  };

  // -------------------------------------------------------------------- state
  let stateIndex = 0;
  let trailIndex = 0;
  let trailTargets: FboTarget[] = [];
  let renderWidth = 1;
  let renderHeight = 1;
  let pixelScale = 1;
  let spreadX = 1;
  let offscreen = false;
  let disposed = false;
  let raf = 0;
  let lastTime = 0;
  let startTime = 0;

  const bindTexture = (unit: number, texture: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  };

  function clearTrailTargets() {
    gl.clearColor(0, 0, 0, 0);
    for (const target of trailTargets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function rebuildTrailTargets() {
    for (const target of trailTargets) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    trailTargets = [];
    for (let i = 0; i < 2; i++) {
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      if (!texture || !framebuffer) throw new Error("Unable to create trail target");
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, renderWidth, renderHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      trailTargets.push({ texture, framebuffer });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    clearTrailTargets();
    trailIndex = 0;
  }

  function simulate(dt: number, time: number, mix: number, turbulence: number, swirl: number, shapeA: number, shapeB: number) {
    const read = stateIndex;
    const write = 1 - stateIndex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, stateTargets[write].framebuffer);
    gl.viewport(0, 0, SIM_SIZE, SIM_SIZE);
    gl.disable(gl.BLEND);
    gl.useProgram(simProgram);

    bindTexture(0, stateTargets[read].texture);
    bindTexture(1, seedTexture);
    gl.uniform1i(simU.state, 0);
    gl.uniform1i(simU.seeds, 1);
    gl.uniform1f(simU.time, time);
    gl.uniform1f(simU.dt, dt);
    gl.uniform1f(simU.mix, mix);
    gl.uniform1f(simU.turbulence, turbulence);
    gl.uniform1f(simU.swirl, swirl);
    gl.uniform2f(simU.spread, spreadX, 1);
    gl.uniform1i(simU.shapeA, shapeA);
    gl.uniform1i(simU.shapeB, shapeB);

    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stateIndex = write;
  }

  function renderTrails(dt: number, time: number) {
    const read = trailIndex;
    const write = 1 - trailIndex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, trailTargets[write].framebuffer);
    gl.viewport(0, 0, renderWidth, renderHeight);

    // Fade the previous frame to leave elegant motion trails.
    gl.disable(gl.BLEND);
    gl.useProgram(fadeProgram);
    bindTexture(0, trailTargets[read].texture);
    gl.uniform1i(fadeU.texture, 0);
    gl.uniform2f(fadeU.resolution, renderWidth, renderHeight);
    gl.uniform1f(fadeU.fade, Math.pow(0.94, dt * 60));
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // Distant twinkling stars add depth behind the formation.
    if (starVao) {
      gl.useProgram(starProgram);
      gl.uniform1f(starU.time, time);
      gl.uniform1f(starU.pixelScale, pixelScale);
      gl.uniform1f(starU.intensity, 0.02);
      gl.bindVertexArray(starVao);
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);
    }

    // Main particle field.
    gl.useProgram(particleProgram);
    bindTexture(0, stateTargets[stateIndex].texture);
    bindTexture(1, seedTexture);
    gl.uniform1i(particleU.state, 0);
    gl.uniform1i(particleU.seeds, 1);
    gl.uniform1f(particleU.time, time);
    gl.uniform1f(particleU.pixelScale, pixelScale);
    gl.uniform1f(particleU.intensity, 0.42);
    gl.bindVertexArray(particleVao);
    gl.drawArrays(gl.POINTS, 0, COUNT);

    trailIndex = write;
  }

  function blitToScreen() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(blitProgram);
    bindTexture(0, trailTargets[trailIndex].texture);
    gl.uniform1i(blitU.texture, 0);
    gl.uniform2f(blitU.resolution, canvas.width, canvas.height);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function renderStill() {
    if (!trailTargets.length) return;
    const time = 2.4;
    for (let i = 0; i < 26; i++) {
      simulate(1 / 60, time + i / 60, 0, 0.16, 0.5, 1, 1);
      renderTrails(1 / 60, time + i / 60);
    }
    blitToScreen();
  }

  function handleResize() {
    const parent = canvas.parentElement;
    const cssWidth = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const cssHeight = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxPixels = compact ? 1_500_000 : 3_200_000;
    let scale = dpr;
    if (cssWidth * cssHeight * scale * scale > maxPixels) {
      scale = Math.sqrt(maxPixels / (cssWidth * cssHeight));
    }
    scale = Math.max(0.5, scale);
    const nextWidth = Math.max(1, Math.round(cssWidth * scale));
    const nextHeight = Math.max(1, Math.round(cssHeight * scale));

    if (nextWidth === renderWidth && nextHeight === renderHeight && scale === pixelScale && trailTargets.length) {
      if (reducedMotion) renderStill();
      return;
    }

    renderWidth = nextWidth;
    renderHeight = nextHeight;
    pixelScale = scale;
    spreadX = Math.min(1.2, Math.max(0.7, (cssWidth / cssHeight) * 0.66));
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    rebuildTrailTargets();
    if (reducedMotion) renderStill();
  }

  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);

    const seconds = now * 0.001;
    const dt = lastTime === 0 ? 1 / 60 : Math.min(0.05, Math.max(1 / 240, seconds - lastTime));
    lastTime = seconds;
    if (offscreen) return;

    if (startTime === 0) startTime = now;
    const elapsed = (now - startTime) * 0.001;
    const cycle = ACT_DURATION * ACT_COUNT;
    const localTime = ((elapsed % cycle) + cycle) % cycle;
    const actIndex = Math.floor(localTime / ACT_DURATION);
    const shapeA = actIndex % ACT_COUNT;
    const shapeB = (actIndex + 1) % ACT_COUNT;
    const local = localTime - actIndex * ACT_DURATION;
    const mix = smoothstep(ACT_DURATION - TRANSITION, ACT_DURATION, local);
    const transition = Math.sin(Math.PI * mix);

    const turbulence =
      0.28 +
      ACT_TURB[shapeA] * (1 - mix) +
      ACT_TURB[shapeB] * mix +
      transition * 0.9;
    const swirl =
      ACT_SWIRL[shapeA] * (1 - mix) + ACT_SWIRL[shapeB] * mix + transition * 0.25;

    simulate(dt, elapsed, mix, turbulence, swirl, shapeA, shapeB);
    renderTrails(dt, elapsed);
    blitToScreen();
  }

  // --------------------------------------------------------------- observers
  const resizeObserver = new ResizeObserver(handleResize);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) offscreen = !entry.isIntersecting;
    },
    { rootMargin: "160px" },
  );
  intersectionObserver.observe(canvas);

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  handleResize();
  if (!reducedMotion) raf = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    for (const target of trailTargets) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    for (const target of stateTargets) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    gl.deleteTexture(seedTexture);
    gl.deleteProgram(simProgram);
    gl.deleteProgram(fadeProgram);
    gl.deleteProgram(particleProgram);
    gl.deleteProgram(starProgram);
    gl.deleteProgram(blitProgram);
    gl.deleteBuffer(quadBuffer);
    gl.deleteBuffer(uvBuffer);
    gl.deleteVertexArray(quadVao);
    gl.deleteVertexArray(particleVao);
    if (starVao) gl.deleteVertexArray(starVao);
  };
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | null = null;
    try {
      cleanup = createHeroScene(canvas);
    } catch (error) {
      console.warn("Hero animation unavailable:", error);
    }
    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <canvas
      id="fx"
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
