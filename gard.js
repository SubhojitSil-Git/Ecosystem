// gard.js - Interactive Ecosystem

// --- 1. Scene Setup & Config ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87CEEB, 0.015);
scene.background = new THREE.Color(0x87CEEB);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 50);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Lock above ground
controls.minDistance = 10;
controls.maxDistance = 100;

// --- 2. Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
sunLight.position.set(50, 80, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// --- 3. The Living Ground (Your Requested Code) ---
const groundGroup = new THREE.Group();
scene.add(groundGroup);

// Main floor
const groundMesh = new THREE.Mesh(
    new THREE.CircleGeometry(150, 64),
    new THREE.MeshStandardMaterial({ color: 0x5aa85a, roughness: 1 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
groundGroup.add(groundMesh);

// Vegetation System (Grass & Flowers - Preserved)
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
            // Flower
            mesh = new THREE.Mesh(
                geoFlower,
                new THREE.MeshStandardMaterial({ 
                    color: flowerColors[Math.floor(Math.random() * flowerColors.length)] 
                })
            );
            mesh.position.y = 0.4;
        } else {
            // Grass
            mesh = new THREE.Mesh(
                geoGrass,
                new THREE.MeshStandardMaterial({ color: 0x4a9c4a })
            );
            mesh.position.y = 0.4;
        }
        
        mesh.position.set(x, mesh.position.y, z);
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.rotation.x = (Math.random() - 0.5) * 0.4;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Custom data for wind animation
        mesh.userData = { 
            baseRot: mesh.rotation.clone(), 
            phase: Math.random() * 10,
            speed: 0.5 + Math.random() 
        };
        
        groundGroup.add(mesh);
        vegetation.push(mesh);
    }
}
plantVegetation();

// --- 4. Interactive Object Builders ---

// Materials Cache
const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
    leafOak: new THREE.MeshStandardMaterial({ color: 0x228B22 }),
    leafPine: new THREE.MeshStandardMaterial({ color: 0x006400 }),
    leafPalm: new THREE.MeshStandardMaterial({ color: 0x32CD32 }),
    water: new THREE.MeshStandardMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.7 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x808080 }),
    fox: new THREE.MeshStandardMaterial({ color: 0xD2691E }),
    rabbit: new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
};

const updateList = []; // Array for animated objects (animals, water)

function createTree(type, x, z) {
    const group = new THREE.Group();
    const trunkH = type === 'palm' ? 4 : 2.5;
    
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, trunkH, 6), mats.wood);
    trunk.position.y = trunkH/2;
    trunk.castShadow = true;
    group.add(trunk);

    // Leaves
    let leaf;
    if(type === 'pine') {
        leaf = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 8), mats.leafPine);
        leaf.position.y = 3;
    } else if (type === 'palm') {
        leaf = new THREE.Group();
        for(let i=0; i<6; i++) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 3), mats.leafPalm);
            b.position.y = 4;
            b.rotation.y = (i/6)*Math.PI*2;
            b.rotation.x = 0.4;
            b.translateZ(1.2);
            leaf.add(b);
        }
    } else { // Oak
        leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5), mats.leafOak);
        leaf.position.y = 3;
        leaf.scale.set(1.5, 1, 1.5);
    }
    leaf.castShadow = true;
    group.add(leaf);

    // Pop Animation
    group.scale.set(0,0,0);
    updateList.push({ type: 'growth', obj: group, target: 1 + Math.random()*0.5 });
    
    group.position.set(x, 0, z);
    scene.add(group);
}

function createWater(type, x, z) {
    if(type === 'pond') {
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 16), mats.water);
        pond.position.set(x, 0.1, z);
        scene.add(pond);
    } else if (type === 'waterfall') {
        const group = new THREE.Group();
        // Cliff
        const cliff = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 3), mats.rock);
        cliff.position.y = 3;
        group.add(cliff);
        // Water
        const w = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 0.5), mats.water);
        w.position.set(0, 3, 1.6);
        group.add(w);
        // Particle System
        const particles = [];
        const pGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        group.userData.update = () => {
            if(Math.random() > 0.5) {
                const p = new THREE.Mesh(pGeo, mats.water);
                p.position.set((Math.random()-0.5)*1.5, 6, 1.8);
                group.add(p);
                particles.push(p);
            }
            for(let i=particles.length-1; i>=0; i--) {
                const p = particles[i];
                p.position.y -= 0.2;
                if(p.position.y < 0) {
                    group.remove(p);
                    particles.splice(i, 1);
                }
            }
        };
        updateList.push({ type: 'custom', obj: group });
        group.position.set(x, 0, z);
        scene.add(group);
    }
}

function createAnimal(type, x, z) {
    const group = new THREE.Group();
    const mat = type === 'fox' ? mats.fox : mats.rabbit;
    
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), mat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
    head.position.set(0, 0.7, 0.5);
    head.castShadow = true;
    group.add(head);

    group.position.set(x, 0, z);
    
    // AI Data
    group.userData = {
        state: 'idle',
        goal: new THREE.Vector3(x, 0, z),
        wait: 0
    };
    
    updateList.push({ type: 'ai', obj: group, speed: type==='fox'?0.05:0.03 });
    scene.add(group);
}

// --- 5. Interaction ---
let currentTool = 'oak';
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDragging = false; // To distinguish between drag-cam and tap

// Toolbar Logic
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentTool = e.currentTarget.dataset.type;
    });
});

document.getElementById('clear-btn').addEventListener('click', () => {
    if(confirm("Clear ecosystem?")) location.reload();
});

// Touch/Click Logic
const canvas = document.getElementById('canvas-container');

canvas.addEventListener('pointerdown', () => isDragging = false);
canvas.addEventListener('pointermove', () => isDragging = true);
canvas.addEventListener('pointerup', (e) => {
    if(isDragging) return; // Camera moved, don't build

    // Normalize mouse
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundMesh);

    if(intersects.length > 0) {
        const pt = intersects[0].point;
        buildItem(pt.x, pt.z);
    }
});

function buildItem(x, z) {
    // Slight randomization
    x += (Math.random()-0.5)*0.5;
    z += (Math.random()-0.5)*0.5;

    if(['oak','pine','palm'].includes(currentTool)) createTree(currentTool, x, z);
    else if(['pond','waterfall'].includes(currentTool)) createWater(currentTool, x, z);
    else if(['fox','rabbit'].includes(currentTool)) createAnimal(currentTool, x, z);
    else if(currentTool === 'rock') {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mats.rock);
        r.position.set(x, 0.3, z);
        r.castShadow = true;
        scene.add(r);
    }
}

// --- 6. Animation Loop ---
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // 1. Vegetation Sway (Your requested logic)
    vegetation.forEach(v => {
        const wind = Math.sin(time * v.userData.speed + v.userData.phase) * 0.1;
        v.rotation.x = v.userData.baseRot.x + wind;
        v.rotation.z = v.userData.baseRot.z + (wind * 0.5);
    });

    // 2. Interactive Objects Update
    updateList.forEach(item => {
        // Growth pop-in
        if(item.type === 'growth') {
            if(item.obj.scale.x < item.target) item.obj.scale.addScalar(0.05);
        }
        // Waterfall Particles
        if(item.type === 'custom') {
            item.obj.userData.update();
        }
        // Animal AI
        if(item.type === 'ai') {
            const animal = item.obj;
            // Hop animation
            animal.position.y = Math.abs(Math.sin(time * 5)) * 0.3;
            
            if(animal.userData.state === 'idle') {
                if(Math.random() > 0.99) {
                    animal.userData.state = 'moving';
                    const angle = Math.random() * Math.PI * 2;
                    animal.userData.goal.set(
                        animal.position.x + Math.cos(angle)*6,
                        0,
                        animal.position.z + Math.sin(angle)*6
                    );
                    animal.lookAt(animal.userData.goal);
                }
            } else {
                const dir = new THREE.Vector3().subVectors(animal.userData.goal, animal.position).normalize();
                animal.position.add(dir.multiplyScalar(item.speed));
                if(animal.position.distanceTo(animal.userData.goal) < 0.5) {
                    animal.userData.state = 'idle';
                }
            }
        }
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