/**
 * Whether this browser can draw WebGL, checked ONCE per page load.
 *
 * Each check makes a WebGL context. Browsers allow only a few at a time (Firefox drops the
 * oldest past its limit), and the landing page already runs several 3D scenes, so repeated
 * checks (for example on every window resize) used to push the real scenes out and leave the
 * page on its flat fallbacks. Here the answer is cached and the test context is released.
 */
let cached: boolean | null = null;

export function webglSupported(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    cached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
