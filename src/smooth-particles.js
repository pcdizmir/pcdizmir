import * as THREE from 'three';

/**
 * Continuous WebGL Particle Engine with Chromatic Aberration & Triggered Glitch Effects.
 * Features RGB color fringe splitting, scanline slice displacement, digital jitter, and interactive triggers.
 */
export class SmoothParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = 256; // 65,536 particles
    this.count = this.size * this.size;

    this.mouse = new THREE.Vector3(0, 0, 0);
    this.targetMouse = new THREE.Vector3(0, 0, 0);

    this.scrollProgress = 0;
    this.targetScrollProgress = 0;
    this.lastScrollY = window.scrollY;

    // Glitch & Chromatic Aberration State
    this.glitchIntensity = 0;
    this.lastGlitchTimer = 0;

    this.init();
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 26;

    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.simScene.add(this.simQuad);

    const options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    };

    this.posTargetA = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.posTargetB = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.velTargetA = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.velTargetB = new THREE.WebGLRenderTarget(this.size, this.size, options);

    // Continuous 3D Volume Distribution
    const posData = new Float32Array(this.count * 4);
    const velData = new Float32Array(this.count * 4);

    for (let i = 0; i < this.count; i++) {
      const i4 = i * 4;

      posData[i4 + 0] = (Math.random() - 0.5) * 44; // X
      posData[i4 + 1] = (Math.random() - 0.5) * 60; // Y
      posData[i4 + 2] = (Math.random() - 0.5) * 16; // Z
      posData[i4 + 3] = Math.random();             // Random attribute

      velData[i4 + 0] = (Math.random() - 0.5) * 0.02;
      velData[i4 + 1] = (Math.random() - 0.5) * 0.02;
      velData[i4 + 2] = (Math.random() - 0.5) * 0.02;
      velData[i4 + 3] = 1.0;
    }

    const posDataTex = new THREE.DataTexture(posData, this.size, this.size, THREE.RGBAFormat, THREE.FloatType);
    posDataTex.needsUpdate = true;

    const velDataTex = new THREE.DataTexture(velData, this.size, this.size, THREE.RGBAFormat, THREE.FloatType);
    velDataTex.needsUpdate = true;

    this.copyTexture(posDataTex, this.posTargetA);
    this.copyTexture(posDataTex, this.posTargetB);
    this.copyTexture(velDataTex, this.velTargetA);
    this.copyTexture(velDataTex, this.velTargetB);

    this.createMaterials();
    this.createParticles();

    // Fast-forward initial simulation
    this.fastForwardSim(980);

    // Event Listeners for Interaction & Glitch Triggers
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('touchmove', this.onTouchMove.bind(this));
    window.addEventListener('scroll', this.onScroll.bind(this));

    // Interactive Click, Tap & Key Glitch Triggers
    window.addEventListener('click', () => this.triggerGlitch(0.85));
    window.addEventListener('touchstart', () => this.triggerGlitch(0.85), { passive: true });
    window.addEventListener('keydown', () => this.triggerGlitch(0.75));

    this.clock = new THREE.Clock();
  }

  triggerGlitch(amount = 1.0) {
    this.glitchIntensity = Math.min(1.6, this.glitchIntensity + amount);
  }

  copyTexture(texture, target) {
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const scene = new THREE.Scene();
    scene.add(quad);
    this.renderer.setRenderTarget(target);
    this.renderer.render(scene, this.simCamera);
    this.renderer.setRenderTarget(null);
  }

  fastForwardSim(steps) {
    const dt = 0.016;
    for (let i = 0; i < steps; i++) {
      const time = i * dt;
      this.simQuad.material = this.velMaterial;
      this.velMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
      this.velMaterial.uniforms.u_velTexture.value = this.velTargetA.texture;
      this.velMaterial.uniforms.u_time.value = time;
      this.velMaterial.uniforms.u_dt.value = dt;
      this.velMaterial.uniforms.u_mouse.value = this.mouse;
      this.velMaterial.uniforms.u_scrollProgress.value = 0;

      this.renderer.setRenderTarget(this.velTargetB);
      this.renderer.render(this.simScene, this.simCamera);

      this.simQuad.material = this.posMaterial;
      this.posMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
      this.posMaterial.uniforms.u_velTexture.value = this.velTargetB.texture;
      this.posMaterial.uniforms.u_dt.value = dt;

      this.renderer.setRenderTarget(this.posTargetB);
      this.renderer.render(this.simScene, this.simCamera);

      let tmp = this.posTargetA;
      this.posTargetA = this.posTargetB;
      this.posTargetB = tmp;

      tmp = this.velTargetA;
      this.velTargetA = this.velTargetB;
      this.velTargetB = tmp;
    }
  }

  createMaterials() {
    this.velMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_time: { value: 0 },
        u_dt: { value: 0 },
        u_mouse: { value: this.mouse },
        u_scrollProgress: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_posTexture;
        uniform sampler2D u_velTexture;
        uniform float u_time;
        uniform float u_dt;
        uniform vec3 u_mouse;
        uniform float u_scrollProgress;
        varying vec2 vUv;

        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod(i, 289.0);
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        vec3 curlNoise(vec3 p) {
          float e = 0.1;
          float n1 = snoise(p + vec3(e, 0.0, 0.0));
          float n2 = snoise(p - vec3(e, 0.0, 0.0));
          float n3 = snoise(p + vec3(0.0, e, 0.0));
          float n4 = snoise(p - vec3(0.0, e, 0.0));
          float n5 = snoise(p + vec3(0.0, 0.0, e));
          float n6 = snoise(p - vec3(0.0, 0.0, e));

          float x = (n4 - n3) - (n6 - n5);
          float y = (n6 - n5) - (n2 - n1);
          float z = (n2 - n1) - (n4 - n3);

          return normalize(vec3(x, y, z));
        }

        void main() {
          vec4 pos = texture2D(u_posTexture, vUv);
          vec4 vel = texture2D(u_velTexture, vUv);

          vec3 noiseForce = curlNoise(pos.xyz * 0.06 + vec3(u_time * 0.03)) * 0.06;
          
          vec3 mDiff = pos.xyz - u_mouse;
          float mDist = length(mDiff);
          vec3 mouseForce = vec3(0.0);
          if (mDist < 9.0 && mDist > 0.01) {
            float force = (1.0 - mDist / 9.0) * 0.35;
            mouseForce = normalize(mDiff) * force;
          }

          vec3 newVel = vel.xyz * 0.95 + (noiseForce + mouseForce) * u_dt;
          
          gl_FragColor = vec4(newVel, 1.0);
        }
      `
    });

    this.posMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_dt: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D u_posTexture;
        uniform sampler2D u_velTexture;
        uniform float u_dt;
        varying vec2 vUv;

        void main() {
          vec4 pos = texture2D(u_posTexture, vUv);
          vec4 vel = texture2D(u_velTexture, vUv);

          vec3 newPos = pos.xyz + vel.xyz * (u_dt * 6.0);

          float halfWidth = 22.0;
          float halfHeight = 30.0;
          float halfDepth = 8.0;

          if (newPos.x > halfWidth) newPos.x -= halfWidth * 2.0;
          if (newPos.x < -halfWidth) newPos.x += halfWidth * 2.0;

          if (newPos.y > halfHeight) newPos.y -= halfHeight * 2.0;
          if (newPos.y < -halfHeight) newPos.y += halfHeight * 2.0;

          if (newPos.z > halfDepth) newPos.z -= halfDepth * 2.0;
          if (newPos.z < -halfDepth) newPos.z += halfDepth * 2.0;

          gl_FragColor = vec4(newPos, pos.w);
        }
      `
    });

    // Particle Render Material with Chromatic Aberration & Glitch
    this.renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_scrollProgress: { value: 0 },
        u_glitchIntensity: { value: 0 },
        u_chromaticAberration: { value: 0.04 },
        u_time: { value: 0 }
      },
      vertexShader: `
        uniform sampler2D u_posTexture;
        uniform sampler2D u_velTexture;
        uniform float u_scrollProgress;
        uniform float u_glitchIntensity;
        uniform float u_time;
        attribute vec2 reference;
        varying float vAlpha;

        float hash(float n) { return fract(sin(n) * 43758.5453123); }

        void main() {
          vec4 pos = texture2D(u_posTexture, reference);
          vec3 transformedPos = pos.xyz;
          
          transformedPos.y += (u_scrollProgress - 0.5) * 35.0;
          transformedPos.x += sin(transformedPos.y * 0.1 + u_scrollProgress * 6.283) * 1.5;

          // Triggered Glitch: Scanline slicing & digital jitter displacement
          if (u_glitchIntensity > 0.01) {
            float sliceId = floor(transformedPos.y * 2.0);
            float sliceNoise = hash(sliceId + floor(u_time * 16.0));
            if (sliceNoise > 0.6) {
              float shift = (hash(sliceId * 3.7 + u_time) - 0.5) * 2.0;
              transformedPos.x += shift * u_glitchIntensity * 5.0;
              transformedPos.z += (hash(sliceId * 7.1) - 0.5) * u_glitchIntensity * 3.0;
            }
            float jitter = (hash(reference.x * 120.0 + u_time * 28.0) - 0.5) * 0.45 * u_glitchIntensity;
            transformedPos.x += jitter;
            transformedPos.y += jitter * 0.5;
          }

          vec4 mvPosition = modelViewMatrix * vec4(transformedPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float sizeBoost = 1.0 + u_glitchIntensity * 0.35 * hash(reference.y * 60.0 + u_time);
          gl_PointSize = (125.0 / -mvPosition.z) * sizeBoost;
          vAlpha = smoothstep(26.0, 4.0, length(transformedPos.xz));
        }
      `,
      fragmentShader: `
        uniform float u_glitchIntensity;
        uniform float u_chromaticAberration;
        varying float vAlpha;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);

          // Chromatic Aberration channel offsets (horizontal separation)
          vec2 chromOffset = vec2(u_chromaticAberration, u_chromaticAberration * 0.22);

          float distR = length(coord - chromOffset);
          float distG = length(coord);
          float distB = length(coord + chromOffset);

          if (min(min(distR, distG), distB) > 0.5) discard;

          float rAlpha = smoothstep(0.48, 0.06, distR);
          float gAlpha = smoothstep(0.48, 0.06, distG);
          float bAlpha = smoothstep(0.48, 0.06, distB);

          // Subtractive / Channel Separation on White Canvas:
          // Where channels separate, fringes turn vivid Cyan (0, 1, 1) and Magenta/Red (1, 0, 0.4).
          // Where all channels overlap, solid black (0, 0, 0) core is formed.
          vec3 rgb = vec3(1.0 - rAlpha, 1.0 - gAlpha, 1.0 - bAlpha);
          float overallAlpha = max(max(rAlpha, gAlpha), bAlpha) * 0.72 * vAlpha;

          gl_FragColor = vec4(rgb, overallAlpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });
  }

  createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const references = new Float32Array(this.count * 2);

    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        const index = i * this.size + j;
        positions[index * 3 + 0] = 0;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = 0;

        references[index * 2 + 0] = (j + 0.5) / this.size;
        references[index * 2 + 1] = (i + 0.5) / this.size;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('reference', new THREE.BufferAttribute(references, 2));

    this.particleMesh = new THREE.Points(geometry, this.renderMaterial);
    this.scene.add(this.particleMesh);
  }

  onMouseMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.targetMouse.set(x * 14, y * 8, 0);
  }

  onTouchMove(e) {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = (touch.clientX / window.innerWidth) * 2 - 1;
      const y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.targetMouse.set(x * 14, y * 8, 0);
    }
  }

  onScroll() {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    
    this.targetScrollProgress = docHeight > 0 ? window.scrollY / docHeight : 0;

    // Trigger subtle glitch on quick scrolling
    const currentY = window.scrollY;
    const deltaY = currentY - this.lastScrollY;
    this.lastScrollY = currentY;

    if (Math.abs(deltaY) > 35) {
      this.triggerGlitch(Math.min(0.75, Math.abs(deltaY) * 0.012));
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();

    this.mouse.lerp(this.targetMouse, 0.04);
    this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.04;

    // Periodic subtle digital glitch pulse (every 4.5 - 6 seconds)
    if (time - this.lastGlitchTimer > 5.0 + Math.sin(time) * 1.5) {
      this.triggerGlitch(0.45 + Math.random() * 0.35);
      this.lastGlitchTimer = time;
    }

    // Smooth exponential decay of glitch intensity
    this.glitchIntensity *= 0.1;
    if (this.glitchIntensity < 0.005) this.glitchIntensity = 0;

    this.simQuad.material = this.velMaterial;
    this.velMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.velMaterial.uniforms.u_velTexture.value = this.velTargetA.texture;
    this.velMaterial.uniforms.u_time.value = time;
    this.velMaterial.uniforms.u_dt.value = dt;
    this.velMaterial.uniforms.u_mouse.value = this.mouse;
    this.velMaterial.uniforms.u_scrollProgress.value = this.scrollProgress;

    this.renderer.setRenderTarget(this.velTargetB);
    this.renderer.render(this.simScene, this.simCamera);

    this.simQuad.material = this.posMaterial;
    this.posMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.posMaterial.uniforms.u_velTexture.value = this.velTargetB.texture;
    this.posMaterial.uniforms.u_dt.value = dt;

    this.renderer.setRenderTarget(this.posTargetB);
    this.renderer.render(this.simScene, this.simCamera);

    let tmp = this.posTargetA;
    this.posTargetA = this.posTargetB;
    this.posTargetB = tmp;

    tmp = this.velTargetA;
    this.velTargetA = this.velTargetB;
    this.velTargetB = tmp;

    this.renderer.setRenderTarget(null);
    this.renderMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.renderMaterial.uniforms.u_velTexture.value = this.velTargetA.texture;
    this.renderMaterial.uniforms.u_scrollProgress.value = this.scrollProgress;
    this.renderMaterial.uniforms.u_time.value = time;
    this.renderMaterial.uniforms.u_glitchIntensity.value = this.glitchIntensity;
    this.renderMaterial.uniforms.u_chromaticAberration.value = 0.035 + this.glitchIntensity * 0.24;

    this.scene.rotation.y = (this.scrollProgress - 0.5) * 0.4;

    this.renderer.render(this.scene, this.camera);
  }
}
