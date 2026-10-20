import * as THREE from 'three';

/**
 * FBO Ping-Pong GPU Particle Engine
 * Simulates 65,536+ particles entirely on the GPU using double-buffered WebGL Render Targets.
 */
export class FBOParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = 256; // 256x256 = 65,536 particles
    this.count = this.size * this.size;
    
    this.mouse = new THREE.Vector3(0, 0, 0);
    this.targetMouse = new THREE.Vector3(0, 0, 0);
    this.scrollVelocity = 0;
    this.lastScrollY = window.scrollY;
    
    this.init();
  }

  init() {
    // 1. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Camera & Scene for Display
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 25;

    // 3. Setup Simulation Scene & Orthographic Camera for Compute Pass
    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.simScene.add(this.simQuad);

    // 4. Create Initial Textures & Render Targets
    const type = THREE.HalfFloatType; // Broad compatibility
    const options = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: type
    };

    this.posTargetA = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.posTargetB = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.velTargetA = new THREE.WebGLRenderTarget(this.size, this.size, options);
    this.velTargetB = new THREE.WebGLRenderTarget(this.size, this.size, options);

    // Generate initial position & velocity data
    const posData = new Float32Array(this.count * 4);
    const velData = new Float32Array(this.count * 4);

    for (let i = 0; i < this.count; i++) {
      const i4 = i * 4;
      // Position spread across 3D space
      const radius = 12 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      posData[i4 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      posData[i4 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      posData[i4 + 2] = radius * Math.cos(phi);
      posData[i4 + 3] = Math.random(); // Life/phase

      velData[i4 + 0] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 1] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 2] = (Math.random() - 0.5) * 0.1;
      velData[i4 + 3] = 1.0;
    }

    const posDataTex = new THREE.DataTexture(
      posData,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    posDataTex.needsUpdate = true;

    const velDataTex = new THREE.DataTexture(
      velData,
      this.size,
      this.size,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    velDataTex.needsUpdate = true;

    // Seed targets
    this.copyTexture(posDataTex, this.posTargetA);
    this.copyTexture(posDataTex, this.posTargetB);
    this.copyTexture(velDataTex, this.velTargetA);
    this.copyTexture(velDataTex, this.velTargetB);

    // 5. Build Shaders
    this.createMaterials();
    this.createParticles();

    // 6. Event Listeners
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('touchmove', this.onTouchMove.bind(this));
    window.addEventListener('scroll', this.onScroll.bind(this));

    this.clock = new THREE.Clock();
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

  createMaterials() {
    // Velocity Compute Material
    this.velMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_time: { value: 0 },
        u_dt: { value: 0 },
        u_mouse: { value: this.mouse },
        u_scrollSpeed: { value: 0 }
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
        uniform float u_scrollSpeed;
        varying vec2 vUv;

        // Simplex 3D noise functions
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

        // Curl Noise calculation
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

          // Calculate Curl Noise force field
          vec3 noiseForce = curlNoise(pos.xyz * 0.12 + vec3(u_time * 0.08)) * 0.45;
          
          // Mouse interaction (repulsion/swirl)
          vec3 mDiff = pos.xyz - u_mouse;
          float mDist = length(mDiff);
          vec3 mouseForce = vec3(0.0);
          if (mDist < 10.0 && mDist > 0.01) {
            float force = (1.0 - mDist / 10.0) * 1.8;
            mouseForce = normalize(mDiff) * force + vec3(-mDiff.y, mDiff.x, 0.0) * 0.3 * force;
          }

          // Scroll reactivity
          vec3 scrollForce = vec3(0.0, u_scrollSpeed * 0.15, 0.0);

          vec3 newVel = vel.xyz * 0.96 + (noiseForce + mouseForce + scrollForce) * u_dt;
          
          gl_FragColor = vec4(newVel, 1.0);
        }
      `
    });

    // Position Compute Material
    this.posMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_time: { value: 0 },
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
        uniform float u_time;
        uniform float u_dt;
        varying vec2 vUv;

        // Pseudo random float
        float rand(vec2 co){
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec4 pos = texture2D(u_posTexture, vUv);
          vec4 vel = texture2D(u_velTexture, vUv);

          vec3 newPos = pos.xyz + vel.xyz * (u_dt * 12.0);
          float life = pos.w + u_dt * 0.1;

          // Boundary reset or lifespan wrap
          float bounds = 28.0;
          if (length(newPos) > bounds || life > 1.0) {
            float seed = rand(vUv + vec2(u_time));
            float angle = seed * 6.28318;
            float r = 5.0 + rand(vUv * 2.0) * 15.0;
            newPos = vec3(cos(angle) * r, sin(angle) * r, (seed - 0.5) * 12.0);
            life = 0.0;
          }

          gl_FragColor = vec4(newPos, life);
        }
      `
    });

    // Particle Render Material (Displays points on screen)
    this.renderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_posTexture: { value: null },
        u_velTexture: { value: null },
        u_time: { value: 0 }
      },
      vertexShader: `
        uniform sampler2D u_posTexture;
        uniform sampler2D u_velTexture;
        uniform float u_time;
        attribute vec2 reference;
        varying vec3 vVel;
        varying float vLife;

        void main() {
          vec4 pos = texture2D(u_posTexture, reference);
          vec4 vel = texture2D(u_velTexture, reference);
          
          vVel = vel.xyz;
          vLife = pos.w;

          vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Depth-based point sizing
          gl_PointSize = (180.0 / -mvPosition.z) * (0.8 + 0.4 * sin(vLife * 3.1415));
        }
      `,
      fragmentShader: `
        varying vec3 vVel;
        varying float vLife;

        void main() {
          // Soft circular point shape
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.0, dist);

          // Speed based color mapping (Processing Cyan to Electric Lavender & Soft Magenta)
          float speed = length(vVel) * 2.5;
          vec3 col1 = vec3(0.0, 0.65, 0.95); // Processing Cyan #00a6f3
          vec3 col2 = vec3(0.66, 0.54, 0.92); // Electric Lavender #a88beb
          vec3 col3 = vec3(0.98, 0.35, 0.62); // Soft Magenta #fa599e

          vec3 color = mix(col1, col2, clamp(speed, 0.0, 1.0));
          color = mix(color, col3, clamp(speed - 0.8, 0.0, 1.0));

          // Soft core glow
          float core = smoothstep(0.2, 0.0, dist) * 0.6;
          color += vec3(core);

          gl_FragColor = vec4(color, alpha * 0.75 * (1.0 - vLife * 0.2));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
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
    // Map to 3D world plane at z=0
    this.targetMouse.set(x * 16, y * 10, 0);
  }

  onTouchMove(e) {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = (touch.clientX / window.innerWidth) * 2 - 1;
      const y = -(touch.clientY / window.innerHeight) * 2 + 1;
      this.targetMouse.set(x * 16, y * 10, 0);
    }
  }

  onScroll() {
    const currentY = window.scrollY;
    const delta = currentY - this.lastScrollY;
    this.scrollVelocity += delta * 0.05;
    this.lastScrollY = currentY;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();

    // Smooth mouse lerp
    this.mouse.lerp(this.targetMouse, 0.08);

    // Decay scroll velocity
    this.scrollVelocity *= 0.92;

    // --- STEP 1: Compute Velocity (Ping-Pong) ---
    this.simQuad.material = this.velMaterial;
    this.velMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.velMaterial.uniforms.u_velTexture.value = this.velTargetA.texture;
    this.velMaterial.uniforms.u_time.value = time;
    this.velMaterial.uniforms.u_dt.value = dt;
    this.velMaterial.uniforms.u_mouse.value = this.mouse;
    this.velMaterial.uniforms.u_scrollSpeed.value = this.scrollVelocity;

    this.renderer.setRenderTarget(this.velTargetB);
    this.renderer.render(this.simScene, this.simCamera);

    // --- STEP 2: Compute Position (Ping-Pong) ---
    this.simQuad.material = this.posMaterial;
    this.posMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.posMaterial.uniforms.u_velTexture.value = this.velTargetB.texture;
    this.posMaterial.uniforms.u_time.value = time;
    this.posMaterial.uniforms.u_dt.value = dt;

    this.renderer.setRenderTarget(this.posTargetB);
    this.renderer.render(this.simScene, this.simCamera);

    // --- SWAP Targets ---
    let tmp = this.posTargetA;
    this.posTargetA = this.posTargetB;
    this.posTargetB = tmp;

    tmp = this.velTargetA;
    this.velTargetA = this.velTargetB;
    this.velTargetB = tmp;

    // --- STEP 3: Display Particles to Screen ---
    this.renderer.setRenderTarget(null);
    this.renderMaterial.uniforms.u_posTexture.value = this.posTargetA.texture;
    this.renderMaterial.uniforms.u_velTexture.value = this.velTargetA.texture;
    this.renderMaterial.uniforms.u_time.value = time;

    // Gentle camera rotation
    this.scene.rotation.y = Math.sin(time * 0.15) * 0.1;
    this.scene.rotation.x = Math.cos(time * 0.1) * 0.05;

    this.renderer.render(this.scene, this.camera);
  }
}
