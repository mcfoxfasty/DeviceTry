'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Pause, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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

type FailureKind = 'compile' | 'link' | 'attrib';

interface RenderFailure {
  kind: FailureKind;
  detail: string;
}

/** Compile one shader and honestly report compile status. */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): { shader: WebGLShader | null; error: string | null } {
  const shader = gl.createShader(type);
  if (!shader) return { shader: null, error: 'createShader returned null' };
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader); // release the failed shader immediately
    return { shader: null, error: log.trim() };
  }
  return { shader, error: null };
}

/**
 * Build the cube program. Returns null (with a failure reason) when any
 * shader fails to compile or the program fails to link — context availability
 * alone is NEVER proof that rendering works.
 */
function buildCubeProgram(
  gl: WebGLRenderingContext
): { program: WebGLProgram | null; failure: RenderFailure | null } {
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

  const vert = compileShader(gl, gl.VERTEX_SHADER, vs);
  if (!vert.shader) return { program: null, failure: { kind: 'compile', detail: `vertex: ${vert.error}` } };
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!frag.shader) {
    gl.deleteShader(vert.shader);
    return { program: null, failure: { kind: 'compile', detail: `fragment: ${frag.error}` } };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert.shader);
    gl.deleteShader(frag.shader);
    return { program: null, failure: { kind: 'link', detail: 'createProgram returned null' } };
  }
  gl.attachShader(program, vert.shader);
  gl.attachShader(program, frag.shader);
  gl.linkProgram(program);
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  gl.detachShader(program, vert.shader);
  gl.detachShader(program, frag.shader);
  gl.deleteShader(vert.shader);
  gl.deleteShader(frag.shader);
  if (!linked) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    return { program: null, failure: { kind: 'link', detail: log.trim() } };
  }
  return { program, failure: null };
}

// Built once at module load: the effect references CUBE_VERTICES, so the
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

/** Seconds to radians — the cube completes one revolution in 2.5 s. */
const ANGLE_PER_SECOND = Math.PI / 2.5;

export function WebGLTester({ onResultUpdate }: TesterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playingRef = useRef<boolean>(true);
  const angleRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uAngleRef = useRef<WebGLUniformLocation | null>(null);
  const bufferRef = useRef<WebGLBuffer | null>(null);
  const [info, setInfo] = useState<GlInfo | null>(null);
  const [unavailable, setUnavailable] = useState<boolean>(false);
  const [failure, setFailure] = useState<RenderFailure | null>(null);
  const [spinning, setSpinning] = useState<boolean>(true);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /**
   * Start (or restart) the render loop. Always cancels any prior pending
   * frame first, so Pause→Resume can never stack a second loop. Rotation
   * continues from angleRef — the exact angle where it paused.
   */
  const startLoop = useCallback(
    (gl: WebGLRenderingContext, program: WebGLProgram, uAngle: WebGLUniformLocation | null) => {
      stopLoop();
      let last = performance.now();
      const frame = () => {
        if (!playingRef.current) {
          rafRef.current = null; // paused: idle, nothing scheduled
          return;
        }
        const now = performance.now();
        angleRef.current += ((now - last) / 1000) * ANGLE_PER_SECOND;
        last = now;
        gl.clearColor(0.043, 0.066, 0.102, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(uAngle, angleRef.current);
        gl.drawArrays(gl.TRIANGLES, 0, CUBE_VERTICES.length / 3);
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    },
    [stopLoop]
  );

  const handleToggle = useCallback(() => {
    const next = !playingRef.current;
    playingRef.current = next;
    setSpinning(next);
    if (next) {
      const gl = glRef.current;
      const program = programRef.current;
      if (gl && program) startLoop(gl, program, uAngleRef.current);
    } else {
      stopLoop();
    }
  }, [startLoop, stopLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      setUnavailable(true);
      onResultUpdate?.('unsupported', 'No WebGL context available — hardware acceleration may be disabled');
      return;
    }
    glRef.current = gl;

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

    // Render pipeline: validate compile + link BEFORE claiming success.
    const { program, failure: buildFailure } = buildCubeProgram(gl);
    if (!program || buildFailure) {
      setFailure(buildFailure ?? { kind: 'link', detail: 'program unavailable' });
      onResultUpdate?.('failed', `WebGL context exists but the render pipeline failed: ${buildFailure?.detail ?? 'unknown'}`);
      return; // nothing scheduled; no resources to release
    }
    programRef.current = program;
    gl.useProgram(program);

    const aPos = gl.getAttribLocation(program, 'aPos');
    if (aPos < 0) {
      setFailure({ kind: 'attrib', detail: 'aPos attribute not found in linked program' });
      onResultUpdate?.('failed', 'WebGL program linked but is missing the expected aPos attribute');
      gl.deleteProgram(program);
      programRef.current = null;
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(CUBE_VERTICES), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    bufferRef.current = buffer;

    const uAngle = gl.getUniformLocation(program, 'uAngle');
    uAngleRef.current = uAngle;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.CULL_FACE);

    // A verified pipeline that actually drew = honest passed verdict.
    onResultUpdate?.('passed', `WebGL ${isGl2 ? '2' : '1'} rendering verified — ${data.renderer}`);

    if (playingRef.current) startLoop(gl, program, uAngle);

    return () => {
      // Departure: stop animation work and release GPU resources.
      stopLoop();
      playingRef.current = true; // reset for a potential remount
      angleRef.current = 0;
      programRef.current = null;
      uAngleRef.current = null;
      if (bufferRef.current) {
        gl.deleteBuffer(bufferRef.current);
        bufferRef.current = null;
      }
      gl.deleteProgram(program);
    };
  }, [onResultUpdate, startLoop, stopLoop]);

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
      ) : failure ? (
        <div className="mt-5 p-6 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">WebGL context available, but rendering failed</p>
            <p className="mt-1 opacity-80 font-mono break-all">
              {failure.kind === 'compile' ? 'Shader compile error' : failure.kind === 'link' ? 'Program link error' : 'Pipeline error'}: {failure.detail}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 relative rounded-xl overflow-hidden border border-[#DFE5EB] dark:border-[#223043]">
            <canvas ref={canvasRef} className={`w-full h-[280px] block ${spinning ? '' : 'opacity-60'}`} />
            <button
              onClick={handleToggle}
              aria-pressed={!spinning}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {spinning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {spinning ? 'Pause rotation' : 'Resume rotation'}
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
