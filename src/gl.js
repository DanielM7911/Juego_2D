// ============================================================================
// gl.js  —  Utilidades WebGL 1 para dibujar RECTÁNGULOS 2D (como sprites)
// ----------------------------------------------------------------------------
// Este módulo expone:
//   - createGL(canvas): inicializa WebGL, compila shaders y devuelve helpers:
//       { gl, clear(), drawRects(verts, color), resize() }
//   - pushRect(verts, x, y, w, h): agrega 2 triángulos (un rectángulo) al
//       arreglo 'verts' en coordenadas de PIXELES (no NDC).
//
// NOTA: Dibujamos todo con un shader súper simple de color sólido.
//       El vértice se normaliza a clip-space en el VS usando u_resolution.
// ============================================================================

export function createGL(canvas) {
  // Obtenemos un contexto WebGL 1 sin profundidad ni transparencias
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
  if (!gl) throw new Error('WebGL no soportado');

  // --- Vertex Shader: convierte coordenadas en px -> clip-space (-1..1)
  const vsSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    void main() {
      // 1) Normalizamos de píxeles (0..res) a 0..1
      vec2 zeroToOne = a_position / u_resolution;
      // 2) Pasamos 0..1 a 0..2
      vec2 zeroToTwo = zeroToOne * 2.0;
      // 3) Ajustamos a -1..+1 y volteamos Y (WebGL tiene Y hacia arriba)
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
  `;

  // --- Fragment Shader: pinta un color sólido por píxel
  const fsSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() { gl_FragColor = u_color; }
  `;

  // Compilación y enlace de shaders
  function compile(type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader error: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  const vs = compile(gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl.FRAGMENT_SHADER, fsSource);

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Link error: ' + gl.getProgramInfoLog(program));
  }

  // Ubicaciones de atributos/uniformes
  const a_position = gl.getAttribLocation(program, 'a_position');
  const u_resolution = gl.getUniformLocation(program, 'u_resolution');
  const u_color = gl.getUniformLocation(program, 'u_color');

  // Buffer compartido para subir vértices (x,y) en formato Float32
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

  // Config inicial de programa + resolución
  gl.useProgram(program);
  gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);

  // Ajusta viewport y uniform de resolución (por si cambia tamaño de canvas)
  function resize() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);
  }

  // Limpia la pantalla con un fondo azul oscuro
  function clear() {
    gl.clearColor(0.04, 0.08, 0.22, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Dibuja uno o varios rectángulos: 'verts' es un arreglo plano [x,y,x,y...]
  // 'color' es [r,g,b,a] en 0..1. Cada 6 pares (12 floats) = 2 triángulos = 1 rect.
  function drawRects(verts, color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.useProgram(program);
    gl.uniform4fv(u_color, color);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);
  }

  return { gl, clear, drawRects, resize };
}

// ---------------------------------------------------------------------------
// pushRect(verts, x, y, w, h)
// Agrega a 'verts' los 6 vértices (2 triángulos) que forman un rectángulo
// con esquina superior izquierda en (x,y) y tamaño w x h en píxeles.
// ---------------------------------------------------------------------------
export function pushRect(verts, x, y, w, h) {
  const x1 = x,     y1 = y;
  const x2 = x + w, y2 = y + h;
  verts.push(
    // Triángulo 1
    x1, y1,  x2, y1,  x1, y2,
    // Triángulo 2
    x1, y2,  x2, y1,  x2, y2
  );
}
