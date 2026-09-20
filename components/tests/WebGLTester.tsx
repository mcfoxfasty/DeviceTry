'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Box, Play, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { Translations } from '@/lib/i18n/types';

interface TesterProps {
  t?: Translations;
  locale?: string;
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
}

interface GlInfo {
  version: string;
  webgl2: boolean;
  vendor: string;
  renderer: string;
  maxTextureSize: string;
  maxViewport: string;
  extensions: number;
  shadingLanguageVersion: string;
  antialias: boolean;
}

// Built once at module load: the effect below references CUBE_VERTICES, so the
// constant must exist before the component — a render-scope declaration would
// be read before initialization and rebuilt on every render.
const CUBE_VERTICES: number[] = buildCube();

function buildCube(): number[] {
  // 6 faces × 2 triangles × 3 vertices, centered at origin
  const faces: number[][][] = [
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], // front
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], // back
    [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], // top
    [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], // bottom
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], // right
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], // left
  ];
  const out: number[] = [];
  for (const f of faces) {
    out.push(...f[0], ...f[1], ...f[2], ...f[0], ...f[2], ...f[3]);
  }
  return out;
}

export function WebGLTester({ onResultUpdate }: TesterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [info, setInfo] = useState<GlInfo | null>(null);
  const [unavailable, setUnavailable] = useState<boolean>(false);
  const [spinning, setSpinning] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      setUnavailable(true);
      onResultUpdate?.('unsupported', 'No WebGL context available');
      return;
    }

    const isGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

    const data: GlInfo = {
      version: gl.getParameter(gl.VERSION) as string,
      webgl2: isGl2,
      vendor: debugInfo ? (gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string) : (gl.getParameter(gl.VENDOR) as string),
      renderer: debugInfo ? (gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string),
      maxTextureSize: `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px`,
      maxViewport: (gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array).join(' × ') + ' px',
      extensions: gl.getSupportedExtensions()?.length ?? 0,
      shadingLanguageVersion: (gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string) || 'n/a',
      antialias: !!gl.getContextAttributes()?.antialias,
    };
    setInfo(data);
    onResultUpdate?.('passed', `WebGL ${isGl2 ? '2' : '1'} OK — ${data.renderer}`);

    // Spinning cube
    const vs = `
      attribute vec3 aPos;
      uniform float uAngle;
      void main() {
        float c = cos(uAngle); float s = sin(uAngle);
        mat3 rotY = mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c);
        mat3 rotX = mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c);
        vec3 p = rotX * rotY * aPos;
        gl_Position = vec4(p * 0.55, 1.0);
      }`;
    const fs = `
      precision mediump float;
      void main() { gl_FragColor = vec4(0.06, 0.46, 0.43, 1.0); }`;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(CUBE_VERTICES), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    const uAngle = gl.getUniformLocation(prog, 'uAngle');

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.CULL_FACE);

    const start = performance.now();
    const loop = () => {
      gl.clearColor(0.043, 0.066, 0.102, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(uAngle, ((performance.now() - start) / 1000) * Math.PI / 2.5);
      gl.drawArrays(gl.TRIANGLES, 0, CUBE_VERTICES.length / 3);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
        <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
          <Box className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#142033] dark:text-[#E9EEF4]">WebGL &amp; GPU Browser Test</h3>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8]">Context capabilities, unmasked GPU renderer and live 3D mesh</p>
        </div>
      </div>

      {unavailable ? (
        <div className="mt-5 p-6 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">WebGL could not be initialized</p>
            <p className="mt-1 opacity-80">Update your GPU drivers or check that hardware acceleration is enabled in browser settings.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 relative rounded-xl overflow-hidden border border-[#DFE5EB] dark:border-[#223043]">
            <canvas ref={canvasRef} className={`w-full h-[280px] block ${spinning ? '' : 'opacity-60'}`} />
            <button
              onClick={() => setSpinning((s) => !s)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {spinning ? 'Cube Spinning' : 'Paused'}
            </button>
          </div>

          {info && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Context Version', value: `${info.version} ${info.webgl2 ? '(WebGL 2 ✓)' : '(WebGL 1)'}` },
                { label: 'GPU Renderer', value: info.renderer },
                { label: 'GPU Vendor', value: info.vendor },
                { label: 'Max Texture Size', value: info.maxTextureSize },
                { label: 'Max Viewport', value: info.maxViewport },
                { label: 'Extensions', value: `${info.extensions} supported` },
                { label: 'GLSL Version', value: info.shadingLanguageVersion },
                { label: 'Antialiasing', value: info.antialias ? 'Enabled' : 'Disabled' },
              ].map((row) => (
                <div key={row.label} className="p-3 rounded-lg bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043]">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#5F6B7A] dark:text-[#9AA6B8]">{row.label}</p>
                  <p className="font-mono-num font-bold text-[#142033] dark:text-[#E9EEF4] mt-1 break-all">{row.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-[#192332] text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8] flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
        GPU renderer is read via WEBGL_debug_renderer_info and may be masked by privacy browsers. WebGL cannot report physical GPU temperature or total VRAM.
      </div>
    </div>
  );
}
