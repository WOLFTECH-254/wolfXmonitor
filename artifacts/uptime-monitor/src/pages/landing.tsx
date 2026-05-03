import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Zap, Shield, Clock, Activity, ArrowRight, Globe, Bell, BarChart2 } from "lucide-react";
import { Footer } from "@/components/footer";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CountryStat { country: string; count: number; }

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa",
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", IN: "India", BR: "Brazil",
  MX: "Mexico", JP: "Japan", SG: "Singapore", AE: "UAE",
  RW: "Rwanda", TZ: "Tanzania", UG: "Uganda", ET: "Ethiopia",
  EG: "Egypt", MA: "Morocco", SN: "Senegal", PK: "Pakistan",
  PH: "Philippines", ID: "Indonesia", TR: "Turkey", NL: "Netherlands",
};

const MOCK_COUNTRIES: CountryStat[] = [
  { country: "KE", count: 38 }, { country: "NG", count: 27 },
  { country: "GH", count: 19 }, { country: "US", count: 15 },
  { country: "ZA", count: 12 }, { country: "GB", count: 9 },
  { country: "IN", count: 8 },  { country: "TZ", count: 7 },
  { country: "UG", count: 6 },  { country: "RW", count: 5 },
  { country: "CA", count: 4 },  { country: "DE", count: 4 },
  { country: "AU", count: 3 },  { country: "SG", count: 3 },
  { country: "AE", count: 2 },  { country: "PH", count: 2 },
  { country: "ET", count: 2 },  { country: "MA", count: 2 },
  { country: "FR", count: 2 },  { country: "BR", count: 1 },
  { country: "JP", count: 1 },  { country: "NL", count: 1 },
  { country: "PK", count: 1 },  { country: "EG", count: 1 },
];

// ─── Earth texture (equirectangular) for Three.js ─────────────────────────
function buildEarthTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;

  ctx.fillStyle = "#020b05";
  ctx.fillRect(0, 0, W, H);

  // lon/lat → pixel
  const px = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * W,
    ((90 - lat) / 180) * H,
  ];

  const blob = (lon: number, lat: number, rx: number, ry: number, rot = 0) => {
    const [cx, cy] = px(lon, lat);
    for (const [scale, color] of [
      [1.00, "#071a0c"], [0.82, "#0d3318"],
      [0.66, "#145e26"], [0.48, "#1d8535"],
    ] as [number, string][]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * scale, ry * scale, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  blob( 18,   5,  65, 105, 0);     // Africa
  blob( 30,  15,  28,  38, 0.2);
  blob(  5,  12,  22,  30,-0.15);
  blob( 13,  52,  50,  32,-0.25);  // Europe
  blob( 28,  44,  22,  22, 0.1);
  blob(-10,  40,  18,  20, 0.2);
  blob( 90,  52, 140,  68, 0.08);  // Asia
  blob( 78,  22,  30,  46, 0);     // India
  blob(105,  15,  30,  36, 0.3);   // SE Asia
  blob(140,  38,  18,  32, 0.1);   // Japan
  blob( 42,  27,  32,  24, 0.1);   // Middle East
  blob(-100, 50,  90,  72,-0.18);  // N. America
  blob( -85, 22,  24,  28, 0.3);
  blob( -58,-12,  48,  88, 0.08);  // S. America
  blob( 133,-26,  60,  42, 0);     // Australia
  blob( -43, 74,  28,  38, 0);     // Greenland

  const g = ctx.createLinearGradient(0, H - 72, 0, H);
  g.addColorStop(0, "#0a1f10"); g.addColorStop(1, "#1a4228");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 72, W, 72);

  return new THREE.CanvasTexture(cv);
}

// ─── Three.js solar system (WebGL) ────────────────────────────────────────
function initThreeJS(container: HTMLDivElement): () => void {
  const W = container.clientWidth, H = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);

  // Stars
  const starPos = new Float32Array(3000 * 3);
  for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 300;
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })));

  // Sun
  const SUN = new THREE.Vector3(0, 0, 0);
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  );
  scene.add(sunMesh);

  for (const [r, col, op] of [[2.4, 0xff9900, 0.25],[3.6, 0xff6600, 0.12],[5.2, 0xff4400, 0.05]] as [number,number,number][]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.BackSide }));
    scene.add(h);
  }

  const sunLight = new THREE.PointLight(0xfff4cc, 3.5, 80);
  sunLight.position.copy(SUN);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x111811, 0.8));

  // Earth
  const ORBIT_R = 10;
  let earthAngle = Math.PI * 0.5;

  const earthTex  = buildEarthTexture();
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 64, 64),
    new THREE.MeshPhongMaterial({ map: earthTex, specular: new THREE.Color(0x112211), shininess: 20 }),
  );
  earthMesh.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.93, 48, 48),
    new THREE.MeshPhongMaterial({ color: 0x22ff66, transparent: true, opacity: 0.07 }),
  ));
  earthMesh.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.04, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x00cc44, transparent: true, opacity: 0.05, side: THREE.BackSide }),
  ));
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = 0.41;
  earthGroup.add(earthMesh);
  scene.add(earthGroup);

  // Orbit ring
  const orbitPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    orbitPts.push(new THREE.Vector3(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R));
  }
  const orbitMat  = new THREE.LineBasicMaterial({ color: 0x1a6b30, transparent: true, opacity: 0 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), orbitMat));

  // Camera animation
  const startMs = performance.now();
  const PHASE1_START = 3200, PHASE1_DUR = 4500;

  const closePos   = new THREE.Vector3(ORBIT_R * Math.cos(earthAngle), 0.8, ORBIT_R * Math.sin(earthAngle) + 4.0);
  const widePos    = new THREE.Vector3(0, 18, 28);
  const closeTgt   = new THREE.Vector3(ORBIT_R * Math.cos(earthAngle), 0, ORBIT_R * Math.sin(earthAngle));
  const wideTgt    = new THREE.Vector3(0, 0, 0);
  const tmpPos     = new THREE.Vector3();
  const tmpTgt     = new THREE.Vector3();

  camera.position.copy(closePos);
  camera.lookAt(closeTgt);

  let selfRot = 0, animId = 0;

  const animate = () => {
    animId = requestAnimationFrame(animate);
    const elapsed = performance.now() - startMs;

    earthAngle += 0.0018;
    selfRot    += 0.006;
    const ex = Math.cos(earthAngle) * ORBIT_R;
    const ez = Math.sin(earthAngle) * ORBIT_R;
    earthGroup.position.set(ex, 0, ez);
    earthMesh.rotation.y = selfRot;
    sunMesh.scale.setScalar(1 + 0.025 * Math.sin(elapsed * 0.0015));

    if (elapsed < PHASE1_START) {
      const circle = elapsed * 0.00018;
      camera.position.set(ex + Math.sin(circle) * 0.6, closePos.y, ez + 4.0);
      camera.lookAt(ex, 0, ez);
    } else {
      const t = Math.min((elapsed - PHASE1_START) / PHASE1_DUR, 1);
      const e = 1 - Math.pow(1 - t, 3);
      tmpPos.lerpVectors(closePos, widePos, e);
      tmpTgt.lerpVectors(closeTgt, wideTgt, e);
      camera.position.copy(tmpPos);
      camera.lookAt(tmpTgt);
      orbitMat.opacity = 0.45 * e;
    }

    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
    earthTex.dispose();
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  };
}

// ─── Canvas 2D solar system (no-WebGL fallback) ───────────────────────────
function initCanvas2D(container: HTMLDivElement): () => void {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  container.appendChild(canvas);

  // Seeded stars so they don't move on resize
  const STARS = Array.from({ length: 220 }, (_, i) => ({
    x: Math.abs(Math.sin(i * 127.1)) ,
    y: Math.abs(Math.sin(i * 311.7)),
    r: 0.3 + Math.abs(Math.sin(i * 74.3)) * 1.1,
    a: 0.4 + Math.abs(Math.sin(i * 53.1)) * 0.6,
  }));

  const startMs   = performance.now();
  const P1_START  = 3200, P1_DUR = 4500;
  let earthAngle  = Math.PI * 0.5;
  let selfRot     = 0;
  let animId      = 0;

  // Resize canvas to physical pixels
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width  = container.clientWidth  * dpr;
    canvas.height = container.clientHeight * dpr;
  };
  resize();
  window.addEventListener("resize", resize);

  const drawGlowCircle = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    color: string, glow: number,
  ) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const drawSphere = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number,
    lightX: number, lightY: number,
    hi: string, mid: string, dark: string,
  ) => {
    const dx = lightX - x, dy = lightY - y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    const hx = x + (dx / d) * r * 0.38, hy = y + (dy / d) * r * 0.38;
    const g  = ctx.createRadialGradient(hx, hy, r * 0.04, x, y, r);
    g.addColorStop(0.00, hi);
    g.addColorStop(0.42, mid);
    g.addColorStop(0.80, dark);
    g.addColorStop(1.00, "rgba(0,0,0,0.95)");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  };

  const animate = () => {
    animId = requestAnimationFrame(animate);
    const elapsed = performance.now() - startMs;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CW = canvas.width, CH = canvas.height;
    const dpr = CW / container.clientWidth;
    ctx.clearRect(0, 0, CW, CH);

    const W = CW / dpr, H = CH / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Stars (screen-space)
    STARS.forEach(({ x, y, r, a }) => {
      const twinkle = a * (0.75 + 0.25 * Math.sin(elapsed * 0.001 + x * 200));
      ctx.beginPath();
      ctx.arc(x * W, y * H, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
      ctx.fill();
    });

    // Orbit & sizes
    const ORBIT_R  = Math.min(W, H) * 0.30;
    const ORBIT_TY = ORBIT_R * 0.32; // perspective tilt
    const SUN_R    = Math.min(W, H) * 0.07;
    const EARTH_R  = Math.min(W, H) * 0.055;

    earthAngle += 0.003;
    selfRot    += 0.015;

    const ex_r = Math.cos(earthAngle) * ORBIT_R;
    const ey_r = Math.sin(earthAngle) * ORBIT_TY;

    // Camera transform
    let zoom = 1, camX = 0, camY = 0;
    if (elapsed < P1_START) {
      zoom = 2.8; camX = -ex_r; camY = -ey_r;
    } else {
      const t = Math.min((elapsed - P1_START) / P1_DUR, 1);
      const e = 1 - Math.pow(1 - t, 3);
      zoom = 2.8 - 1.8 * e;
      camX = -ex_r * (1 - e);
      camY = -ey_r * (1 - e);
    }

    // Apply camera
    ctx.save();
    ctx.translate(W / 2 + camX * zoom, H / 2 + camY * zoom);
    ctx.scale(zoom, zoom);

    const sx = 0, sy = 0; // sun at origin in scene-space
    const ex = ex_r, ey = ey_r;

    // Orbit ellipse (fades in during zoom-out)
    const orbitAlpha = elapsed < P1_START ? 0 : Math.min((elapsed - P1_START) / P1_DUR, 1) * 0.45;
    if (orbitAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = orbitAlpha;
      ctx.beginPath();
      ctx.ellipse(sx, sy, ORBIT_R, ORBIT_TY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#1a6b30";
      ctx.lineWidth   = 1 / zoom;
      ctx.stroke();
      ctx.restore();
    }

    // Sun glow halos
    for (const [gr, gop] of [[SUN_R * 5, 0.03],[SUN_R * 3, 0.07],[SUN_R * 1.8, 0.16]] as [number,number][]) {
      const g2 = ctx.createRadialGradient(sx, sy, SUN_R * 0.5, sx, sy, gr);
      g2.addColorStop(0, `rgba(255,200,50,${gop})`);
      g2.addColorStop(1, "rgba(255,80,0,0)");
      ctx.beginPath(); ctx.arc(sx, sy, gr, 0, Math.PI * 2);
      ctx.fillStyle = g2; ctx.fill();
    }

    // Sun core
    const pulse = 1 + 0.022 * Math.sin(elapsed * 0.0018);
    const sg = ctx.createRadialGradient(sx - SUN_R * 0.3, sy - SUN_R * 0.3, SUN_R * 0.08, sx, sy, SUN_R * pulse);
    sg.addColorStop(0, "#fffaaa");
    sg.addColorStop(0.5, "#ffdd33");
    sg.addColorStop(1, "#ff8800");
    ctx.beginPath(); ctx.arc(sx, sy, SUN_R * pulse, 0, Math.PI * 2);
    ctx.fillStyle = sg; ctx.fill();

    // Earth atmosphere glow
    ctx.save();
    ctx.shadowColor = "rgba(40,200,90,0.55)";
    ctx.shadowBlur  = EARTH_R * 0.9;
    ctx.beginPath(); ctx.arc(ex, ey, EARTH_R * 1.12, 0, Math.PI * 2);
    ctx.fillStyle   = "rgba(20,160,60,0.07)";
    ctx.fill();
    ctx.restore();

    // Earth sphere (3D shaded from sun)
    drawSphere(ctx, ex, ey, EARTH_R, sx, sy, "#2dcc60", "#145e26", "#030d06");

    // Continents — simple blobs rotating on the face
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, EARTH_R * 0.98, 0, Math.PI * 2);
    ctx.clip();
    // Map each continent blob using spherical projection approximation:
    // u = sin(selfRot + longitude), v = latitude
    const continents: [number, number, number, number][] = [
      [ 0.18,  0.05, 0.22, 0.40],  // Africa  (lon≈0.18, lat≈0.05)
      [-0.30,  0.02, 0.26, 0.30],  // Americas
      [ 0.58, -0.12, 0.40, 0.24],  // Asia
      [-0.05,  0.55, 0.26, 0.18],  // Australia-ish
      [-0.25, -0.40, 0.20, 0.14],  // S.America south
    ];
    for (const [lon, lat, rw, rh] of continents) {
      const u = Math.sin((selfRot * 0.4 + lon) * Math.PI * 2);
      // Only draw on visible hemisphere (u > -0.2)
      if (u < -0.15) continue;
      const cx2 = ex + u * EARTH_R * 0.92;
      const cy2 = ey + lat * EARTH_R * 1.6;
      const stretch = Math.max(0.15, Math.abs(u)); // foreshortening
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, rw * EARTH_R * stretch, rh * EARTH_R, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(29,133,53,0.58)`;
      ctx.fill();
      // Brighter highlight
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, rw * EARTH_R * stretch * 0.6, rh * EARTH_R * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45,180,80,0.30)`;
      ctx.fill();
    }
    ctx.restore();

    // Terminator (shadow on Earth from sun direction)
    const lightAngle = Math.atan2(sy - ey, sx - ex);
    const terminatorGrad = ctx.createRadialGradient(
      ex + Math.cos(lightAngle) * EARTH_R * 0.4,
      ey + Math.sin(lightAngle) * EARTH_R * 0.4,
      0,
      ex, ey, EARTH_R,
    );
    terminatorGrad.addColorStop(0.45, "rgba(0,0,0,0)");
    terminatorGrad.addColorStop(1.00, "rgba(0,0,0,0.75)");
    ctx.beginPath();
    ctx.arc(ex, ey, EARTH_R, 0, Math.PI * 2);
    ctx.fillStyle = terminatorGrad;
    ctx.fill();

    ctx.restore(); // camera
    ctx.restore(); // dpr scale
  };

  animate();

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
    if (container.contains(canvas)) container.removeChild(canvas);
  };
}

// ─── Unified background component ─────────────────────────────────────────
function SolarSystemBg() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Detect WebGL support
    const probe = document.createElement("canvas");
    const hasGL  = !!(probe.getContext("webgl") || probe.getContext("experimental-webgl"));

    let cleanup: (() => void) | undefined;
    if (hasGL) {
      try { cleanup = initThreeJS(el); }
      catch { cleanup = initCanvas2D(el); }
    } else {
      cleanup = initCanvas2D(el);
    }
    return cleanup;
  }, []);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

// ─── Flag image ────────────────────────────────────────────────────────────
function FlagImg({ code, size = 32 }: { code: string; size?: number }) {
  const lower = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w${size}/${lower}.png`}
      srcSet={`https://flagcdn.com/w${size * 2}/${lower}.png 2x`}
      width={size} height={Math.round(size * 0.75)}
      alt={code} loading="lazy"
      className="rounded-sm object-cover"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ─── Animated counter ──────────────────────────────────────────────────────
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); obs.disconnect(); } },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!triggered || target === 0) return;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [triggered, target, duration]);

  return { value, sectionRef };
}

interface OgMeta { ogTitle: string; ogDescription: string; ogImage: string; ogUrl: string; }

// ─── Page ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const { data: ogMeta } = useQuery<OgMeta>({
    queryKey: ["og-meta"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/settings/og`);
      return res.ok ? res.json() : null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: realStats = [] } = useQuery<CountryStat[]>({
    queryKey: ["country-stats"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stats/countries`);
      return res.ok ? res.json() : [];
    },
    staleTime: 60 * 1000,
  });

  const countryStats: CountryStat[] = (() => {
    const merged = new Map<string, number>(MOCK_COUNTRIES.map(c => [c.country, c.count]));
    for (const r of realStats) {
      const code = r.country.toUpperCase();
      merged.set(code, (merged.get(code) ?? 0) + r.count);
    }
    return Array.from(merged.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const totalUsers       = countryStats.reduce((sum, r) => sum + r.count, 0);
  const { value: animatedTotal, sectionRef } = useCountUp(totalUsers);
  const visibleFlags     = countryStats.slice(0, 8);
  const extraCount       = countryStats.length - visibleFlags.length;
  const displayUsers     = Math.floor(totalUsers / 100) * 100;
  const displayCountries = Math.floor(countryStats.length / 10) * 10;

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-x-hidden">
      <Helmet>
        <title>{ogMeta?.ogTitle ?? "wolfXmonitor — Know When Your Sites Go Down"}</title>
        <meta name="description" content={ogMeta?.ogDescription ?? "Real-time uptime monitoring with instant alerts."} />
        <meta property="og:title"       content={ogMeta?.ogTitle ?? "wolfXmonitor — Know When Your Sites Go Down"} />
        <meta property="og:description" content={ogMeta?.ogDescription ?? "Real-time uptime monitoring with instant alerts."} />
        <meta property="og:url"         content={ogMeta?.ogUrl ?? "https://monitor.xwolf.space"} />
        {ogMeta?.ogImage && <meta property="og:image"  content={ogMeta.ogImage} />}
        {ogMeta?.ogImage && <meta name="twitter:card"  content="summary_large_image" />}
        {ogMeta?.ogImage && <meta name="twitter:image" content={ogMeta.ogImage} />}
      </Helmet>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-xl text-foreground">
            wolf<span className="text-primary">X</span>monitor
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/status">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 hidden sm:block">Status</button>
          </Link>
          <Link href="/signin">
            <button className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">Log In</button>
          </Link>
          <Link href="/signup">
            <button className="font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2 rounded font-bold tracking-wide">Get Started</button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 overflow-hidden">

        {/* Solar system animation fills the hero */}
        <SolarSystemBg />

        {/* Vignette keeps text readable */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.48) 52%, rgba(0,0,0,0.86) 100%)",
        }} />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Copy */}
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 rounded-full px-4 py-1.5 mb-8">
            <span className="status-dot up" />
            <span className="font-mono text-xs text-primary tracking-wider">ALL SYSTEMS OPERATIONAL</span>
          </div>

          <h1 className="font-display leading-none mb-2">
            <span className="block text-[clamp(56px,12vw,140px)] text-foreground">KEEP YOUR APPS</span>
            <span className="block text-[clamp(56px,12vw,140px)] text-primary glow-text">ALIVE.</span>
          </h1>

          <p className="font-mono text-muted-foreground text-sm md:text-base max-w-xl mx-auto mt-6 mb-3 leading-relaxed">
            I am just a wolf — watching your endpoints.
          </p>
          <p className="font-mono text-muted-foreground/70 text-sm max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatically ping your Render, Railway, and Fly.io projects so they never sleep.
            Monitor response times, track uptime, and get notified when something breaks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-8 py-3.5 rounded font-bold tracking-wider group">
                Start Monitoring
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/signin">
              <button className="font-mono text-sm border border-border hover:border-primary/50 text-foreground hover:text-primary transition-all px-8 py-3.5 rounded tracking-wider">
                View Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 w-full max-w-4xl mx-auto mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border bg-card/80 backdrop-blur-sm rounded">
            {[
              { value: "99.9%", label: "Uptime SLA"      },
              { value: "24/7",  label: "Always Watching" },
              { value: "<30s",  label: "Detection Speed" },
              { value: "Free",  label: "Open & Forever"  },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-6 px-4 border-r border-b md:border-b-0 border-border last:border-r-0">
                <div className="font-display text-4xl md:text-5xl text-foreground leading-none">{stat.value}</div>
                <div className="font-mono text-xs text-muted-foreground mt-2 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GLOBAL REACH ─────────────────────────────────────────────────── */}
      <section ref={sectionRef} className="px-6 py-14 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          <div className="flex items-center">
            <div className="flex -space-x-3">
              {visibleFlags.map(({ country }, i) => (
                <div key={country} title={COUNTRY_NAMES[country.toUpperCase()] ?? country}
                  style={{ zIndex: visibleFlags.length - i }}
                  className="relative w-10 h-10 rounded-full border-2 border-background bg-card overflow-hidden flex items-center justify-center shadow-lg cursor-default hover:z-50 hover:scale-110 transition-transform">
                  <FlagImg code={country} size={40} />
                </div>
              ))}
              {extraCount > 0 && (
                <div style={{ zIndex: 0 }} className="relative w-10 h-10 rounded-full border-2 border-border bg-card flex items-center justify-center font-mono text-[10px] text-muted-foreground font-bold shadow-lg">
                  +{extraCount}
                </div>
              )}
            </div>
          </div>
          <div className="hidden sm:block w-px h-12 bg-border" />
          <div className="text-center sm:text-left">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-5xl md:text-6xl text-primary leading-none tabular-nums">
                {animatedTotal >= displayUsers ? `${displayUsers.toLocaleString()}+` : animatedTotal.toLocaleString()}
              </span>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest ml-1">users</span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground mt-1.5 tracking-wide">
              wolves monitoring from{" "}
              <span className="text-foreground font-bold">{displayCountries}+ countries</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="font-display text-[clamp(36px,6vw,72px)] text-foreground leading-none">
            HOW IT <span className="text-primary">WORKS</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mt-4">Three steps to keep your projects online.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Globe,     step: "01", title: "Add Your URL",    desc: "Paste any HTTP/HTTPS endpoint — your Render app, REST API, or any web service." },
            { icon: Clock,     step: "02", title: "Set an Interval", desc: "Choose how often to ping — every 1, 5, 10, or 15 minutes. Prevents sleep timeouts automatically." },
            { icon: BarChart2, step: "03", title: "Track & Monitor", desc: "Watch response times, uptime %, and ping logs in real-time from your dashboard." },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className="group border border-border hover:border-primary/40 bg-card rounded p-8 transition-all hover:bg-card/80 relative overflow-hidden">
              <div className="absolute top-4 right-4 font-display text-6xl text-primary/5 group-hover:text-primary/10 transition-colors leading-none select-none">{step}</div>
              <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded flex items-center justify-center mb-6">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-2xl text-foreground mb-3">{title}</h3>
              <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 mb-4">
            <h2 className="font-display text-[clamp(36px,6vw,72px)] text-foreground leading-none">
              FEATURES THAT <span className="text-primary">MATTER</span>
            </h2>
          </div>
          {[
            { icon: Activity, title: "Response Time Charts", desc: "Live line charts showing every ping's latency over time. Spot regressions instantly." },
            { icon: Shield,   title: "Uptime History",       desc: "Color-coded bar charts — green for up, red for down. See your uptime at a glance." },
            { icon: Bell,     title: "Manual Ping",          desc: "Hit 'Ping Now' to check any endpoint on-demand without waiting for the scheduler." },
            { icon: Zap,      title: "Auto-Scheduler",       desc: "The server schedules pings in the background — no cron jobs, no external services." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-5 border border-border bg-card rounded p-6 hover:border-primary/30 transition-colors group">
              <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-mono font-bold text-foreground mb-2">{title}</h4>
                <p className="font-mono text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-28 text-center border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="font-display text-[clamp(48px,10vw,110px)] text-foreground leading-none mb-6">
            WAKE UP YOUR <span className="text-primary glow-text">APPS.</span>
          </h2>
          <p className="font-mono text-muted-foreground text-sm mb-10 max-w-xl mx-auto">
            Stop letting Render put your projects to sleep. Create a free account and start monitoring in seconds.
          </p>
          <Link href="/signup">
            <button className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-10 py-4 rounded font-bold tracking-wider text-base group">
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <p className="font-mono text-[11px] text-muted-foreground/40 mt-8 tracking-wider">
            Powered by <span className="text-primary/50">WOLF TECH</span> · Silent Wolf
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
