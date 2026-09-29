"use client";

// LIVING CITY — illustrative 3D city view (Three.js) for the command center.
// District clusters + event pillars are a STYLIZED SCHEMATIC (lat/lon → scene
// coords), not a physical or geographic model. Markers come from REAL stored
// events only (status ACTIVE/DEVELOPING, non-null coordinates).

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PublicEvent } from "@/lib/city-api";

export interface City3DProps {
  events: PublicEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

const DISTRICTS: ReadonlyArray<{ id: string; label: string; lat: number; lon: number }> = [
  { id: "west", label: "WEST", lat: 17.4401, lon: 78.3489 },
  { id: "central", label: "CENTRAL", lat: 17.385, lon: 78.4867 },
  { id: "north", label: "NORTH", lat: 17.54, lon: 78.49 },
  { id: "east", label: "EAST", lat: 17.4, lon: 78.56 },
  { id: "oldcity", label: "OLD CITY", lat: 17.3616, lon: 78.4747 },
  { id: "secunderabad", label: "SECUNDERABAD", lat: 17.4399, lon: 78.4983 },
  { id: "south", label: "SOUTH", lat: 17.2403, lon: 78.4294 },
];

const ORIGIN_COLORS: Record<string, string> = {
  LIVE: "#34d399",
  SIMULATED: "#c084fc",
  USER_REPORTED: "#fbbf24",
};
const ORIGIN_FALLBACK = "#64748b";

const SEVERITY_HEIGHT: Record<string, number> = {
  INFO: 1.2,
  MINOR: 2.2,
  MODERATE: 3.6,
  MAJOR: 5.2,
  CRITICAL: 7,
};
const SEVERITY_FALLBACK = 2.2;

const LEGEND_ORIGINS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "LIVE", label: "LIVE" },
  { key: "SIMULATED", label: "SIMULATED" },
  { key: "USER_REPORTED", label: "USER_REPORTED" },
];

const DEFAULT_CAMERA_POS = new THREE.Vector3(46, 44, 70);
const DEFAULT_TARGET = new THREE.Vector3(7, 0.5, 0);

const RAIN_DROP_COUNT = 400;
const RAIN_X_MIN = -12;
const RAIN_X_MAX = 24;
const RAIN_Z_MIN = -22;
const RAIN_Z_MAX = 24;
const RAIN_TOP = 26;

const IDLE_RESUME_MS = 10_000;

// ---------------------------------------------------------------------------
// deterministic pseudo-random helpers
// ---------------------------------------------------------------------------

function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// lat/lon → scene coords (north is -z)
function toSceneXZ(lat: number, lon: number): { x: number; z: number } {
  return { x: (lon - 78.4) * 100, z: -(lat - 17.4) * 100 };
}

function isActiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "DEVELOPING";
}

// ---------------------------------------------------------------------------
// three.js helpers
// ---------------------------------------------------------------------------

interface RainState {
  line: THREE.LineSegments;
  speeds: number[];
}

interface CamTween {
  active: boolean;
  t: number;
  dur: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

interface City3DState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  eventGroup: THREE.Group;
  rainGroup: THREE.Group;
  rings: Array<{ mesh: THREE.Mesh; phase: number }>;
  beams: THREE.Mesh[];
  rain: RainState | null;
  camTween: CamTween;
  clock: THREE.Clock;
  raf: number | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  container: HTMLDivElement;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      obj.geometry.dispose();
      const mat: THREE.Material | THREE.Material[] = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose();
      obj.material.dispose();
    }
  });
}

function clearGroup(group: THREE.Group): void {
  const children = [...group.children];
  for (const child of children) {
    group.remove(child);
    disposeObject(child);
  }
}

function makeDistrictLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "600 26px ui-sans-serif, system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#64748b"; // slate-500
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(7, 1.75, 1);
  return sprite;
}

function buildEventMarker(st: City3DState, ev: PublicEvent, lat: number, lon: number, selected: boolean): THREE.Group {
  const colorHex = ORIGIN_COLORS[ev.dataOrigin] ?? ORIGIN_FALLBACK;
  const color = new THREE.Color(colorHex);
  const height = SEVERITY_HEIGHT[ev.severity] ?? SEVERITY_FALLBACK;
  const { x, z } = toSceneXZ(lat, lon);

  const marker = new THREE.Group();
  marker.userData.eventId = ev.id;
  marker.position.set(x, 0, z);

  const pillarGeo = new THREE.CylinderGeometry(0.22, 0.3, height, 10);
  const pillarMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: selected ? 0.95 : 0.35,
    roughness: 0.4,
    metalness: 0.1,
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = height / 2 + 0.1;
  pillar.userData.eventId = ev.id;
  marker.add(pillar);

  const ringGeo = new THREE.RingGeometry(0.42, 0.62, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.32;
  ring.userData.eventId = ev.id;
  marker.add(ring);
  st.rings.push({ mesh: ring, phase: (hashString(ev.id) % 1000) / 1000 });

  if (selected) {
    const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 26, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 13.1;
    beam.userData.eventId = ev.id;
    marker.add(beam);
    st.beams.push(beam);
  }

  return marker;
}

function rebuildEventLayer(st: City3DState, events: PublicEvent[], selectedId: string | null): void {
  clearGroup(st.eventGroup);
  st.rings = [];
  st.beams = [];
  for (const ev of events) {
    if (ev.latitude === null || ev.longitude === null) continue;
    if (!isActiveStatus(ev.status)) continue;
    st.eventGroup.add(buildEventMarker(st, ev, ev.latitude, ev.longitude, ev.id === selectedId));
  }
  syncRain(st, events);
}

function buildRain(): RainState {
  const rng = mulberry32(hashString("city3d:rain"));
  const positions = new Float32Array(RAIN_DROP_COUNT * 6);
  const speeds: number[] = [];
  for (let i = 0; i < RAIN_DROP_COUNT; i++) {
    const x = RAIN_X_MIN + rng() * (RAIN_X_MAX - RAIN_X_MIN);
    const z = RAIN_Z_MIN + rng() * (RAIN_Z_MAX - RAIN_Z_MIN);
    const y = rng() * RAIN_TOP;
    const len = 0.6 + rng() * 0.7;
    positions[i * 6 + 0] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x;
    positions[i * 6 + 4] = y + len;
    positions[i * 6 + 5] = z;
    speeds.push(12 + rng() * 10);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.25, depthWrite: false });
  const line = new THREE.LineSegments(geo, mat);
  line.frustumCulled = false;
  return { line, speeds };
}

function updateRain(rain: RainState, dt: number): void {
  const attr = rain.line.geometry.getAttribute("position");
  if (!(attr instanceof THREE.BufferAttribute)) return;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < rain.speeds.length; i++) {
    const speed = rain.speeds[i];
    const head = i * 6 + 1;
    const tail = i * 6 + 4;
    arr[head] -= speed * dt;
    arr[tail] -= speed * dt;
    if (arr[head] < 0.1) {
      const len = arr[tail] - arr[head];
      const y = RAIN_TOP + Math.random() * 4;
      arr[head] = y;
      arr[tail] = y + len;
    }
  }
  attr.needsUpdate = true;
}

function syncRain(st: City3DState, events: PublicEvent[]): void {
  const needed = events.some((e) => isActiveStatus(e.status) && e.eventType === "WEATHER_RAIN");
  if (needed && !st.rain) {
    st.rain = buildRain();
    st.rainGroup.add(st.rain.line);
  } else if (!needed && st.rain) {
    st.rainGroup.remove(st.rain.line);
    disposeObject(st.rain.line);
    st.rain = null;
  }
}

// ---------------------------------------------------------------------------
// scene init (throws on WebGL failure → caller renders fallback)
// ---------------------------------------------------------------------------

function initScene(container: HTMLDivElement): City3DState {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "grab";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080f);
  scene.fog = new THREE.Fog(0x05080f, 120, 400);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 900);
  camera.position.copy(DEFAULT_CAMERA_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = 1.45;
  controls.minDistance = 30;
  controls.maxDistance = 300;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.update();

  scene.add(new THREE.AmbientLight(0x334155, 1.2));
  const dirLight = new THREE.DirectionalLight(0x64748b, 1.6);
  dirLight.position.set(35, 60, 25);
  scene.add(dirLight);

  // ground plane + subtle grid
  const groundGeo = new THREE.PlaneGeometry(800, 800);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x070d18, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  scene.add(ground);

  const grid = new THREE.GridHelper(400, 100, 0x16203a, 0x16203a);
  grid.position.y = -0.02;
  const gridMat = grid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.45;
  scene.add(grid);

  // district clusters: base plate + glowing rim + deterministic buildings + label sprite
  const districtGroup = new THREE.Group();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitBoxEdges = new THREE.EdgesGeometry(unitBox);
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x131c30,
    emissive: 0x1e293b,
    emissiveIntensity: 0.3,
    roughness: 0.85,
    metalness: 0.15,
  });
  const buildingEdgeMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.85 });

  DISTRICTS.forEach((zone, idx) => {
    const rng = mulberry32(hashString(`city3d:${zone.id}`));
    const { x, z } = toSceneXZ(zone.lat, zone.lon);
    const lift = idx * 0.015;
    const plateW = 3.8 + rng() * 0.6;

    const plateGeo = new RoundedBoxGeometry(plateW, 0.12, plateW, 2, 0.05);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0d1526,
      emissive: 0x101a30,
      emissiveIntensity: 0.45,
      roughness: 0.95,
      metalness: 0.05,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(x, lift + 0.06, z);
    districtGroup.add(plate);

    const rimGeo = new RoundedBoxGeometry(plateW + 0.28, 0.08, plateW + 0.28, 2, 0.06);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x1c2942 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(x, lift + 0.04, z);
    districtGroup.add(rim);

    const count = 6 + Math.floor(rng() * 5); // 6–10 buildings, stable across renders
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = Math.sqrt(rng()) * (plateW / 2 - 0.55);
      const w = 0.34 + rng() * 0.5;
      const d = 0.34 + rng() * 0.5;
      const h = 0.5 + Math.pow(rng(), 1.6) * 1.9;
      const building = new THREE.Mesh(unitBox, buildingMat);
      building.scale.set(w, h, d);
      building.position.set(x + Math.cos(ang) * rad, lift + 0.12 + h / 2, z + Math.sin(ang) * rad);
      districtGroup.add(building);
      const edges = new THREE.LineSegments(unitBoxEdges, buildingEdgeMat);
      edges.scale.copy(building.scale);
      edges.position.copy(building.position);
      districtGroup.add(edges);
    }

    const label = makeDistrictLabel(zone.label);
    label.position.set(x, 8.4, z);
    districtGroup.add(label);
  });
  scene.add(districtGroup);

  const eventGroup = new THREE.Group();
  scene.add(eventGroup);
  const rainGroup = new THREE.Group();
  scene.add(rainGroup);

  return {
    scene,
    camera,
    renderer,
    controls,
    eventGroup,
    rainGroup,
    rings: [],
    beams: [],
    rain: null,
    camTween: {
      active: false,
      t: 0,
      dur: 0.9,
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
    },
    clock: new THREE.Clock(),
    raf: null,
    idleTimer: null,
    container,
  };
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function City3D({ events, selectedId, onSelect }: City3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<City3DState | null>(null);
  const eventsRef = useRef<PublicEvent[]>(events);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // init once: scene, lights, districts, controls, interaction, render loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let state: City3DState;
    try {
      state = initScene(container);
    } catch (err) {
      console.error("[City3D] WebGL initialization failed:", err);
      container.replaceChildren();
      // defer state update out of the synchronous effect body (react-hooks rule)
      const failRaf = window.requestAnimationFrame(() => setFailed(true));
      return () => {
        window.cancelAnimationFrame(failRaf);
      };
    }
    stateRef.current = state;
    const canvas = state.renderer.domElement;

    // --- interaction: click (no drag) → raycast → onSelect; hover → tooltip ---
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    const findEventId = (obj: THREE.Object3D): string | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        const v: unknown = cur.userData.eventId;
        if (typeof v === "string") return v;
        cur = cur.parent;
      }
      return null;
    };

    const pickEvent = (clientX: number, clientY: number): PublicEvent | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, state.camera);
      const hits = raycaster.intersectObjects(state.eventGroup.children, true);
      for (const hit of hits) {
        const id = findEventId(hit.object);
        if (!id) continue;
        const ev = eventsRef.current.find((e) => e.id === id);
        if (ev) return ev;
      }
      return null;
    };

    const hideTooltip = (): void => {
      const tip = tooltipRef.current;
      if (tip) tip.style.display = "none";
    };

    const showTooltip = (ev: PublicEvent, clientX: number, clientY: number): void => {
      const tip = tooltipRef.current;
      if (!tip) return;
      const rect = container.getBoundingClientRect();
      let left = clientX - rect.left + 14;
      let top = clientY - rect.top + 14;
      if (left + 220 > rect.width) left = Math.max(8, rect.width - 224);
      if (top + 64 > rect.height) top = Math.max(8, rect.height - 68);
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      if (tip.dataset.eventId !== ev.id) {
        tip.dataset.eventId = ev.id;
        const title = document.createElement("div");
        title.className = "max-w-[220px] text-[11px] font-medium leading-tight text-slate-200";
        title.textContent = ev.title;
        const origin = document.createElement("span");
        origin.className = "text-[9px] font-semibold tracking-widest";
        origin.style.color = ORIGIN_COLORS[ev.dataOrigin] ?? ORIGIN_FALLBACK;
        origin.textContent = ev.dataOrigin;
        tip.replaceChildren(title, origin);
      }
      tip.style.display = "flex";
    };

    const onPointerDown = (e: PointerEvent): void => {
      downX = e.clientX;
      downY = e.clientY;
      downTime = performance.now();
      hideTooltip();
    };

    const onPointerUp = (e: PointerEvent): void => {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) > 6 || performance.now() - downTime > 500) return;
      const ev = pickEvent(e.clientX, e.clientY);
      if (ev) {
        hideTooltip();
        onSelectRef.current(ev.id);
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (e.buttons !== 0) {
        hideTooltip();
        return;
      }
      const ev = pickEvent(e.clientX, e.clientY);
      canvas.style.cursor = ev ? "pointer" : "grab";
      if (ev) showTooltip(ev, e.clientX, e.clientY);
      else hideTooltip();
    };

    // --- autoRotate: stops on interaction, resumes after idle ---
    const scheduleAutoRotate = (): void => {
      if (state.idleTimer !== null) clearTimeout(state.idleTimer);
      state.idleTimer = setTimeout(() => {
        const st = stateRef.current;
        if (st) st.controls.autoRotate = true;
      }, IDLE_RESUME_MS);
    };

    const onControlsStart = (): void => {
      state.controls.autoRotate = false;
      if (state.idleTimer !== null) {
        clearTimeout(state.idleTimer);
        state.idleTimer = null;
      }
      state.camTween.active = false;
    };

    const onControlsEnd = (): void => {
      scheduleAutoRotate();
    };

    state.controls.addEventListener("start", onControlsStart);
    state.controls.addEventListener("end", onControlsEnd);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", hideTooltip);

    // --- resize ---
    const ro = new ResizeObserver(() => {
      const st = stateRef.current;
      if (!st) return;
      const w = st.container.clientWidth;
      const h = st.container.clientHeight;
      if (w <= 0 || h <= 0) return;
      st.camera.aspect = w / h;
      st.camera.updateProjectionMatrix();
      st.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      st.renderer.setSize(w, h);
    });
    ro.observe(state.container);

    // --- render loop (paused while document.hidden) ---
    const tick = (): void => {
      const st = stateRef.current;
      if (!st) return;
      st.raf = requestAnimationFrame(tick);
      const dt = Math.min(st.clock.getDelta(), 0.05);
      const t = st.clock.elapsedTime;

      for (const ring of st.rings) {
        const cycle = (t * 1.4 + ring.phase) % 1;
        const s = 1 + cycle * 2.6;
        ring.mesh.scale.set(s, s, 1);
        const mat = ring.mesh.material;
        if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = (1 - cycle) * 0.55;
      }
      for (const beam of st.beams) {
        const mat = beam.material;
        if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = 0.12 + 0.06 * (0.5 + 0.5 * Math.sin(t * 2.6));
      }
      if (st.rain) updateRain(st.rain, dt);

      if (st.camTween.active) {
        const tw = st.camTween;
        tw.t = Math.min(1, tw.t + dt / tw.dur);
        const k = easeInOutCubic(tw.t);
        st.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
        st.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
        if (tw.t >= 1) {
          tw.active = false;
          scheduleAutoRotate();
        }
      }

      st.controls.update();
      st.renderer.render(st.scene, st.camera);
    };
    state.raf = requestAnimationFrame(tick);

    const onVisibility = (): void => {
      const st = stateRef.current;
      if (!st) return;
      if (document.hidden) {
        if (st.raf !== null) {
          cancelAnimationFrame(st.raf);
          st.raf = null;
        }
      } else if (st.raf === null) {
        st.clock.getDelta();
        st.raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // --- teardown: dispose everything ---
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", hideTooltip);
      const st = stateRef.current;
      if (st) {
        if (st.raf !== null) cancelAnimationFrame(st.raf);
        if (st.idleTimer !== null) clearTimeout(st.idleTimer);
        st.controls.removeEventListener("start", onControlsStart);
        st.controls.removeEventListener("end", onControlsEnd);
        st.controls.dispose();
        disposeObject(st.scene);
        st.renderer.dispose();
        st.renderer.forceContextLoss();
      }
      if (canvas.parentElement === container) container.removeChild(canvas);
      stateRef.current = null;
    };
  }, []);

  // rebuild only the event layer when events / selection change (no scene reinit)
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    rebuildEventLayer(st, events, selectedId);
  }, [events, selectedId]);

  const handleResetView = (): void => {
    const st = stateRef.current;
    if (!st) return;
    st.controls.autoRotate = false;
    if (st.idleTimer !== null) clearTimeout(st.idleTimer);
    st.idleTimer = null;
    st.camTween = {
      active: true,
      t: 0,
      dur: 0.9,
      fromPos: st.camera.position.clone(),
      toPos: DEFAULT_CAMERA_POS.clone(),
      fromTarget: st.controls.target.clone(),
      toTarget: DEFAULT_TARGET.clone(),
    };
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-[#1c2942] bg-[#05080f]">
      {failed ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="px-6 text-center text-xs text-slate-500">3D view unavailable — 2D map remains available.</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="absolute inset-0" />

          <div className="pointer-events-none absolute left-3 top-3 text-[10px] tracking-widest text-purple-300/80">
            🧊 3D CITY — ILLUSTRATIVE VIEW
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 text-[9px] tracking-[0.25em] text-slate-600">
            ILLUSTRATIVE VIEW — not a physical model
          </div>

          <button
            type="button"
            onClick={handleResetView}
            className="pointer-events-auto absolute right-3 top-3 rounded border border-[#1c2942] bg-[#0d1526] px-2.5 py-1.5 text-[10px] tracking-widest text-slate-300 transition-colors hover:text-cyan-300"
          >
            RESET VIEW
          </button>

          <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-1">
            <div className="flex items-center gap-3">
              {LEGEND_ORIGINS.map((o) => (
                <span key={o.key} className="flex items-center gap-1.5 text-[9px] tracking-wider text-slate-500">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ORIGIN_COLORS[o.key] ?? ORIGIN_FALLBACK }}
                  />
                  {o.label}
                </span>
              ))}
            </div>
            <span className="text-[9px] tracking-wider text-slate-500">
              pillar height ∝ severity · INFO low → CRITICAL tall
            </span>
          </div>

          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-10 flex-col gap-0.5 rounded border border-[#1c2942] bg-[#0d1526]/95 px-2 py-1.5"
            style={{ display: "none" }}
          />
        </>
      )}
    </div>
  );
}
