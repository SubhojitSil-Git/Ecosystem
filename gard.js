// gard.js - EcoSim Creative Mode (Web Edition)

// --- 1. SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky Blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
scene.add(sunLight);

// Ground
const groundGroup = new THREE.Group();
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200), 
    new THREE.MeshStandardMaterial({ color: 0x5aa85a }) // Grass Green
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
groundGroup.add(ground);

// Grid Helper (Visible grid lines to help building)
const gridHelper = new THREE.GridHelper(200, 100, 0x000000, 0x000000);
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
groundGroup.add(gridHelper);
scene.add(groundGroup);

// --- 2. MATERIALS & CONFIG ---
const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x808080 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.6 }),
    roof: new THREE.MeshStandardMaterial({ color: 0xA52A2A }), 
    leavesOak: new THREE.MeshStandardMaterial({ color: 0x228B22 }),
    leavesPine: new THREE.MeshStandardMaterial({ color: 0x2E8B57 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1E90FF, transparent: true, opacity: 0.8 }),
    fire: new THREE.MeshStandardMaterial({ color: 0xFF4500, emissive: 0xFF0000 }),
    ghost: new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5, wireframe: true }),
    whiteFur: new THREE.MeshStandardMaterial({ color: 0xFFFFFF }),
    duckBill: new THREE.MeshStandardMaterial({ color: 0xFFA500 })
};

// Item Database
// snap: does it lock to the grid?
// offset: how high off the ground is the center?
function getItemConfig(type) {
    switch(type) {
        // Building Blocks
        case 'wall_wood': return { size: [2, 2, 0.2], offset: 1, mat: mats.wood, snap: true };
        case 'wall_stone': return { size: [2, 2, 0.4], offset: 1, mat: mats.stone, snap: true };
        case 'wall_glass': return { size: [2, 2, 0.1], offset: 1, mat: mats.glass, snap: true };
        case 'door':       return { size: [1.2, 2, 0.1], offset: 1, mat: mats.wood, snap: true };
        case 'roof':       return { size: [2.2, 1.5, 2.2], offset: 0.75, mat: mats.roof, snap: true, geo: 'pyramid' };
        case 'fence':      return { size: [2, 1, 0.2], offset: 0.5, mat: mats.wood, snap: true };
        
        // Nature
        case 'oak':        return { snap: false, offset: 0 };
        case 'pine':       return { snap: false, offset: 0 };
        case 'flower':     return { snap: false, offset: 0 };
        case 'bonfire':    return { snap: false, offset: 0 };
        case 'water':      return { snap: false, offset: 0.05 };

        // Animals
        case 'duck':       return { snap: false, offset: 0 };
        case 'sheep':      return { snap: false, offset: 0 };

        default: return { snap: false };
    }
}

// --- 3. STATE ---
let currentTool = 'wall_wood';
let isDeleteMode = false;
let currentRotation = 0;
const objects = []; // Stores all placed items
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Ghost Mesh (The preview box)
const ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mats.ghost);
scene.add(ghostMesh);

// --- 4. HELPERS ---

// Update the shape of the Ghost based on selected tool
function updateGhost() {
    const config = getItemConfig(currentTool);
    
    if(ghostMesh.geometry) ghostMesh.geometry.dispose();

    if (config.geo === 'pyramid') {
        ghostMesh.geometry = new THREE.ConeGeometry(1.5, 1.5, 4);
    } else if (config.snap) {
        ghostMesh.geometry = new THREE.BoxGeometry(...config.size);
    } else if (['oak', 'pine'].includes(currentTool)) {
        ghostMesh.geometry = new THREE.CylinderGeometry(0.5, 0.5, 2);
    } else {
        ghostMesh.geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    }
    
    // Red if deleting, Green if building
    ghostMesh.material.color.setHex(isDeleteMode ? 0xFF0000 : 0x00FF00);
}
updateGhost();

// Create the actual object to place in the world
function createMesh(type) {
    const config = getItemConfig(type);
    let mesh;

    if (type === 'oak') {
        mesh = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), mats.wood); trunk.position.y = 0.75;
        const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), mats.leavesOak); leaves.position.y = 2;
        mesh.add(trunk, leaves);
    } else if (type === 'pine') {
        mesh = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1), mats.wood); trunk.position.y = 0.5;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), mats.leavesPine); leaves.position.y = 2;
        mesh.add(trunk, leaves);
    } else if (type === 'bonfire') {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5), mats.fire);
        const light = new THREE.PointLight(0xFF4500, 1, 10);
        mesh.add(light);
    } else if (type === 'flower') {
        mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), new THREE.MeshStandardMaterial({color: Math.random()*0xffffff}));
    } else if (type === 'water') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(2,2,0.1,16), mats.water);
    } else if (type === 'duck') {
        mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.8), mats.whiteFur); body.position.y=0.2;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mats.whiteFur); head.position.set(0, 0.6, 0.4);
        const bill = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.3), mats.duckBill); bill.position.set(0, 0.55, 0.7);
        mesh.add(body, head, bill);
    } else if (type === 'sheep') {
        mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), mats.whiteFur); body.position.y=0.6;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mats.stone); head.position.set(0, 1, 0.8);
        mesh.add(body, head);
    } else if (config.geo === 'pyramid') {
        mesh = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.5, 4), config.mat);
        mesh.rotation.y = Math.PI / 4; 
    } else {
        // Standard Building Blocks (Walls, Doors)
        mesh = new THREE.Mesh(new THREE.BoxGeometry(...config.size), config.mat);
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// --- 5. INTERACTION LOGIC ---

// Mouse Move: Updates Ghost Position
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // Intersect Ground AND existing objects (to stack walls)
    const intersects = raycaster.intersectObjects([ground, ...objects], true);

    if (intersects.length > 0) {
        const hit = intersects[0];
        const config = getItemConfig(currentTool);
        
        ghostMesh.visible = true;

        if (config.snap) {
            // GRID SNAP LOGIC
            let tx = hit.point.x;
            let tz = hit.point.z;
            let ty = hit.point.y;

            // If we hit another object, stack on top
            if (hit.object !== ground) {
                // Find the parent group if we hit a complex object
                let target = hit.object;
                while(target.parent && target.parent !== scene) target = target.parent;
                
                ty = target.position.y + 1; // Basic stacking height
                tx = target.position.x;     // Align X
                tz = target.position.z;     // Align Z
            } else {
                // Snap X/Z to 2-unit grid
                tx = Math.round(tx / 2) * 2;
                tz = Math.round(tz / 2) * 2;
                ty = 0; 
            }

            ghostMesh.position.set(tx, ty + config.offset, tz);
            ghostMesh.rotation.y = currentRotation;
        } else {
            // FREE PLACEMENT (Nature/Animals)
            ghostMesh.position.copy(hit.point);
            ghostMesh.position.y += (config.offset || 0);
        }
    } else {
        ghostMesh.visible = false;
    }
});

// Click: Place or Delete
window.addEventListener('pointerdown', (e) => {
    // Ignore clicks on UI buttons
    if (e.target.closest('#ui-layer')) return; 

    if (isDeleteMode) {
        // DELETE LOGIC
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(objects, true);
        if (intersects.length > 0) {
            let target = intersects[0].object;
            // Traverse up to find the root object (e.g. if we clicked a leaf, remove the whole tree)
            while(target.parent && target.parent !== scene) target = target.parent;
            
            scene.remove(target);
            objects.splice(objects.indexOf(target), 1);
        }
    } else {
        // BUILD LOGIC
        if (!ghostMesh.visible) return;
        
        // --- HIDE INSTRUCTION ON FIRST SPAWN ---
        const toast = document.getElementById('instruction-toast');
        if (toast) toast.style.display = 'none';
        // ---------------------------------------

        const mesh = createMesh(currentTool);
        mesh.position.copy(ghostMesh.position);
        mesh.rotation.y = ghostMesh.rotation.y;
        
        // Random rotation for nature items to look natural
        const config = getItemConfig(currentTool);
        if(!config.snap) mesh.rotation.y = Math.random() * Math.PI * 2;

        scene.add(mesh);
        objects.push(mesh);
        
        // "Pop" animation
        mesh.scale.set(0,0,0);
        let s = 0;
        const grow = setInterval(() => {
            s += 0.15;
            mesh.scale.set(s,s,s);
            if(s>=1) {
                mesh.scale.set(1,1,1);
                clearInterval(grow);
            }
        }, 16);
    }
});

// --- 6. UI EVENT LISTENERS ---

// Toolbar Buttons
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // 1. Remove active class from all
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        // 2. Add active to clicked
        const targetBtn = e.currentTarget; // safe way to get the .tool-btn
        targetBtn.classList.add('active');
        
        // 3. Set Tool
        currentTool = targetBtn.dataset.type;
        
        // 4. Reset Delete Mode
        isDeleteMode = false;
        document.getElementById('delete-btn').classList.remove('active');
        updateGhost();
    });
});

// Rotate Button
document.getElementById('rotate-btn').addEventListener('click', () => {
    currentRotation += Math.PI / 2;
    ghostMesh.rotation.y = currentRotation;
});

// Delete Button
document.getElementById('delete-btn').addEventListener('click', (e) => {
    isDeleteMode = !isDeleteMode;
    e.currentTarget.classList.toggle('active'); // Toggle red color
    updateGhost();
});

// Save Button (Simulation)
document.getElementById('save-btn').addEventListener('click', () => {
    alert(`Saved ${objects.length} objects to local storage!`);
});

// Camera D-Pad Controls
const camSpeed = 1;
document.getElementById('cam-up').onclick = () => { camera.position.z -= 5; controls.target.z -= 5; }
document.getElementById('cam-down').onclick = () => { camera.position.z += 5; controls.target.z += 5; }
document.getElementById('cam-left').onclick = () => { camera.position.x -= 5; controls.target.x -= 5; }
document.getElementById('cam-right').onclick = () => { camera.position.x += 5; controls.target.x += 5; }

// --- 7. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
