// Polished Three.js hero with trace pulses and magnetic buttons
(() => {
  const types = ['ESP32 Developer','STM32 Firmware Engineer','RTOS Enthusiast','Embedded C Programmer','IoT System Designer'];
  let ti=0,ci=0;const typingEl = document.getElementById('typing');
  function tick(){
    const txt = types[ti].slice(0,ci);typingEl.textContent = txt;ci++;if(ci>types[ti].length+12){ci=0;ti=(ti+1)%types.length}
    setTimeout(tick,60 + Math.random()*80);
  }
  tick();

  // Magnetic buttons
  const buttons = Array.from(document.querySelectorAll('.btn'));
  document.addEventListener('mousemove',e=>{
    buttons.forEach(b=>{
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width/2);const dy = e.clientY - (r.top + r.height/2);const d = Math.hypot(dx,dy);
      const max = 120; if(d < max){const tx = (dx/d)*Math.min(18,(max-d)/6);const ty = (dy/d)*Math.min(12,(max-d)/8);gsap.to(b,{x:tx,y:ty,duration:0.35,ease:'power3.out'})}else{gsap.to(b,{x:0,y:0,duration:0.5,ease:'power3.out'})}
    })
  })

  // Cursor glow via CSS vars
  document.addEventListener('mousemove',e=>{document.body.style.setProperty('--cursorX',e.clientX+'px');document.body.style.setProperty('--cursorY',e.clientY+'px');document.body.style.setProperty('--cursorOpacity','0.92')});
  document.addEventListener('mouseleave',()=>document.body.style.setProperty('--cursorOpacity','0'));

  // Sparks on move (lightweight)
  let sparkCooldown=0;document.addEventListener('mousemove',e=>{if(sparkCooldown>0){sparkCooldown--;return}sparkCooldown=3;const s=document.createElement('div');s.className='spark';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';document.body.appendChild(s);gsap.fromTo(s,{opacity:1,scale:0.6},{opacity:0,scale:1.8,duration:0.9,ease:'power1.out',onComplete:()=>s.remove()})});

  // Three.js chip + traces
  const container = document.getElementById('three-container');if(!container || !window.THREE) return;
  const scene = new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,container.clientWidth/container.clientHeight,0.1,1000);camera.position.set(0,1.6,3.8);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(container.clientWidth,container.clientHeight);renderer.setPixelRatio(window.devicePixelRatio);renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.0;container.appendChild(renderer.domElement);
  const light=new THREE.PointLight(0x00e5ff,1.2,14);light.position.set(3,3,6);scene.add(light);scene.add(new THREE.AmbientLight(0x123344,0.6));

  const board = new THREE.Mesh(new THREE.BoxGeometry(6,0.06,4),new THREE.MeshStandardMaterial({color:0x001726,metalness:0.2,roughness:0.6}));board.position.y=-0.44;scene.add(board);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.32,1.6),new THREE.MeshStandardMaterial({color:0x001822,metalness:0.6,emissive:0x00a8d6,emissiveIntensity:1.6}));chip.position.set(0,0.12,0);scene.add(chip);

  // Trace paths (simple bezier-like arrays)
  const tracePaths = [
    [{x:-2.4,z:1.1},{x:-1.2,z:0.6},{x:0,z:0.3},{x:1.8,z:-0.2},{x:2.6,z:-0.6}],
    [{x:-2.6,z:-0.8},{x:-1.0,z:-0.4},{x:0.6,z:0.1},{x:2.2,z:0.6}]
  ];

  function makeTrace(path){
    const group = new THREE.Group();
    for(let i=0;i<path.length-1;i++){
      const a=path[i], b=path[i+1];
      const len = Math.hypot(b.x-a.x,b.z-a.z);const geom = new THREE.BoxGeometry(len,0.02,0.06);
      const mat = new THREE.MeshStandardMaterial({color:0x003344,emissive:0x002233,emissiveIntensity:0.15});
      const mesh = new THREE.Mesh(geom,mat);
      mesh.position.set((a.x+b.x)/2,0.06,(a.z+b.z)/2);
      mesh.lookAt(new THREE.Vector3(b.x,0.06,b.z));group.add(mesh);
    }
    return group;
  }
  const traces = tracePaths.map(p=>{const t=makeTrace(p);scene.add(t);return t});

  // moving charge that illuminates traces
  const charge = new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12),new THREE.MeshBasicMaterial({color:0x00e5ff}));charge.position.set(-2.6,0.14,0.6);scene.add(charge);
  // Setup selective bloom using layers and two composers
  const bloomLayer = new THREE.Layers(); bloomLayer.set(1);

  // Bloom composer: renders only objects in bloom layer
  const bloomComposer = new THREE.EffectComposer(renderer);
  const bloomRenderPass = new THREE.RenderPass(scene, camera);
  bloomComposer.addPass(bloomRenderPass);
  const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.0, 0.4, 0.85);
  bloomPass.threshold = 0.08; bloomPass.strength = 1.5; bloomPass.radius = 0.55;
  bloomComposer.addPass(bloomPass);

  // Final composer: renders the scene normally then adds bloom texture
  const finalComposer = new THREE.EffectComposer(renderer);
  const finalRenderPass = new THREE.RenderPass(scene, camera);
  finalComposer.addPass(finalRenderPass);

  // Additive blend shader to composite bloom on top of scene
  const AdditiveBlendShader = {
    uniforms: {
      'tDiffuse': { value: null },
      'tAdd': { value: null }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D tAdd; varying vec2 vUv; void main(){ vec4 base = texture2D(tDiffuse, vUv); vec4 add = texture2D(tAdd, vUv); gl_FragColor = base + add; }'
  };
  const addPass = new THREE.ShaderPass(AdditiveBlendShader, 'tDiffuse');
  addPass.needsSwap = true;
  finalComposer.addPass(addPass);

  // Chromatic aberration (RGB shift) and film grain passes
  let rgbPass = null;
  if(THREE.RGBShiftShader){
    rgbPass = new THREE.ShaderPass(THREE.RGBShiftShader);
    rgbPass.uniforms['amount'].value = 0.0015;
    finalComposer.addPass(rgbPass);
  }
  let filmPass = null;
  if(THREE.FilmPass){
    // noise, scanline intensity, scanline count, grayscale
    filmPass = new THREE.FilmPass(0.25, 0.8, 1024, false);
    filmPass.renderToScreen = true;
    finalComposer.addPass(filmPass);
  }

  let time=0;const clock=new THREE.Clock();
  function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();time+=dt;
    chip.rotation.y = Math.sin(time*0.2)*0.06;
    // oscillate chip emissive for subtle breathing
    chip.material.emissiveIntensity = 1.0 + Math.sin(time*1.2)*0.45;
    // move charge along first path loop
    const path = tracePaths[0];const total = path.length-1;const pos = (time*0.7)%(total);
    const idx=Math.floor(pos);const t=pos-idx;const a=path[idx], b=path[(idx+1)%path.length];charge.position.set(THREE.MathUtils.lerp(a.x,b.x,t),0.14,THREE.MathUtils.lerp(a.z,b.z,t));
    // make traces glow near charge and assign bloom layer
    traces.forEach((group)=>{group.children.forEach(m=>{const d = m.position.distanceTo(charge.position);m.material.emissive = new THREE.Color(0x00c8ff);m.material.emissiveIntensity = Math.max(0.05, 1.8 - d*2.4); m.layers.enable(1);})});
    chip.layers.enable(1); charge.layers.enable(1);

    // Render bloom only for bloom layer
    camera.layers.set(1);
    bloomComposer.render();

    // Render scene normally and composite bloom texture
    camera.layers.set(0);
    // use bloomComposer read buffer as additive texture
    addPass.uniforms['tAdd'].value = bloomComposer.readBuffer.texture || bloomComposer.renderTarget2 && bloomComposer.renderTarget2.texture;
    // small dynamic RGB amount based on time for subtle effect
    if(rgbPass) rgbPass.uniforms['amount'].value = 0.0012 + Math.sin(time*0.8)*0.0008;
    finalComposer.render();
  }
  animate();

  window.addEventListener('resize',()=>{camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight)});
  // subtle camera follow
  container.addEventListener('mousemove',e=>{const r=container.getBoundingClientRect();const mx=(e.clientX-r.left)/r.width*2-1;const my=-(e.clientY-r.top)/r.height*2+1;gsap.to(camera.position,{x:mx*0.6,y:1.5+my*0.4,duration:0.8,ease:'power3.out'})});
})();
