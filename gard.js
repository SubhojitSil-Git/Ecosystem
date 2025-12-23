// gard.js - EcoSim v3 (Water Waves + Windy Grass + Flickering Fire) - FINAL UPDATED

// --- 0. GLSL SHADER DEFINITIONS ---

// 1. WATER SHADERS (Waves)
const waterVertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    void main() {
        vUv = uv;
        vec3 pos = position;
        float wave1 = sin(pos.x * 3.0 + uTime * 2.0) * 0.1;
        float wave2 = cos(pos.z * 2.5 + uTime * 2.5) * 0.1;
        pos.y += wave1 + wave2;
        vElevation = pos.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;
const waterFragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    varying float vElevation;
    void main() {
        float mixStrength = (vElevation + 0.2) * 3.0;
        vec3 color = mix(uColorDeep, uColorShallow, mixStrength);
        gl_FragColor = vec4(color, 0.8);
    }
`;

// 2. GRASS SHADERS (Wind Sway)
const grassVertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Get the world position of this specific grass blade
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        
        // Calculate wind based on world X position + Time
        // Only apply wind if the vertex is high up (the tip of the blade)
        float windStrength = pos.y * 0.5; 
        float sway = sin(uTime * 2.0 + worldPos.x * 0.5) * windStrength;
        
        pos.x += sway;
        
        gl_Position = projectionMatrix * viewMatrix * worldPos; 
    }
`;
const grassFragmentShader = `
    varying vec2 vUv;
    void main() {
        // Gradient from dark green (bottom) to light green (top)
        vec3 colorBottom = vec3(0.1, 0.4, 0.1);
        vec3 colorTop = vec3(0.4, 0.8, 0.2);
        vec3 finalColor = mix(colorBottom, colorTop, vUv.y);
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// 3. FIRE SHADERS (Flicker)
const fireVertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        vec3 pos = position;
        // Make the fire wobble/scale up and down slightly
        float flicker = sin(uTime * 10.0) * 0.1 + 0.9; 
        pos.x *= flicker;
        pos.z *= flicker;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;
const fireFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
        // Pulse color from Red to Yellow
        float pulse = sin(uTime * 8.0 + vUv.y * 5.0);
        vec3 red = vec3(1.0, 0.2, 0.0);
        vec3 yellow = vec3(1.0, 0.8, 0.0);
        vec3 color = mix(red, yellow, pulse * 0.5 + 0.5);
        gl_FragColor = vec4(color, 1.0);
    }
`;


// --- 1. CONFIGURATION ---
const CONFIG = {
    MAX_ENTITIES: 100,      
    WORLD_RADIUS: 85,       
    SEPARATION_RADIUS: 2.5, 
    SEPARATION_FORCE: 8.0,  
    ATTACK_RANGE: 3.0,      
    BOUNDARY_FORCE: 20.0    
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 200);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 70);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.1;
controls.minDistance = 10;
controls.maxDistance = 120;
controls.target.set(0,0,0);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

// --- 2. ENVIRONMENT ---
const groundGroup = new THREE.Group();
scene.add(groundGroup);

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(100, 64), 
    new THREE.MeshStandardMaterial({ color: 0x5aa85a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData = { isEnvironment: true }; 
groundGroup.add(ground);

// --- 3. MATERIALS (UPDATED WITH SHADERS) ---
let waterSources = [];
let obstacles = [];
let entities = [];

// Shader Materials
const matWater = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x006994) },
        uColorShallow: { value: new THREE.Color(0x40E0D0) }
    }
});

const matGrass = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: { uTime: { value: 0 } }
});

const matFire = new THREE.ShaderMaterial({
    vertexShader: fireVertexShader,
    fragmentShader: fireFragmentShader,
    uniforms: { uTime: { value: 0 } }
});

const mats = {
    white: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    gray: new THREE.MeshStandardMaterial({ color: 0x95a5a6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1a1a1a }),
    orange: new THREE.MeshStandardMaterial({ color: 0xd35400 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf1c40f }),
    brown: new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
    darkGrey: new THREE.MeshStandardMaterial({ color: 0x2c3e50 }),
    rockGrey: new THREE.MeshStandardMaterial({ color: 0x7f8c8d }),
    water: matWater,
    grass: matGrass,
    fire: matFire, 
    red: new THREE.MeshStandardMaterial({ color: 0xe74c3c }),
    carrotOrange: new THREE.MeshStandardMaterial({ color: 0xe67e22 }),
    carrotGreen: new THREE.MeshStandardMaterial({ color: 0x2ecc71 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x000000 }),
    eyeGlow: new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 })
};

// ENVIRONMENT VEGETATION (Using Shader Grass)
function plantVegetation() {
    const geoGrass = new THREE.ConeGeometry(0.15, 0.8, 4);
    const geoFlower = new THREE.DodecahedronGeometry(0.3);
    const flowerColors = [0xffffff, 0xffff00, 0xff69b4, 0xff4500];

    for (let i = 0; i < 800; i++) { 
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 90; 
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        let mesh;
        if (Math.random() > 0.85) {
            mesh = new THREE.Mesh(geoFlower, new THREE.MeshStandardMaterial({ 
                color: flowerColors[Math.floor(Math.random() * flowerColors.length)] 
            }));
            mesh.position.y = 0.3;
        } else {
            // APPLY GRASS SHADER HERE
            mesh = new THREE.Mesh(geoGrass, mats.grass);
            mesh.position.y = 0.4;
        }
        mesh.position.set(x, mesh.position.y, z);
        mesh.rotation.y = Math.random() * Math.PI;
        // Don't rotate X for shader grass, it messes up the sway
        // mesh.rotation.x = (Math.random() - 0.5) * 0.4; 
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { isEnvironment: true }; 
        groundGroup.add(mesh);
    }
}
plantVegetation();

function addEyes(head, x, y, z, isWolf=false) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const mat = isWolf ? mats.eyeGlow : mats.eye;
    const eyeL = new THREE.Mesh(geo, mat); eyeL.position.set(-x, y, z); head.add(eyeL);
    const eyeR = new THREE.Mesh(geo, mat); eyeR.position.set(x, y, z); head.add(eyeR);
}

function createEntityMesh(type) {
    const group = new THREE.Group();
    group.castShadow = true;

    if (type === 'duck') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.6), mats.yellow); body.position.y=0.2; group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mats.yellow); head.position.set(0, 0.45, 0.3); addEyes(head, 0.08, 0.05, 0.16); group.add(head);
        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), mats.orange); beak.position.set(0, 0.4, 0.5); group.add(beak);
    }
    else if (type === 'sheep') {
        const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), mats.gray); body.position.y=0.6; body.scale.set(1,0.8,1.2); group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), mats.black); head.position.set(0, 0.9, 0.5); addEyes(head, 0.1, 0.05, 0.21); group.add(head);
        [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(p => {
            const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), mats.black); l.position.set(p[0], 0.25, p[1]); group.add(l);
        });
    }
    else if (type === 'fox') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.8), mats.orange); body.position.y=0.4; group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), mats.orange); head.position.set(0, 0.7, 0.5); addEyes(head, 0.1, 0, 0.21); group.add(head);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), mats.orange); tail.position.set(0, 0.5, -0.6); tail.rotation.x=0.5; group.add(tail);
    }
    else if (type === 'wolf') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.0), mats.darkGrey); body.position.y=0.5; group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), mats.darkGrey); head.position.set(0, 0.8, 0.6); addEyes(head, 0.12, 0.05, 0.26, true); group.add(head);
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.3), mats.darkGrey); snout.position.set(0, 0.7, 0.9); group.add(snout);
    }
    else if (type === 'rabbit') {
        const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), mats.white); body.position.y=0.3; group.add(body);
        const ears = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), mats.white); ears.position.set(0, 0.6, 0); ears.rotation.z=Math.PI/4; addEyes(body, 0.1, 0.1, 0.2); group.add(ears);
    }
    else if (type === 'chicken') {
        const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), mats.white); body.position.y=0.3; group.add(body);
        const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), mats.orange); beak.position.set(0, 0.3, 0.15); addEyes(body, 0.08, 0.1, 0.15); group.add(beak);
    }
    else if (type === 'dog') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.9), mats.brown); body.position.y=0.5; group.add(body);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mats.brown); head.position.set(0, 0.8, 0.5); addEyes(head, 0.1, 0.05, 0.21); group.add(head);
    }
    else if (type === 'cat') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), mats.black); body.position.y=0.3; group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), mats.black); head.position.set(0, 0.5, 0.4); addEyes(head, 0.08, 0.05, 0.15); group.add(head);
    }
    return group;
}

// --- 4. SPAWNING SYSTEM ---
// CHANGED: dayDuration set to 180 (3 minutes)
const state = { time: 0, dayDuration: 180, isNight: false, killCount: 0, fenceRotation: 0, lastTap: 0 };

function spawnEntity(type, x, z) {
    if (entities.length > CONFIG.MAX_ENTITIES && !['fence','pond','carrot','grass','bonfire','rock'].includes(type)) return;

    if (type === 'fence') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.2), mats.brown);
        mesh.position.set(x, 0.5, z); mesh.rotation.y = state.fenceRotation; mesh.castShadow = true;
        scene.add(mesh); obstacles.push({ mesh, radius: 1.2, type: 'fence' });
        return;
    }
    if (type === 'rock') {
        const size = 0.5 + Math.random() * 0.8;
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(size), mats.rockGrey);
        mesh.position.set(x, size/2, z); mesh.rotation.set(Math.random(),Math.random(),Math.random()); mesh.castShadow = true;
        scene.add(mesh); obstacles.push({ mesh, radius: size, type: 'rock' });
        return;
    }
    if (type === 'bonfire') {
        const mesh = new THREE.Group();
        const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1), mats.brown); log1.rotation.z = Math.PI/2; mesh.add(log1);
        const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1), mats.brown); log2.rotation.x = Math.PI/2; mesh.add(log2);
        
        // FLICKERING FIRE MESH
        const fire = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), mats.fire); 
        fire.position.y = 0.3; fire.visible = false; mesh.add(fire);
        
        const light = new THREE.PointLight(0xff4500, 0, 15); light.position.y = 1; mesh.add(light);
        mesh.position.set(x, 0.2, z); mesh.userData = { isBonfire: true, light, fireMesh: fire };
        scene.add(mesh); obstacles.push({ mesh, radius: 2, type: 'bonfire' });
        return;
    }
    if (type === 'carrot') {
        const mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), mats.carrotOrange);
        body.rotation.x = Math.PI; body.position.y = 0.25; mesh.add(body);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 5), mats.carrotGreen);
        leaves.position.y = 0.5; mesh.add(leaves);
        mesh.position.set(x, 0, z); mesh.userData = { type: 'carrot' };
        scene.add(mesh); entities.push({ type: 'carrot', mesh, active: true });
        return;
    }
    if (type === 'pond') {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 64), mats.water);
        mesh.position.set(x, 0.05, z);
        scene.add(mesh); waterSources.push({ pos: new THREE.Vector3(x,0,z), radius: 4, mesh });
        return;
    }
    
    // CHANGED: Tree Spawning now includes Random Scaling
    if(type === 'oak' || type === 'pine') {
        const tGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.4,2,6), mats.brown); trunk.position.y=1; tGroup.add(trunk);
        const leaves = type==='oak' 
            ? new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), mats.carrotGreen)
            : new THREE.Mesh(new THREE.ConeGeometry(1.5,3,8), new THREE.MeshStandardMaterial({color:0x1e8449}));
        leaves.position.y = 2.5; tGroup.add(leaves);
        
        // Apply Random Scale
        const scale = 0.8 + Math.random() * 0.7; // Random scale between 0.8 and 1.5
        tGroup.scale.set(scale, scale, scale);
        
        tGroup.position.set(x,0,z); 
        scene.add(tGroup); 
        // Collision radius scales with the tree
        obstacles.push({mesh:tGroup, radius: 1 * scale, type: 'tree'});
        return;
    }

    const mesh = createEntityMesh(type);
    mesh.position.set(x, 0, z);
    scene.add(mesh);

    entities.push({
        type: type,
        mesh: mesh,
        health: 5,
        velocity: new THREE.Vector3(),
        state: 'idle',
        target: null,
        killsToday: 0,
        cooldown: 0,
        walkPhase: Math.random()*10,
        wanderTarget: new THREE.Vector3(x, 0, z)
    });
}

// Fixed Grass Spawning
let grassTimer = 0;
function spawnNaturalGrass() {
    grassTimer++;
    if (grassTimer > 50 && entities.filter(e => e.type === 'grass').length < 20) { 
        spawnEntity('grass', (Math.random()-0.5)*100, (Math.random()-0.5)*100);
        grassTimer = 0;
    }
}
const originalSpawn = spawnEntity;
spawnEntity = function(type, x, z) {
    if (type === 'grass') {
        // USE WINDY GRASS MATERIAL
        const grass = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 3), mats.grass);
        grass.position.set(x, 0, z);
        scene.add(grass);
        entities.push({ type: 'grass', mesh: grass, active: true });
        return;
    }
    originalSpawn(type, x, z);
}

// --- 5. AI ENGINE (FIXED PHYSICS) ---

function applySteering(delta) {
    const force = new THREE.Vector3();
    const diff = new THREE.Vector3();

    for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        
        if (e.health <= 0 && !['carrot','grass','dead_chicken'].includes(e.type)) {
            if (e.type === 'chicken') {
                e.type = 'dead_chicken'; e.mesh.rotation.z = Math.PI / 2;
                e.mesh.children.forEach(c => c.material = mats.red);
                continue; 
            }
            scene.remove(e.mesh); entities.splice(i, 1); continue;
        }

        if (!e.mesh || ['grass','carrot','dead_chicken'].includes(e.type)) continue;

        force.set(0, 0, 0);
        const pos = e.mesh.position;
        
        if (state.isNight && e.type !== 'wolf' && e.type !== 'dog') {
            e.mesh.scale.y = 0.5; continue; 
        } else {
            e.mesh.scale.y = 1;
        }

        if (e.cooldown > 0) e.cooldown -= delta;

        if (!e.target || !e.target.mesh || e.target.health <= 0) {
            e.target = null; 
            if (e.type === 'wolf' && state.isNight) e.target = entities.find(t => ['sheep','rabbit','cat'].includes(t.type) && t.health > 0);
            else if (e.type === 'fox' && e.killsToday < 2) e.target = entities.find(t => ['chicken','rabbit'].includes(t.type) && t.health > 0);
            else if (e.type === 'dog') {
                const enemy = entities.find(t => ['wolf','fox'].includes(t.type) && pos.distanceTo(t.mesh.position) < 20);
                e.target = enemy || entities.find(t => t.type === 'dead_chicken');
            }
            else if (e.type === 'sheep' && e.health < 5) e.target = entities.find(t => t.type === 'grass');
            else if (e.type === 'rabbit') e.target = entities.find(t => t.type === 'carrot');
            
            if (!e.target && Math.random() > 0.98) {
                e.wanderTarget.set((Math.random()-0.5)*90, 0, (Math.random()-0.5)*90);
            }
        }

        let sepCount = 0;
        const sepForce = new THREE.Vector3();
        
        entities.forEach(other => {
            if (other === e || !other.mesh) return;
            const dist = pos.distanceTo(other.mesh.position);
            
            if (dist > 0 && dist < CONFIG.SEPARATION_RADIUS) {
                if (e.target !== other) {
                    diff.subVectors(pos, other.mesh.position).normalize().divideScalar(dist);
                    sepForce.add(diff);
                    sepCount++;
                }
            }
        });
        if (sepCount > 0) {
            sepForce.divideScalar(sepCount).normalize().multiplyScalar(CONFIG.SEPARATION_FORCE);
            force.add(sepForce);
        }

        if (e.target && e.target.mesh) {
            const dist = pos.distanceTo(e.target.mesh.position);
            const isEnemy = ['wolf','fox','dog'].includes(e.type);
            const range = CONFIG.ATTACK_RANGE; 

            if (dist > range) {
                diff.subVectors(e.target.mesh.position, pos).normalize().multiplyScalar(3.0);
                force.add(diff);
            } else {
                if (isEnemy) {
                    if (e.cooldown <= 0) {
                        e.target.health--;
                        e.cooldown = 1.5;
                        e.mesh.position.y = 1; // Attack Jump
                        if (e.target.health <= 0 && e.type === 'fox') e.killsToday++;
                    }
                } else {
                    e.health = Math.min(e.health + 1, 5);
                    scene.remove(e.target.mesh);
                    entities.splice(entities.indexOf(e.target), 1);
                    e.target = null;
                }
            }
        } else {
            diff.subVectors(e.wanderTarget, pos).normalize().multiplyScalar(0.8);
            force.add(diff);
        }

        const distFromCenter = pos.length();
        if (distFromCenter > CONFIG.WORLD_RADIUS) {
            force.add(pos.clone().multiplyScalar(-1).normalize().multiplyScalar(CONFIG.BOUNDARY_FORCE));
        }

        let nearestWater = null, distToWater = 999;
        waterSources.forEach(w => {
            const d = pos.distanceTo(w.pos);
            if(d < distToWater) { distToWater = d; nearestWater = w; }
        });
        if (e.type === 'duck') {
            if (nearestWater && distToWater > nearestWater.radius - 1) {
                force.add(new THREE.Vector3().subVectors(nearestWater.pos, pos).normalize().multiplyScalar(3));
            }
        } else if (nearestWater && distToWater < nearestWater.radius + 1.5) {
            force.add(new THREE.Vector3().subVectors(pos, nearestWater.pos).normalize().multiplyScalar(10));
        }
        obstacles.forEach(obs => {
            const d = pos.distanceTo(obs.mesh.position);
            if (e.type === 'wolf' && obs.type === 'bonfire' && obs.mesh.userData.light.intensity > 0 && d < 15) {
                 force.add(new THREE.Vector3().subVectors(pos, obs.mesh.position).normalize().multiplyScalar(25));
            }
            if (d < obs.radius + 0.8) {
                force.add(new THREE.Vector3().subVectors(pos, obs.mesh.position).normalize().multiplyScalar(8));
            }
        });

        e.velocity.add(force.multiplyScalar(delta));
        e.velocity.y = 0; 
        e.velocity.clampLength(0, ['wolf','fox'].includes(e.type) ? 6 : 3);
        
        e.mesh.position.add(e.velocity.clone().multiplyScalar(delta));
        e.mesh.position.y = 0; 
        
        const speed = e.velocity.length();
        if (speed > 0.1) {
            e.walkPhase += speed * delta * 5;
            e.mesh.position.y = Math.abs(Math.sin(e.walkPhase)) * 0.2; 
            e.mesh.lookAt(e.mesh.position.clone().add(e.velocity));
        } else {
            e.mesh.position.y = 0;
        }
    }
}

// --- 6. TIME & CAMERA ---
function updateDayCycle(delta) {
    state.time += delta;
    const cyclePos = (state.time % state.dayDuration) / state.dayDuration;
    
    if (cyclePos > 0.5 && !state.isNight) {
        state.isNight = true; 
        document.getElementById('night-overlay').style.opacity = 0.6;
        document.getElementById('clock-display').innerText = "🌙 Night";
        scene.background.setHex(0x0a0a1a); scene.fog.color.setHex(0x0a0a1a); 
        sunLight.intensity = 0.1;
        for(let i=0; i<3; i++) spawnEntity('wolf', (Math.random()-0.5)*120, (Math.random()-0.5)*120);
        obstacles.forEach(o => { 
            if (o.mesh.userData.isBonfire) { o.mesh.userData.light.intensity = 2; o.mesh.userData.fireMesh.visible = true; }
        });
    } else if (cyclePos <= 0.5 && state.isNight) {
        state.isNight = false;
        entities.forEach(e => { if(e.type==='fox') e.killsToday = 0; });
        document.getElementById('night-overlay').style.opacity = 0;
        document.getElementById('clock-display').innerText = "☀️ Day";
        scene.background.setHex(0x87CEEB); scene.fog.color.setHex(0x87CEEB); sunLight.intensity = 1.2;
        for(let i=entities.length-1; i>=0; i--) { if(entities[i].type === 'wolf') { scene.remove(entities[i].mesh); entities.splice(i, 1); } }
        obstacles.forEach(o => { 
            if (o.mesh.userData.isBonfire) { o.mesh.userData.light.intensity = 0; o.mesh.userData.fireMesh.visible = false; }
        });
    }
}

const camSpeed = 1.5;
function moveCamera(x, z) {
    camera.position.x += x; camera.position.z += z;
    controls.target.x += x; controls.target.z += z;
    controls.update();
}
document.getElementById('cam-up').onclick = () => moveCamera(0, -camSpeed * 5);
document.getElementById('cam-down').onclick = () => moveCamera(0, camSpeed * 5);
document.getElementById('cam-left').onclick = () => moveCamera(-camSpeed * 5, 0);
document.getElementById('cam-right').onclick = () => moveCamera(camSpeed * 5, 0);

// --- 7. INPUT & SAVE ---
let currentTool = 'oak';
let isRemoveMode = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        isRemoveMode = false;
        document.getElementById('remove-mode-btn').classList.remove('active');
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.type;
        document.getElementById('rotate-btn').classList.toggle('hidden', currentTool !== 'fence');
    });
});
document.getElementById('rotate-btn').addEventListener('click', () => state.fenceRotation += Math.PI / 4);
document.getElementById('remove-mode-btn').addEventListener('click', (e) => {
    isRemoveMode = !isRemoveMode;
    e.target.classList.toggle('active');
    document.getElementById('instruction-toast').innerText = isRemoveMode ? "Tap to Remove!" : "Double Tap to Spawn!";
});

document.getElementById('save-btn').addEventListener('click', () => {
    const validEntities = entities.filter(e => e.type !== 'wolf' && e.type !== 'grass');
    const data = {
        entities: validEntities.map(e => ({ type: e.type, x: e.mesh.position.x, z: e.mesh.position.z })),
        obstacles: obstacles.map(o => ({ type: o.type, x: o.mesh.position.x, z: o.mesh.position.z })),
        water: waterSources.map(w => ({ x: w.pos.x, z: w.pos.z }))
    };
    localStorage.setItem('ecoSave', JSON.stringify(data));
    alert("World Saved!");
});

function loadGame() {
    try {
        const data = JSON.parse(localStorage.getItem('ecoSave'));
        if(data) {
            if(data.water) data.water.forEach(w => spawnEntity('pond', w.x, w.z));
            if(data.obstacles) data.obstacles.forEach(o => spawnEntity(o.type || 'tree', o.x, o.z));
            if(data.entities) data.entities.forEach(e => spawnEntity(e.type, e.x, e.z));
        }
    } catch(e) {}
}
setTimeout(loadGame, 500);

const canvas = document.getElementById('canvas-container');
canvas.addEventListener('pointerup', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (isRemoveMode) {
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
            let target = intersects[0].object;
            while(target.parent && target.parent !== scene) {
                if (target.userData.isEnvironment) return; 
                target = target.parent;
            }
            if (target !== ground && target !== sunLight && !target.userData.isEnvironment) {
                scene.remove(target);
                const entIdx = entities.findIndex(e => e.mesh === target);
                if(entIdx > -1) entities.splice(entIdx, 1);
                const obsIdx = obstacles.findIndex(o => o.mesh === target);
                if(obsIdx > -1) obstacles.splice(obsIdx, 1);
                const watIdx = waterSources.findIndex(w => w.mesh === target);
                if(watIdx > -1) waterSources.splice(watIdx, 1);
            }
        }
        return;
    }

    const now = Date.now();
    if (now - state.lastTap < 300) {
        const intersects = raycaster.intersectObject(ground);
        if (intersects.length > 0) spawnEntity(currentTool, intersects[0].point.x, intersects[0].point.z);
    }
    state.lastTap = now;
});

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    // UPDATE ALL SHADERS WITH TIME
    matWater.uniforms.uTime.value += delta;
    matGrass.uniforms.uTime.value += delta;
    matFire.uniforms.uTime.value += delta;

    updateDayCycle(delta);
    applySteering(delta);
    spawnNaturalGrass();
    controls.update(); 
    renderer.render(scene, camera);
}
window.addEventListener('resize', () => { 
    camera.aspect=window.innerWidth/window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
});
animate();
