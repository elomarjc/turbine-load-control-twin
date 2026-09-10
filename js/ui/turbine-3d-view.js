/**
 * 3D Wind Turbine WebGL Visualizer (Three.js)
 * Renders an offshore 15 MW turbine with rotating hub, individually pitched blades,
 * atmospheric wind shear velocity profile, and ocean surface.
 */
export class Turbine3DView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth || 640;
        this.height = this.container.clientHeight || 420;

        this.initThree();
    }

    initThree() {
        const THREE = window.THREE;
        if (!THREE) return;

        // Scene, Camera, Renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060911);
        this.scene.fog = new THREE.FogExp2(0x060911, 0.0018);

        this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 1, 1500);
        const isMobileAspect = (this.width / this.height) < 1.0;
        const camX = isMobileAspect ? 240 : 160;
        const camY = isMobileAspect ? 200 : 160;
        const camZ = isMobileAspect ? 420 : 260;
        this.camera.position.set(camX, camY, camZ);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(200, 300, 150);
        this.scene.add(dirLight);

        // Ocean Water Plane
        const waterGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x0a192f,
            roughness: 0.2,
            metalness: 0.7,
            wireframe: false
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0;
        this.scene.add(water);

        // Monopile & Tower (150m tall)
        const towerGeo = new THREE.CylinderGeometry(4.0, 7.5, 150, 32);
        const towerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = 75;
        this.scene.add(tower);

        // Nacelle
        const nacelleGeo = new THREE.BoxGeometry(18, 9, 26);
        const nacelleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
        this.nacelle = new THREE.Mesh(nacelleGeo, nacelleMat);
        this.nacelle.position.set(0, 150, 4);
        this.scene.add(this.nacelle);

        // Rotor Hub (Rotates with azimuth)
        this.hubGroup = new THREE.Group();
        this.hubGroup.position.set(0, 150, 16);
        this.scene.add(this.hubGroup);

        const hubGeo = new THREE.ConeGeometry(5.5, 10, 24);
        const hubMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
        const hubMesh = new THREE.Mesh(hubGeo, hubMat);
        hubMesh.rotation.x = Math.PI / 2;
        this.hubGroup.add(hubMesh);

        // 3 Blades (individually pitched groups)
        this.bladePivots = [];
        const bladeGeo = new THREE.ConeGeometry(2.8, 118, 16);
        bladeGeo.translate(0, 59, 0); // Origin at blade root

        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });

        for (let i = 0; i < 3; i++) {
            let pivot = new THREE.Group();
            // Position root on hub radius
            let bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
            // Add aerodynamic twist / flat profile
            bladeMesh.scale.set(0.4, 1.0, 1.2);
            pivot.add(bladeMesh);

            let bladeMount = new THREE.Group();
            bladeMount.rotation.z = i * (2 * Math.PI / 3);
            bladeMount.add(pivot);

            this.hubGroup.add(bladeMount);
            this.bladePivots.push(pivot);
        }

        // Wind Shear Velocity Arrows Visualization
        this.initWindShearArrows();

        // Mouse Orbit Controls (basic)
        this.setupCameraControls();
        this.camera.lookAt(0, 140, 0);
    }

    initWindShearArrows() {
        const THREE = window.THREE;
        this.windArrows = new THREE.Group();
        this.windArrows.position.set(-60, 0, 16);

        for (let h = 30; h <= 270; h += 30) {
            let speed = 12.0 * Math.pow(h / 150.0, 0.2);
            let arrowLength = speed * 2.8;
            let dir = new THREE.Vector3(0, 0, 1);
            let origin = new THREE.Vector3(0, h, -arrowLength);
            let color = h >= 150 ? 0xef4444 : 0x10b981;
            let arrow = new THREE.ArrowHelper(dir, origin, arrowLength, color, 4, 2);
            this.windArrows.add(arrow);
        }
        this.scene.add(this.windArrows);
    }

    setupCameraControls() {
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let deltaX = e.clientX - prevMouseX;
            let deltaY = e.clientY - prevMouseY;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;

            // Rotate camera around center
            let theta = deltaX * 0.006;
            let phi = deltaY * 0.006;

            let x = this.camera.position.x;
            let z = this.camera.position.z;
            this.camera.position.x = x * Math.cos(theta) - z * Math.sin(theta);
            this.camera.position.z = x * Math.sin(theta) + z * Math.cos(theta);
            this.camera.position.y = Math.max(20, Math.min(300, this.camera.position.y + phi * 100));

            this.camera.lookAt(0, 140, 0);
        });

        window.addEventListener('mouseup', () => { isDragging = false; });

        // Mobile touch rotation support
        let prevTouchX = 0, prevTouchY = 0;
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                prevTouchX = e.touches[0].clientX;
                prevTouchY = e.touches[0].clientY;
            }
        }, { passive: true });
        this.renderer.domElement.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                let dx = e.touches[0].clientX - prevTouchX;
                let dy = e.touches[0].clientY - prevTouchY;
                prevTouchX = e.touches[0].clientX;
                prevTouchY = e.touches[0].clientY;
                let theta = dx * 0.008;
                let phi = dy * 0.008;
                let x = this.camera.position.x;
                let z = this.camera.position.z;
                this.camera.position.x = x * Math.cos(theta) - z * Math.sin(theta);
                this.camera.position.z = x * Math.sin(theta) + z * Math.cos(theta);
                this.camera.position.y = Math.max(20, Math.min(350, this.camera.position.y + phi * 100));
                this.camera.lookAt(0, 140, 0);
            }
        }, { passive: true });

        window.addEventListener('resize', () => {
            this.width = this.container.clientWidth || window.innerWidth;
            this.height = this.container.clientHeight || window.innerHeight;
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
        });
        
    }

    update(physics) {
        if (!this.hubGroup) return;

        // Rotate hub with rotor azimuth
        this.hubGroup.rotation.z = -physics.azimuth;

        // Apply individual blade pitch angles around blade longitudinal axis (Y-axis of pivot)
        for (let i = 0; i < 3; i++) {
            if (this.bladePivots[i]) {
                this.bladePivots[i].rotation.y = physics.bladePitches[i];
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}
