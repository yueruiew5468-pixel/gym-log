// 墨豹吉祥物：原圖用 WebGL 位移場做連續變形（呼吸、轉頭、尾巴、眨眼），大動作（舔掌、趴下）播預先處理好的影片格。
// 原始檔在 吉祥物動畫/panther.js，這份是 App 用的版本（素材在 mascot/，WebP）。
(function () {
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const SIZE = 1254; // 原圖邊長，所有座標用原圖像素

  // ---------- 時間曲線 ----------
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  // 關鍵格之間用 smootherstep 補間；關鍵格只放在極值，動作才不會頓
  const keys = (t, ks) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
        let x = (t - t0) / (t1 - t0);
        x = x * x * x * (x * (x * 6 - 15) + 10);
        return v0 + (v1 - v0) * x;
      }
    }
    return ks[ks.length - 1][1];
  };
  // 眨眼：快閉、短停、慢開
  const blink = (t, at) => {
    const d = t - at;
    if (d < 0 || d > 0.32) return 0;
    if (d < 0.08) return ease(d / 0.08);
    if (d < 0.12) return 1;
    return 1 - ease((d - 0.12) / 0.2);
  };
  // 在 [a,b] 間升到 1，[c,d] 間降回 0
  const hold = (t, a, b, c, d) => t < a || t > d ? 0 : t < b ? ease((t - a) / (b - a)) : t < c ? 1 : 1 - ease((t - c) / (d - c));

  // ---------- 各狀態的骨架與動作 ----------
  // region: c 影響中心, r0/r1 全權重→零權重半徑, m 半平面遮罩 [nx,ny,e0,e1], p 樞紐, L 長度（尾巴越遠彎越多）, k 波數
  // faces: 整張表情圖連身體一起換（只換頭會斷頭）；at() 回傳 face: [甲, 乙, 混合比]，'' 代表原圖
  // 臉在兩張表情間交叉淡入：放在動作最快的時候切，殘影才看不出來
  const faceMix = (t, ks) => {
    for (let i = 1; i < ks.length; i++) {
      const [t0, a] = ks[i - 1], [t1, b] = ks[i];
      if (t < t1) return t < t0 ? [a, a, 0] : [a, b, ease((t - t0) / (t1 - t0))];
    }
    const z = ks[ks.length - 1][1];
    return [z, z, 0];
  };
  const RIG = {
    idle: {
      img: 'idle.webp', T: 6.4, loop: true,
      faces: { half: 'yawn-half.webp', full: 'yawn-full.webp' },
      breath: { c: [640, 650], r: [300, 400] },
      eyes: [
        { c: [793, 215], r: [43, 15], tilt: 0.3, fur: [0, 34] },
        { c: [898, 219], r: [8, 14], tilt: 0, fur: [-16, 0] },
      ],
      head: { c: [790, 230], r0: 150, r1: 330, p: [660, 470] },
      tail: { c: [470, 1075], r0: 430, r1: 470, m: [1, 0, 400, 440], p: [470, 1075], L: 420, k: 0.011 },
      // n = 第幾輪；每三輪有一輪把轉頭換成打哈欠
      at(t, n) {
        const br = Math.sin(TAU * t / 3.2);
        if (n % 3 === 2) {
          // 哈欠：深吸一口，嘴慢慢張到最大停一下，再慢慢闔上；頭不單獨動，整隻一起
          const y = hold(t, 0.9, 1.8, 2.6, 3.4);
          return {
            breath: 0.011 * br + 0.012 * y,
            head: { a0: 0, off: [0, -3 * br] },
            tail: { a0: 0, a1: 0.13 * Math.sin(TAU * t / 6.4), a2: 0.06, ph: TAU * t * 2 / 6.4 },
            lid: Math.max(blink(t, 5.3), blink(t, 5.62)),
            face: faceMix(t, [[1.0, ''], [1.35, 'half'], [1.75, 'full'], [2.65, 'full'], [3.0, 'half'], [3.4, '']]),
          };
        }
        const look = hold(t, 1.0, 1.7, 3.5, 4.3);
        return {
          breath: 0.011 * br,
          head: { a0: -0.06 * look, off: [6 * look, -3 * br - 4 * look] },
          tail: { a0: 0, a1: 0.13 * Math.sin(TAU * t / 6.4) - 0.04 * look, a2: 0.06, ph: TAU * t * 2 / 6.4 },
          lid: Math.max(blink(t, 2.1), blink(t, 5.3), blink(t, 5.62)),
        };
      },
    },
    rest: {
      img: 'rest.webp', T: 8, loop: true,
      breath: { c: [520, 730], r: [440, 270] },
      eyes: [],
      head: { c: [1000, 560], r0: 170, r1: 320, p: [820, 760] },
      ear: { c: [875, 410], r0: 45, r1: 105, p: [885, 475] },
      tail: { c: [110, 900], r0: 100, r1: 220, m: [1, 0, 205, 255], p: [330, 980], L: 280, k: 0.015 },
      at(t) {
        // 吸氣慢、吐氣更慢
        const ph = (t % 4) / 4;
        const br = ph < 0.42 ? ease(ph / 0.42) : 1 - ease((ph - 0.42) / 0.58);
        const tw = keys(t, [[0, 0], [5.2, 0], [5.3, 1], [5.42, -0.3], [5.6, 0.5], [5.85, 0]]);
        return {
          breath: 0.016 * (br - 0.5),
          head: { a0: 0.006 * br, off: [0, -5 * br] },
          ear: { a0: -0.12 * tw, off: [0, 0] },
          tail: { a0: 0, a1: 0.02 * Math.sin(TAU * t / 8), a2: 0.012, ph: TAU * t / 4 },
          lid: 0,
        };
      },
    },
    pr: {
      img: 'pr.webp', T: 2.8, loop: false, spark: 0.5,
      anchor: [650, 1165],
      faces: { focus: 'pr-focus.webp', roar: 'pr-roar.webp', smirk: 'pr-smirk.webp' },
      breath: { c: [700, 650], r: [300, 420] },
      eyes: [
        { c: [822, 189], r: [41, 15], tilt: 0.26, fur: [0, 34] },
        { c: [921, 183], r: [7, 13], tilt: 0, fur: [-16, 0] },
      ],
      head: { c: [830, 210], r0: 150, r1: 330, p: [720, 460] },
      tail: { c: [395, 1030], r0: 520, r1: 560, m: [0.953, 0.306, 640, 680], p: [395, 1030], L: 520, k: 0.009 },
      at(t) {
        // 腳不離地：先吐氣微縮，再深吸挺胸、整隻從腳底等比例撐大一點，停住，再慢慢放鬆；頭不單獨動
        const br = t > 2.6 ? 0.008 * Math.sin(TAU * (t - 2.6) / 3.2) : 0;
        const k = 1 + keys(t, [[0, 0], [0.28, -0.008], [0.62, 0.018], [1.9, 0.014], [2.6, 0]]);
        return {
          global: { sx: k, sy: k, ty: 0 },
          breath: br + keys(t, [[0, 0], [0.28, -0.01], [0.62, 0.024], [1.9, 0.018], [2.6, 0]]),
          head: { a0: 0, off: [0, 0] },
          tail: {
            a0: 0,
            a1: keys(t, [[0, 0], [0.28, 0.05], [0.62, -0.16], [0.95, -0.1], [1.9, -0.12], [2.6, 0]]),
            a2: keys(t, [[0, 0.02], [0.5, 0.05], [1.4, 0.03], [2.6, 0.02]]), ph: TAU * t * 1.2,
          },
          lid: 0,
          // 低頭時瞇眼蓄力 → 抬頭瞬間怒吼 → 收嘴冷笑停住
          face: faceMix(t, [[0.04, ''], [0.24, 'focus'], [0.4, 'focus'], [0.52, 'roar'], [1.55, 'roar'], [1.85, 'smirk']]),
        };
      },
    },
  };

  // ---------- WebGL ----------
  const VS = `attribute vec2 a; varying vec2 vP; uniform float S;
    void main(){ vP = vec2(a.x*.5+.5, .5-a.y*.5)*S; gl_Position = vec4(a,0.,1.); }`;
  const FS = `precision highp float;
    varying vec2 vP; uniform sampler2D T; uniform sampler2D T2; uniform float MIX; uniform float S;
    uniform vec4 G; uniform vec2 GT;            // 整體：錨點、縮放、位移
    uniform vec4 B; uniform float BA;            // 呼吸：中心、半徑、幅度
    uniform vec4 Rc[3]; uniform vec4 Rm[3]; uniform vec4 Rp[3]; uniform vec4 Ra[3]; uniform vec2 Ro[3];
    uniform vec4 E[2]; uniform vec4 Ef[2]; uniform float LID;
    mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
    vec4 tex(vec2 p){ vec2 u = clamp(p/S, 0., 1.); return mix(texture2D(T, u), texture2D(T2, u), MIX); }
    float weight(vec4 c, vec4 m, vec2 p){
      float w = 1. - smoothstep(c.z, c.w, length(p - c.xy));
      if (m.x != 0. || m.y != 0.) w *= 1. - smoothstep(m.z, m.w, dot(p, m.xy));
      return w;
    }
    vec2 bend(vec4 pv, vec4 a, vec2 o, vec2 p, float w){
      p -= o * w;
      vec2 q = p - pv.xy; float d = length(q); float u = d / pv.z;
      float ang = (a.x + a.y * u + a.z * u * sin(a.w - pv.w * d)) * w;
      return pv.xy + rot(-ang) * q;
    }
    void main(){
      vec2 p0 = G.xy + (vP - G.xy - GT) / G.zw;
      // 頭、耳：平滑權重直接彎
      vec2 p = p0;
      p = bend(Rp[0], Ra[0], Ro[0], p, weight(Rc[0], Rm[0], p));
      p = bend(Rp[2], Ra[2], Ro[2], p, weight(Rc[2], Rm[2], p));
      vec2 bd = (p - B.xy) / B.zw;
      float bw = 1. - smoothstep(0., 1., length(bd));
      p -= (p - B.xy) * BA * bw;
      // 尾巴：當成獨立圖層，從原圖剪出尾巴區域整條彎，再疊回身體上，才不會把身體拖出殘影
      vec2 pt = bend(Rp[1], Ra[1], Ro[1], p0, 1.);
      vec4 tail = tex(pt) * weight(Rc[1], Rm[1], pt);
      vec4 col = tex(p) * (1. - weight(Rc[1], Rm[1], p));
      col = tail + col * (1. - tail.a);
      for (int i = 0; i < 2; i++) {
        if (E[i].z == 0. || LID <= 0.001) continue;
        vec2 e = rot(-Ef[i].z) * (p - E[i].xy);
        float h = sqrt(max(0., 1. - (e.x*e.x)/(E[i].z*E[i].z)));
        float top = -E[i].w * h, lidY = top + LID * 2. * E[i].w * h;
        float inEye = 1. - smoothstep(.9, 1.06, length(e / E[i].zw));
        float above = 1. - smoothstep(lidY - .8, lidY + .8, e.y);
        vec4 fur = tex(p + Ef[i].xy);
        col = mix(col, fur, inEye * above);
        float lash = (1. - smoothstep(.6, 2.2, abs(e.y - lidY))) * inEye * smoothstep(.02, .15, LID);
        col.rgb = mix(col.rgb, vec3(.03) * col.a, lash * .85);
      }
      gl_FragColor = col;
    }`;

  const cache = {};
  const loadImg = name => cache[name] || (cache[name] = new Promise((ok, no) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = BASE + name;
  }));

  const loadFaces = f => Promise.all(Object.entries(f).map(async ([k, name]) => [k, await loadImg(name)])).then(Object.fromEntries);

  function create(canvas, fxCanvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['S', 'G', 'GT', 'B', 'BA', 'Rc', 'Rm', 'Rp', 'Ra', 'Ro', 'E', 'Ef', 'LID', 'T', 'T2', 'MIX'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1f(U.S, SIZE); gl.uniform1i(U.T, 0); gl.uniform1i(U.T2, 1);
    const texs = {};
    const fx = fxCanvas ? fxCanvas.getContext('2d') : null;

    const api = { state: null, speed: 1 };
    let rig, faces = {}, opts = {}, t = 0, last = 0, raf = 0, sparks = [], loop = null, paused = false;

    function fit() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr) || 1;
      if (canvas.width !== w || canvas.height !== w) { canvas.width = canvas.height = w; Object.keys(texs).forEach(k => delete texs[k]); }
      if (fxCanvas && (fxCanvas.width !== w || fxCanvas.height !== w)) fxCanvas.width = fxCanvas.height = w;
      gl.viewport(0, 0, w, w);
    }
    // 先把原圖用高品質縮到畫布大小再上傳，小尺寸也不會鋸齒
    function textureFor(im, key) {
      if (texs[key]) return texs[key];
      const px = Math.min(SIZE, canvas.width * 1.5);
      let src = im, cur = SIZE;
      while (cur / 2 > px) {
        cur = Math.round(cur / 2);
        const c = document.createElement('canvas'); c.width = c.height = cur;
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, cur, cur); src = c;
      }
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texs[key] = tx;
    }

    function draw(im) {
      fit();
      const loopT = rig.loop ? t % rig.T : t;
      // 破紀錄播完後接著呼吸
      const v = rig.at(rig.loop ? loopT : Math.min(t, rig.T + 50), Math.floor(t / rig.T));
      const g = v.global || { sx: 1, sy: 1, ty: 0 };
      const an = rig.anchor || [627, 1160];
      gl.uniform4f(U.G, an[0], an[1], g.sx, g.sy);
      gl.uniform2f(U.GT, 0, g.ty + (opts.dy || 0));
      gl.uniform4f(U.B, rig.breath.c[0], rig.breath.c[1], rig.breath.r[0], rig.breath.r[1]);
      gl.uniform1f(U.BA, v.breath);
      const Rc = [], Rm = [], Rp = [], Ra = [], Ro = [];
      ['head', 'tail', 'ear'].forEach(k => {
        const r = rig[k], m = v[k];
        if (!r || !m) { Rc.push(0, 0, 0, 1); Rm.push(0, 0, 0, 0); Rp.push(0, 0, 1, 0); Ra.push(0, 0, 0, 0); Ro.push(0, 0); return; }
        Rc.push(r.c[0], r.c[1], r.r0, r.r1);
        Rm.push(...(r.m || [0, 0, 0, 0]));
        Rp.push(r.p[0], r.p[1], r.L || 1, r.k || 0);
        Ra.push(m.a0 || 0, m.a1 || 0, m.a2 || 0, m.ph || 0);
        // 從影片接進來時，頭先停在影片結尾的位置，再回到原圖位置。
        // 影片結尾頭還在動，所以用減速曲線（一開始就有速度）接住，不會先停一下再起步
        const hx = clamp((t - (opts.t0 || 0)) / (opts.headTime || 0.8), 0, 1);
        const hf = k === 'head' && opts.headFrom ? (1 - hx) * (1 - hx) : 0;
        Ro.push((m.off || [0, 0])[0] + (hf ? opts.headFrom[0] * hf : 0), (m.off || [0, 0])[1] + (hf ? opts.headFrom[1] * hf : 0));
      });
      gl.uniform4fv(U.Rc, Rc); gl.uniform4fv(U.Rm, Rm); gl.uniform4fv(U.Rp, Rp); gl.uniform4fv(U.Ra, Ra); gl.uniform2fv(U.Ro, Ro);
      const E = [], Ef = [];
      for (let i = 0; i < 2; i++) {
        const e = rig.eyes[i];
        if (e) { E.push(e.c[0], e.c[1], e.r[0], e.r[1]); Ef.push(e.fur[0], e.fur[1], e.tilt, 0); }
        else { E.push(0, 0, 0, 0); Ef.push(0, 0, 0, 0); }
      }
      gl.uniform4fv(U.E, E); gl.uniform4fv(U.Ef, Ef); gl.uniform1f(U.LID, v.lid || 0);
      const [fa, fb, mix] = v.face || ['', '', 0];
      const img = f => f ? faces[f] : im;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textureFor(img(fb), rig.img + fb));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textureFor(img(fa), rig.img + fa));
      gl.uniform1f(U.MIX, mix);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (fx) drawSparks();
    }

    // 破紀錄的萊姆綠光點：從胸口往外散開後淡出
    function makeSparks() {
      sparks = [];
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i / 16 - 0.5) * Math.PI * 1.7 + (Math.random() - 0.5) * 0.25;
        sparks.push({ a, d: 300 + Math.random() * 220, s: 7 + Math.random() * 9, delay: Math.random() * 0.08 });
      }
    }
    function drawSparks() {
      const w = fxCanvas.width, k = w / SIZE;
      fx.clearRect(0, 0, w, w);
      if (!rig.spark || t < rig.spark || t > rig.spark + 1.4) return;
      const o = [740, 420];
      const rt = t - rig.spark;
      // 身後一圈柔和的萊姆綠光暈，光點從背後散出（畫在角色後面那層）
      const gl1 = rt < 0.25 ? ease(rt / 0.25) : 1 - ease((rt - 0.25) / 1.15);
      const gr = fx.createRadialGradient(o[0] * k, o[1] * k, 0, o[0] * k, o[1] * k, 520 * k);
      gr.addColorStop(0, `rgba(212,255,58,${0.22 * gl1})`);
      gr.addColorStop(1, 'rgba(212,255,58,0)');
      fx.fillStyle = gr; fx.fillRect(0, 0, w, w);
      sparks.forEach(s => {
        const x = clamp((rt - s.delay) / 1.2, 0, 1);
        if (x <= 0 || x >= 1) return;
        const out = 1 - Math.pow(1 - x, 3);
        const r = (200 + s.d * out) * k;
        const al = x < 0.15 ? x / 0.15 : 1 - ease((x - 0.15) / 0.85);
        const px = o[0] * k + Math.cos(s.a) * r, py = o[1] * k + Math.sin(s.a) * r + 40 * x * x * k;
        const sz = s.s * 2.4 * k * (1 - 0.5 * x);
        fx.fillStyle = `rgba(212,255,58,${al})`;
        fx.beginPath();
        fx.moveTo(px, py - sz * 1.6); fx.quadraticCurveTo(px, py, px + sz, py);
        fx.quadraticCurveTo(px, py, px, py + sz * 1.6); fx.quadraticCurveTo(px, py, px - sz, py);
        fx.quadraticCurveTo(px, py, px, py - sz * 1.6); fx.fill();
      });
    }

    // opts.dy：整張往下移（趴姿要跟坐姿同一條地面）；opts.headFrom：頭的起始位移 [dx, dy]（原圖像素）
    // opts.t0：從第幾秒開始播（例如趴姿從呼吸的中間點開始，身體大小才跟原圖一樣）
    api.play = async (name, o = {}) => {
      api.state = name;
      const r = RIG[name];
      const im = await loadImg(r.img);
      const fs = r.faces ? await loadFaces(r.faces) : {};
      if (api.state !== name) return;
      rig = r; faces = fs; opts = o; t = o.t0 || 0; last = 0;
      if (fx) makeSparks();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      cancelAnimationFrame(raf);
      return new Promise(ok => {
        let first = true, loopN = Math.floor(t / r.T);
        const tick = now => {
          if (last) t += Math.min(0.05, (now - last) / 1000) * api.speed;
          if (api.seek != null) t = api.seek;
          last = now;
          draw(im);
          if (first) { first = false; ok(); }
          const n = Math.floor(t / r.T);
          if (r.loop && n !== loopN) { loopN = n; if (api.onLoop) api.onLoop(n); }
          if (!reduce) raf = requestAnimationFrame(tick);
        };
        loop = tick; paused = false;
        raf = requestAnimationFrame(tick);
      });
    };
    api.time = () => t;
    // 暫停／繼續（切到別的分頁時用，不用銷毀重建，切回來不會閃）
    api.pause = () => { cancelAnimationFrame(raf); paused = true; };
    api.resume = () => { if (!paused || !loop) return; paused = false; last = 0; raf = requestAnimationFrame(loop); };
    // 停止並釋放 WebGL（手機同時能開的 WebGL 數量有限）
    api.stop = () => {
      cancelAnimationFrame(raf); api.state = null;
      document.removeEventListener('visibilitychange', onVis);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    };
    // 離開畫面時停播，回來時接續
    const onVis = () => { last = 0; };
    document.addEventListener('visibilitychange', onVis);
    return api;
  }

  window.Panther = { create, RIG };
})();

// ---------- 場景控制：把即時動畫和影片片段接起來 ----------
(function () {
  const P = window.Panther;
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  // 影片在原始 1920×1080 畫面裡的範圍：正方形舞台 x 420–1500，寬舞台 x 280–1620（趴下的動作比正方形寬）
  const SQ = {x: 420, w: 1080}, WIDE = {x: 280, w: 1340};
  // 趴姿：往下 140 跟坐姿同一條地面；呼吸從中間點開始；影片結尾頭差一點，接手後 0.8 秒放回原位
  const REST_IN = {dy: 140, headFrom: [-10, -6], headTime: 0.8, t0: 0.84};

  // 影片片段檔：'PNTR' + JSON 長度 + JSON + 每格 WebP
  const clips = {};
  const loadClip = name => clips[name] || (clips[name] = fetch(BASE + name + '.bin')
    .then(r => { if (!r.ok) throw r.status; return r.arrayBuffer(); })
    .then(async buf => {
      const n = new DataView(buf).getUint32(4), m = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n)));
      m.img = await Promise.all(m.frames.map(async ([o, l]) => {
        const im = new Image();
        im.src = URL.createObjectURL(new Blob([new Uint8Array(buf, 8 + n + o, l)], {type: 'image/webp'}));
        await im.decode().catch(() => {});
        return im;
      }));
      return m;
    })
    .catch(e => { delete clips[name]; throw e; }));

  function mount(el, {wide = false} = {}) {
    const stage = wide ? WIDE : SQ;
    el.classList.add('pt-stage'); el.classList.toggle('wide', wide);
    el.innerHTML = '<canvas class="pt-fx"></canvas><canvas class="pt-gl"></canvas><canvas class="pt-clip"></canvas>';
    const [fxc, glc, cc] = el.querySelectorAll('canvas');
    const eng = P.create(glc, fxc), cg = cc.getContext('2d');
    let raf = 0, dead = false, job = 0;
    const fitClip = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(cc.clientWidth * dpr) || 1, h = Math.round(cc.clientHeight * dpr) || 1;
      if (cc.width !== w || cc.height !== h) { cc.width = w; cc.height = h; }
    };
    // 畫影片的第 fp 格（有小數就跟下一格交疊，24fps 看起來也順）
    const drawFrame = (m, fp, alpha) => {
      fitClip(); cg.clearRect(0, 0, cc.width, cc.height);
      if (alpha <= 0) return;
      const k = cc.width / stage.w, dx = (m.cropX - stage.x) * k, dw = m.cropW * k, dh = cc.height;
      const n = m.img.length, i0 = Math.max(0, Math.min(n - 1, Math.floor(fp))), i1 = Math.min(n - 1, i0 + 1), a = Math.max(0, Math.min(1, fp - i0));
      cg.globalAlpha = alpha; cg.drawImage(m.img[i0], dx, 0, dw, dh);
      if (a > 0.01 && i1 !== i0) { cg.globalAlpha = alpha * a; cg.drawImage(m.img[i1], dx, 0, dw, dh); }
      cg.globalAlpha = 1;
    };
    // 播一段影片：fadeIn 秒先停在第一格淡入（蓋過底下的即時動畫），播完 fadeOut 秒內淡出（露出底下已接手的即時動畫）
    // near：結束前 0.3 秒呼叫（讓即時動畫先在背後準備好）；end：影片最後一格時呼叫
    const clip = (m, {reverse = false, fadeIn = 2 / 24, fadeOut = 0.4, near, end} = {}) => new Promise(done => {
      const my = ++job, n = m.img.length, D = n / m.fps;
      let t0 = 0, nearDone = false, endDone = false;
      cancelAnimationFrame(raf);
      const step = now => {
        if (dead || my !== job) return done(false);
        if (!t0) t0 = now;
        const e = (now - t0) / 1000;
        const t = Math.min(D, Math.max(0, e - fadeIn));
        const fp = reverse ? n - 1 - (t * m.fps) : t * m.fps - 0.5;
        if (e >= fadeIn && !endDone) glc.style.visibility = 'hidden';
        if (!nearDone && t >= D - 0.3) { nearDone = true; if (near) near(); }
        if (t >= D && !endDone) { endDone = true; glc.style.visibility = 'visible'; if (end) end(); }
        const after = e - fadeIn - D;
        const alpha = e < fadeIn ? smooth(e / fadeIn) : after > 0 ? 1 - smooth(after / fadeOut) : 1;
        drawFrame(m, Math.max(0, Math.min(n - 1, fp)), alpha);
        if (after >= fadeOut) { cg.clearRect(0, 0, cc.width, cc.height); return done(true); }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    const api = {
      // 坐著待機；lick=true 時每四輪有一輪換成舔掌（影片），每三輪打一次哈欠（即時動畫裡）
      async idle({lick = false} = {}) {
        job++; eng.onLoop = null; glc.style.visibility = 'visible';
        await eng.play('idle');
        if (!lick || reduce()) return;
        loadClip('lick').catch(() => {});
        eng.onLoop = async n => {
          if (n % 4 !== 1 || dead) return;
          let m; try { m = await loadClip('lick'); } catch (e) { return; }
          if (dead || eng.state !== 'idle') return;
          // 停在這輪的起點（姿勢就是原圖），舔完再從這裡繼續
          eng.seek = n * P.RIG.idle.T;
          await clip(m, {fadeOut: 0.4, end: () => { eng.seek = null; }});
        };
      },
      // 破紀錄：蓄力 → 怒吼＋綠光 → 冷笑停住
      pr() { job++; eng.onLoop = null; glc.style.visibility = 'visible'; return eng.play('pr'); },
      // 坐下 → 趴下，接著趴著呼吸
      async lieDown() {
        job++; eng.onLoop = null;
        if (reduce()) return eng.play('rest', {dy: REST_IN.dy, t0: REST_IN.t0});
        let m; try { m = await loadClip('lie'); } catch (e) { return eng.play('rest', {dy: REST_IN.dy, t0: REST_IN.t0}); }
        if (dead) return;
        drawFrame(m, 0, 1); glc.style.visibility = 'hidden';
        // 影片跟原圖的細節畫法不同，結尾讓最後一格在趴姿動畫上 0.8 秒淡出
        await clip(m, {fadeIn: 0, fadeOut: 0.8,
          near: () => { eng.play('rest', REST_IN); eng.seek = REST_IN.t0; },
          end: () => { eng.seek = null; }});
      },
      // 坐著不動（停在原圖姿勢），等一下要接趴下時用，切過去才不會跳
      sit() { job++; eng.onLoop = null; glc.style.visibility = 'visible'; const p = eng.play('idle'); eng.seek = 0; return p; },
      // 直接趴著呼吸（不播趴下過程）
      rest() { job++; eng.onLoop = null; glc.style.visibility = 'visible'; return eng.play('rest', {dy: REST_IN.dy, t0: REST_IN.t0}); },
      // 趴下影片倒著播 = 坐起來，接回待機
      async standUp() {
        job++; eng.onLoop = null;
        if (reduce()) return eng.play('idle');
        let m; try { m = await loadClip('lie'); } catch (e) { return eng.play('idle'); }
        if (dead) return;
        await clip(m, {reverse: true, fadeIn: 0.4, fadeOut: 0.4,
          near: () => { eng.play('idle'); eng.seek = 0; },
          end: () => { eng.seek = null; }});
      },
      pause: () => eng.pause(),
      resume: () => eng.resume(),
      preload: name => loadClip(name).catch(() => {}),
      destroy() { dead = true; job++; cancelAnimationFrame(raf); eng.stop(); el.innerHTML = ''; el.classList.remove('pt-stage', 'wide'); },
    };
    return api;
  }

  window.Mascot = {mount, preload: name => loadClip(name).catch(() => {})};
})();
