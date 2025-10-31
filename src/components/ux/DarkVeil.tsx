"use client";
import { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Triangle, Vec2 } from "ogl";

const vertex = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);} 
`;

const fragment = `
#ifdef GL_ES
precision lowp float;
#endif
uniform vec2 uResolution;
uniform float uTime;
uniform float uHueShift;
uniform float uNoise;
uniform float uScan;
uniform float uScanFreq;
uniform float uWarp;
#define iTime uTime
#define iResolution uResolution

float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);} 

mat3 rgb2yiq=mat3(0.299,0.587,0.114,0.596,-0.274,-0.322,0.211,-0.523,0.312);
mat3 yiq2rgb=mat3(1.0,0.956,0.621,1.0,-0.272,-0.647,1.0,-1.106,1.703);

vec3 hueShiftRGB(vec3 col,float deg){
    vec3 yiq=rgb2yiq*col; 
    float rad=radians(deg);
    float cosh=cos(rad),sinh=sin(rad);
    vec3 yiqShift=vec3(yiq.x,yiq.y*cosh-yiq.z*sinh,yiq.y*sinh+yiq.z*cosh);
    return clamp(yiq2rgb*yiqShift,0.0,1.0);
}

vec4 cppn_fn(vec2 uv){
    uv+=uWarp*vec2(sin(uv.y*6.283+uTime*0.5),cos(uv.x*6.283+uTime*0.5))*0.05; 
    float r = 0.25 + 0.25*sin(uv.x*2.2+uTime*0.3) + 0.25*cos(uv.y*2.0-uTime*0.25);
    vec3 col = mix(vec3(0.93,0.95,0.96), vec3(0.77,0.63,0.54), r);
    return vec4(col, 1.0);
}

void main(){
    vec2 uv=(gl_FragCoord.xy/uResolution.xy)*2.0-1.0; uv.y*=-1.0; 
    vec4 col=cppn_fn(uv);
    col.rgb=hueShiftRGB(col.rgb,uHueShift);
    float scanline=sin(gl_FragCoord.y*uScanFreq)*0.5+0.5;
    col.rgb*=1.0-(scanline*scanline)*uScan;
    col.rgb+=(rand(gl_FragCoord.xy+uTime)-0.5)*uNoise; 
    gl_FragColor=vec4(clamp(col.rgb,0.0,1.0),0.6);
}
`;

export default function DarkVeil({
  hueShift = 5,
  noiseIntensity = 0.02,
  scanlineIntensity = 0.06,
  speed = 0.4,
  scanlineFrequency = 0.9,
  warpAmount = 0.06,
  resolutionScale = 1,
}: {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  speed?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  resolutionScale?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const parent = canvas.parentElement!;
    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), canvas, alpha: true });
    const gl = renderer.gl;
    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Vec2() },
        uHueShift: { value: hueShift },
        uNoise: { value: noiseIntensity },
        uScan: { value: scanlineIntensity },
        uScanFreq: { value: scanlineFrequency },
        uWarp: { value: warpAmount },
      },
      transparent: true,
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const w = parent.clientWidth, h = parent.clientHeight;
      renderer.setSize(w * resolutionScale, h * resolutionScale);
      program.uniforms.uResolution.value.set(w, h);
    };
    const onResize = () => requestAnimationFrame(resize);
    window.addEventListener("resize", onResize);
    resize();

    const start = performance.now();
    let frame = 0;
    const loop = () => {
      program.uniforms.uTime.value = ((performance.now() - start) / 1000) * speed;
      program.uniforms.uHueShift.value = hueShift;
      program.uniforms.uNoise.value = noiseIntensity;
      program.uniforms.uScan.value = scanlineIntensity;
      program.uniforms.uScanFreq.value = scanlineFrequency;
      program.uniforms.uWarp.value = warpAmount;
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); };
  }, [hueShift, noiseIntensity, scanlineIntensity, speed, scanlineFrequency, warpAmount, resolutionScale]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 block h-full w-full" />;
}
