// gard.js - Survival Ecosystem

// --- 1. SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 45);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.1;

// --- 2. LIGHTING & DAY/NIGHT CYCLE ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
sunLight.position.set(50, 80, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

let isNight = false;
let gameTime = 0;
const CYCLE_DURATION = 60; // seconds per cycle

function updateDayNight(dt) {
    gameTime += dt;
    const cyclePos = (gameTime % CYCLE_DURATION) / CYCLE_DURATION;
    
    isNight = cyclePos > 0.5;

    // Sun movement
    const angle = cyclePos * Math.PI * 2;
    sunLight.position.y = Math.sin(angle) * 80;
    sunLight.position.x = Math.cos(angle) * 80;

    // Color Transitions
    if (isNight) {
        scene.background.lerp(new THREE.Color(0x1a237e), 0.05); // Dark Blue
        scene.fog.color.lerp(new THREE.Color(0x1a237e), 0.05);
        ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, 0.1, 0.05);
        sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 0, 0.05);
        document.getElementById('time-display').innerText = "🌙 NIGHT";
    } else {
        scene.background.lerp(new THREE.Color(0x87CEEB), 0.05); // Sky Blue
        scene.fog.color.lerp(new THREE.Color(0x87CEEB), 0.05);
        ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, 0.7, 0.05);
        sunLight.intensity = THREE.MathUtils.lerp(sunLight.intensity, 1.2, 0.05);
        document.getElementById('time-display').innerText = "☀️ DAY";
    }

    // Wolf Spawning Logic
    handleNightSpawns();
}

// --- 3. ENVIRONMENT (Vegetation Preserved) ---
const groundGroup = new THREE.Group();
scene.add(groundGroup);

const ground = new THREE.Mesh(
    new THREE.CircleGeometry(120, 64),
    new THREE.MeshStandardMaterial({ color: 0x5aa85a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
groundGroup.add(ground);

const vegetation = [];
function plantVegetation() {
    const geoGrass = new THREE.ConeGeometry(0.15, 0.8, 4);
    const geoFlower = new THREE.DodecahedronGeometry(0.3);
    const flowerColors = [0xffffff, 0xffff00, 0xff69b4, 0xff4500];

    for (let i = 0; i < 800; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 80;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        let mesh;
        if (Math.random() > 0.9) {
            mesh = new THREE.Mesh(geoFlower, new THREE.MeshStandardMaterial({ color: flowerColors[Math.floor(Math.random() * flowerColors.length)] }));
            mesh.position.y = 0.4;
        } else {
            mesh = new THREE.Mesh(geoGrass, new THREE.MeshStandardMaterial({ color: 0x4a9c4a }));
            mesh.position.y = 0.4;
        }
        mesh.position.set(x, mesh.position.y, z);
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.rotation.x = (Math.random() - 0.5) * 0.4;
        mesh.receiveShadow = true;
        mesh.userData = { baseRot: mesh.rotation.clone(), phase: Math.random() * 10, speed: 0.5 + Math.random() };
        groundGroup.add(mesh);
        vegetation.push(mesh);
    }
}
plantVegetation();

// --- 4. GAME OBJECTS & BUILDERS ---
const entities = []; // All interactive items
const animals = [];  // AI agents
const nightKills = { count: 0, resetTime: 0 };

const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x228B22 }),
    water: new THREE.MeshStandardMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x808080 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff6b00 }), // Carrot/Fox
    white: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    gray: new THREE.MeshStandardMaterial({ color: 0x95a5a6 }), // Sheep
    darkGray: new THREE.MeshStandardMaterial({ color: 0x2c3e50 }), // Wolf
    brown: new THREE.MeshStandardMaterial({ color: 0x795548 }), // Dog
    fire: new THREE.MeshBasicMaterial({ color: 0xffaa00 })
};

// --- BUILDER FUNCTIONS ---

function createSheep(x, z) {
    const g = new THREE.Group();
    // Body (Wooly)
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mats.gray);
    body.position.y = 0.6;
    body.scale.set(1, 0.8, 1.4);
    body.castShadow = true;
    g.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.4), new THREE.MeshStandardMaterial({color:0x333333}));
    head.position.set(0, 0.9, 0.6);
    g.add(head);
    
    setupEntity(g, x, z, 'sheep');
}

function createDuck(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.6), mats.white);
    body.position.y = 0.15;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({color:0x2ecc71})); // Green head duck
    head.position.set(0, 0.4, 0.2);
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mats.orange);
    beak.rotation.x = Math.PI/2;
    beak.position.set(0, 0.4, 0.4);
    g.add(beak);
    
    setupEntity(g, x, z, 'duck');
}

function createDog(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.9), mats.brown);
    body.position.y = 0.5;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mats.brown);
    head.position.set(0, 0.8, 0.45);
    g.add(head);
    // Ears
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.1), mats.brown);
    ear.position.set(0, 1.05, 0.45);
    g.add(ear);
    
    setupEntity(g, x, z, 'dog');
}

function createWolf(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 1.1), mats.darkGray);
    body.position.y = 0.6;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.6), mats.darkGray);
    head.position.set(0, 0.9, 0.6);
    g.add(head);
    // Glowing Eyes
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mats.fire);
    eyes.position.set(0, 1.0, 0.9);
    g.add(eyes);

    setupEntity(g, x, z, 'wolf');
}

function createRabbit(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), mats.white);
    body.position.y = 0.25;
    g.add(body);
    const ears = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.05), mats.white);
    ears.position.set(0, 0.5, 0);
    g.add(ears);
    setupEntity(g, x, z, 'rabbit');
}

function createFox(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.8), mats.orange);
    body.position.y = 0.35;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), mats.orange);
    tail.position.set(0, 0.5, -0.6);
    tail.rotation.x = 0.5;
    g.add(tail);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), mats.orange);
    head.rotation.x = -Math.PI/2;
    head.position.set(0, 0.5, 0.5);
    g.add(head);
    setupEntity(g, x, z, 'fox');
}

function createCat(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), new THREE.MeshStandardMaterial({color:0x222}));
    body.position.y = 0.3;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshStandardMaterial({color:0x222}));
    head.position.set(0, 0.5, 0.3);
    g.add(head);
    setupEntity(g, x, z, 'cat');
}

function createCarrot(x, z) {
    const g = new THREE.Group();
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 8), mats.orange);
    root.rotation.x = Math.PI;
    root.position.y = 0.2;
    g.add(root);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 4), mats.leaf);
    leaf.position.y = 0.4;
    g.add(leaf);
    
    // Add to interactive list but NOT animal list
    g.position.set(x, 0, z);
    g.userData = { type: 'carrot', id: Math.random() };
    scene.add(g);
    entities.push(g);
}

function createFence(x, z) {
    const g = new THREE.Group();
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), mats.wood);
    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 0.2), mats.wood);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.1), mats.wood);
    post1.position.set(-0.6, 0.5, 0);
    post2.position.set(0.6, 0.5, 0);
    rail.position.set(0, 0.7, 0);
    g.add(post1); g.add(post2); g.add(rail);
    
    g.position.set(x, 0, z);
    g.userData = { type: 'fence', id: Math.random() };
    scene.add(g);
    entities.push(g);
}

function createBonfire(x, z) {
    const g = new THREE.Group();
    // Logs
    for(let i=0; i<3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 5), mats.wood);
        log.rotation.z = Math.PI/2;
        log.rotation.y = i * (Math.PI/3);
        log.position.y = 0.1;
        g.add(log);
    }
    // Light
    const fireLight = new THREE.PointLight(0xffaa00, 2, 15);
    fireLight.position.y = 1;
    fireLight.castShadow = true;
    g.add(fireLight);

    g.position.set(x, 0, z);
    g.userData = { type: 'bonfire', id: Math.random() };
    scene.add(g);
    entities.push(g);
}

function createPond(x, z) {
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 12), mats.water);
    pond.position.set(x, 0.05, z);
    pond.userData = { type: 'pond', id: Math.random() };
    scene.add(pond);
    entities.push(pond);
}

function createTree(x, z, type) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 6), mats.wood);
    trunk.position.y = 1.5;
    g.add(trunk);
    
    let leaf;
    if(type === 'pine') {
        leaf = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 8), mats.leaf);
        leaf.position.y = 3.5;
    } else {
        leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5), mats.leaf);
        leaf.position.y = 3;
    }
    g.add(leaf);
    
    g.position.set(x, 0, z);
    g.userData = { type: type, id: Math.random() };
    scene.add(g);
    entities.push(g);
}

// Helper to init animals
function setupEntity(mesh, x, z, type) {
    mesh.position.set(x, 0, z);
    mesh.userData = { 
        type: type, 
        id: Math.random(),
        state: 'idle',
        goal: new THREE.Vector3(x,0,z),
        wait: 0
    };
    mesh.castShadow = true;
    scene.add(mesh);
    entities.push(mesh);
    animals.push(mesh);
}

// --- 5. LOGIC & AI ---

function handleNightSpawns() {
    // Only spawn wolves once per night start
    if (isNight && scene.children.filter(c => c.userData.type === 'wolf').length === 0) {
        for(let i=0; i<3; i++) {
            const angle = Math.random() * Math.PI * 2;
            createWolf(Math.cos(angle)*60, Math.sin(angle)*60);
        }
        nightKills.count = 0; // Reset kill counter
    }
    
    // Despawn wolves at day
    if (!isNight) {
        const wolves = entities.filter(e => e.userData.type === 'wolf');
        wolves.forEach(w => removeEntity(w));
    }
}

function updateAI(dt) {
    // Wake up dogs check
    const dogsAlert = isNight && nightKills.count >= 2;

    animals.forEach(anim => {
        const data = anim.userData;
        const pos = anim.position;

        // SLEEP LOGIC
        if (isNight && data.type !== 'wolf' && data.type !== 'dog') {
            anim.rotation.z = Math.PI / 2; // Lie down
            anim.position.y = 0.2;
            return; // Skip movement
        }
        if (isNight && data.type === 'dog' && !dogsAlert) {
            anim.rotation.z = Math.PI / 2; // Dog sleeps unless alert
            anim.position.y = 0.2;
            return;
        }

        // Wake up animation reset
        if (anim.rotation.z !== 0) {
            anim.rotation.z = 0;
            anim.position.y = (data.type === 'sheep' || data.type === 'wolf') ? 0.6 : 0.4;
        }

        // --- BEHAVIOR TREE ---
        let speed = 0.05;
        let target = null;

        // 1. WOLF BEHAVIOR (Night Hunter)
        if (data.type === 'wolf') {
            // Flee from dogs if alert
            if (dogsAlert) {
                const dog = findNearest(pos, 'dog');
                if (dog) {
                    target = pos.clone().sub(dog.position).normalize().multiplyScalar(10).add(pos);
                    speed = 0.15; // Run fast
                }
            } else {
                // Hunt
                const prey = findNearest(pos, ['sheep', 'rabbit', 'cat']);
                if (prey) {
                    target = prey.position;
                    speed = 0.1;
                    if (pos.distanceTo(target) < 1.5) {
                        removeEntity(prey);
                        nightKills.count++;
                    }
                }
            }
        }

        // 2. FOX BEHAVIOR (Day Hunter)
        else if (data.type === 'fox') {
            // Flee from Dog
            const dog = findNearest(pos, 'dog');
            if (dog && pos.distanceTo(dog.position) < 10) {
                target = pos.clone().sub(dog.position).normalize().multiplyScalar(10).add(pos);
                speed = 0.12;
            } else {
                // Hunt Rabbit/Sheep
                const prey = findNearest(pos, ['rabbit', 'sheep']);
                if (prey) {
                    target = prey.position;
                    speed = 0.08;
                    if (pos.distanceTo(target) < 1) removeEntity(prey);
                }
            }
        }

        // 3. DOG BEHAVIOR (Protector)
        else if (data.type === 'dog') {
            const threat = findNearest(pos, ['fox', 'wolf']);
            if (threat) {
                target = threat.position;
                speed = 0.11; // Chase
            }
        }

        // 4. RABBIT BEHAVIOR (Thief)
        else if (data.type === 'rabbit') {
            const carrot = findNearest(pos, 'carrot');
            if (carrot) {
                target = carrot.position;
                if (pos.distanceTo(target) < 1) {
                    removeEntity(carrot); // Eat carrot
                }
            }
            // Flee from Fox/Wolf
            const pred = findNearest(pos, ['fox', 'wolf']);
            if (pred && pos.distanceTo(pred.position) < 8) {
                target = pos.clone().sub(pred.position).normalize().multiplyScalar(10).add(pos);
                speed = 0.15;
            }
        }
        
        // 5. SHEEP/CAT/DUCK (Wander or Flee)
        else {
             const pred = findNearest(pos, ['fox', 'wolf']);
             if (pred && pos.distanceTo(pred.position) < 8) {
                target = pos.clone().sub(pred.position).normalize().multiplyScalar(8).add(pos);
                speed = 0.1;
             } else if (data.type === 'duck') {
                 // Stay near water? (Simplified: just wander)
             }
        }

        // MOVEMENT EXECUTION
        if (target) {
            anim.lookAt(target.x, anim.position.y, target.z);
            const dir = new THREE.Vector3().subVectors(target, pos).normalize();
            
            // Fence Collision Check (Simple)
            const nextPos = pos.clone().add(dir.multiplyScalar(speed));
            if (!checkCollision(nextPos)) {
                anim.position.add(dir.multiplyScalar(speed));
            }
        } else {
            // Random Wander
            if (data.wait > 0) {
                data.wait--;
            } else {
                if (Math.random() > 0.98) {
                    const angle = Math.random() * Math.PI * 2;
                    data.goal.set(pos.x + Math.cos(angle)*5, 0, pos.z + Math.sin(angle)*5);
                    data.wait = 60;
                }
                anim.lookAt(data.goal.x, anim.position.y, data.goal.z);
                anim.position.lerp(data.goal, 0.01);
            }
        }
    });
}

function findNearest(pos, types) {
    let nearest = null;
    let minDist = 999;
    
    // Check animals
    animals.forEach(a => {
        if (Array.isArray(types) ? types.includes(a.userData.type) : a.userData.type === types) {
            const d = pos.distanceTo(a.position);
            if (d < minDist) { minDist = d; nearest = a; }
        }
    });

    // Check static entities (Carrots)
    if (types === 'carrot' || (Array.isArray(types) && types.includes('carrot'))) {
        entities.forEach(e => {
            if (e.userData.type === 'carrot') {
                const d = pos.distanceTo(e.position);
                if (d < minDist) { minDist = d; nearest = e; }
            }
        });
    }

    return nearest;
}

function checkCollision(pos) {
    // Very simple check: is there a fence too close?
    for (let e of entities) {
        if (e.userData.type === 'fence') {
            if (pos.distanceTo(e.position) < 0.8) return true;
        }
    }
    return false;
}

function removeEntity(obj) {
    scene.remove(obj);
    const idx = entities.indexOf(obj);
    if (idx > -1) entities.splice(idx, 1);
    const aIdx = animals.indexOf(obj);
    if (aIdx > -1) animals.splice(aIdx, 1);
}

// --- 6. INTERACTION ---
let currentTool = 'oak';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.type;
        document.getElementById('instruction-toast').innerText = currentTool === 'eraser' ? "Tap an object to delete!" : "Tap ground to place!";
    });
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
    if(confirm("Destroy everything?")) location.reload();
});

const canvas = document.getElementById('canvas-container');
canvas.addEventListener('pointerup', (e) => {
    // Simple click check
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // ERASER LOGIC
    if (currentTool === 'eraser') {
        const intersects = raycaster.intersectObjects(entities, true);
        if (intersects.length > 0) {
            // Find the root group of the object
            let target = intersects[0].object;
            while(target.parent && target.parent !== scene) target = target.parent;
            removeEntity(target);
        }
        return;
    }

    // BUILD LOGIC
    const intersects = raycaster.intersectObject(ground);
    if (intersects.length > 0) {
        const p = intersects[0].point;
        if(currentTool === 'oak' || currentTool === 'pine') createTree(p.x, p.z, currentTool);
        else if(currentTool === 'sheep') createSheep(p.x, p.z);
        else if(currentTool === 'duck') createDuck(p.x, p.z);
        else if(currentTool === 'dog') createDog(p.x, p.z);
        else if(currentTool === 'fox') createFox(p.x, p.z);
        else if(currentTool === 'rabbit') createRabbit(p.x, p.z);
        else if(currentTool === 'cat') createCat(p.x, p.z);
        else if(currentTool === 'carrot') createCarrot(p.x, p.z);
        else if(currentTool === 'fence') createFence(p.x, p.z);
        else if(currentTool === 'bonfire') createBonfire(p.x, p.z);
        else if(currentTool === 'pond') createPond(p.x, p.z);
    }
});

// --- 7. ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    const dt = 0.016; // Approx 60fps

    updateDayNight(dt);
    updateAI(dt);
    
    // Wind
    vegetation.forEach(v => {
        const wind = Math.sin(gameTime * v.userData.speed + v.userData.phase) * 0.1;
        v.rotation.x = v.userData.baseRot.x + wind;
    });

    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
