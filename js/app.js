import { TurbinePhysics } from './engine/turbine-physics.js';
import { PitchController } from './engine/pitch-controller.js';
import { ColemanTransform } from './engine/coleman-transform.js';
import { RainflowFatigueEstimator } from './engine/rainflow-fatigue.js';

import { Turbine3DView } from './ui/turbine-3d-view.js';
import { TelemetryChart } from './ui/telemetry-chart.js';

class TurbineTwinApp {
    constructor() {
        this.physics = new TurbinePhysics();
        this.controller = new PitchController(this.physics.omegaRated);
        this.fatigue = new RainflowFatigueEstimator(10.0);

        this.view3d = new Turbine3DView('turbine3dContainer');
        this.chart = new TelemetryChart('telemetryCanvas');

        this.initUI();
        this.startLoop();

        // =========================================================
        // Floating HUD Overlay & Telemetry Drawer Interactivity
        // =========================================================
        this.setupFloatingHUDBindings();
    }

    setupFloatingHUDBindings() {
        // 1. Wind Speed Vertical HUD Rail Synchronization
        const windInput = document.getElementById('slider-wind-vertical');
        const windContainer = document.getElementById('wind-rail-container');
        const windFill = document.getElementById('wind-rail-fill');
        const windThumb = document.getElementById('wind-rail-thumb');
        const windPill = document.getElementById('val-wind-pill');
        const mainWindSlider = document.getElementById('windSlider');
        const mainWindVal = document.getElementById('windVal');

        const updateWindUI = (val) => {
            const clamped = Math.max(8.0, Math.min(22.0, val));
            this.physics.vHub = clamped;
            if (windInput) windInput.value = clamped;
            if (mainWindSlider) mainWindSlider.value = clamped;
            const text = `${clamped.toFixed(1)} m/s`;
            if (windPill) windPill.textContent = text;
            if (mainWindVal) mainWindVal.innerText = text;
            const pct = ((clamped - 8.0) / (22.0 - 8.0)) * 100;
            if (windFill) windFill.style.height = `${pct}%`;
            if (windThumb) windThumb.style.bottom = `${pct}%`;
        };

        windInput?.addEventListener('input', (e) => updateWindUI(parseFloat(e.target.value)));
        
        // Track dragging for Wind
        let draggingWind = false;
        const handleWindPointer = (e) => {
            const rect = windContainer.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
            updateWindUI(8.0 + frac * 14.0);
        };
        windContainer?.addEventListener('pointerdown', (e) => {
            draggingWind = true;
            windContainer.setPointerCapture(e.pointerId);
            windContainer.classList.add('active');
            handleWindPointer(e);
        });
        windContainer?.addEventListener('pointermove', (e) => {
            if (draggingWind) handleWindPointer(e);
        });
        const stopWindDrag = (e) => {
            if (draggingWind) {
                draggingWind = false;
                windContainer?.classList.remove('active');
            }
        };
        windContainer?.addEventListener('pointerup', stopWindDrag);
        windContainer?.addEventListener('pointercancel', stopWindDrag);

        // 2. Wind Shear Vertical HUD Rail Synchronization
        const shearInput = document.getElementById('slider-shear-vertical');
        const shearContainer = document.getElementById('shear-rail-container');
        const shearFill = document.getElementById('shear-rail-fill');
        const shearThumb = document.getElementById('shear-rail-thumb');
        const shearPill = document.getElementById('val-shear-pill');
        const mainShearSlider = document.getElementById('shearSlider');
        const mainShearVal = document.getElementById('shearVal');

        const updateShearUI = (val) => {
            const clamped = Math.max(0.05, Math.min(0.35, val));
            this.physics.alphaShear = clamped;
            if (shearInput) shearInput.value = clamped;
            if (mainShearSlider) mainShearSlider.value = clamped;
            const text = `${clamped.toFixed(2)}α`;
            if (shearPill) shearPill.textContent = text;
            if (mainShearVal) mainShearVal.innerText = clamped.toFixed(2);
            const pct = ((clamped - 0.05) / (0.35 - 0.05)) * 100;
            if (shearFill) shearFill.style.height = `${pct}%`;
            if (shearThumb) shearThumb.style.bottom = `${pct}%`;
        };

        shearInput?.addEventListener('input', (e) => updateShearUI(parseFloat(e.target.value)));

        // Track dragging for Shear
        let draggingShear = false;
        const handleShearPointer = (e) => {
            const rect = shearContainer.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
            updateShearUI(0.05 + frac * 0.30);
        };
        shearContainer?.addEventListener('pointerdown', (e) => {
            draggingShear = true;
            shearContainer.setPointerCapture(e.pointerId);
            shearContainer.classList.add('active');
            handleShearPointer(e);
        });
        shearContainer?.addEventListener('pointermove', (e) => {
            if (draggingShear) handleShearPointer(e);
        });
        const stopShearDrag = (e) => {
            if (draggingShear) {
                draggingShear = false;
                shearContainer?.classList.remove('active');
            }
        };
        shearContainer?.addEventListener('pointerup', stopShearDrag);
        shearContainer?.addEventListener('pointercancel', stopShearDrag);

        // 3. Pause / Resume Simulation Transport
        this.isPaused = false;
        const pauseBtns = document.querySelectorAll('.btn-pause-toggle');
        const pauseIcon = document.getElementById('hud-pause-icon');
        const pauseLabel = document.getElementById('hud-pause-label');
        const railPauseIcon = document.getElementById('rail-pause-icon');

        const togglePause = () => {
            this.isPaused = !this.isPaused;
            if (pauseIcon) pauseIcon.textContent = this.isPaused ? '▶' : '⏸';
            if (pauseLabel) pauseLabel.textContent = this.isPaused ? 'RUN' : 'PAUSE';
            if (railPauseIcon) railPauseIcon.textContent = this.isPaused ? '▶' : '⏸';
            pauseBtns.forEach(b => b.classList.toggle('is-paused', this.isPaused));
            if (shearPill) {
                shearPill.classList.toggle('is-paused', this.isPaused);
                shearPill.classList.toggle('is-live', !this.isPaused);
                if (this.isPaused) shearPill.textContent = 'PAUSED';
                else shearPill.textContent = `${this.physics.alphaShear.toFixed(2)}α`;
            }
        };
        pauseBtns.forEach(btn => btn.addEventListener('click', togglePause));

        // 4. Drawer Slide-Over Open & Close Controls
        const drawer = document.getElementById('telemetry-drawer');
        const backdrop = document.getElementById('telemetry-backdrop');
        const openDrawer = () => {
            drawer?.classList.add('open');
            backdrop?.classList.add('active');
        };
        const closeDrawer = () => {
            drawer?.classList.remove('open');
            backdrop?.classList.remove('active');
        };

        document.getElementById('btn-hud-settings')?.addEventListener('click', openDrawer);
        document.getElementById('btn-trigger-controls-drawer')?.addEventListener('click', openDrawer);
        document.getElementById('hud-mode-telem')?.addEventListener('click', openDrawer);
        document.getElementById('btn-close-telemetry')?.addEventListener('click', closeDrawer);
        backdrop?.addEventListener('click', closeDrawer);

        // 5. Whitepaper Modal
        const helpModal = document.getElementById('help-modal');
        document.getElementById('btn-hud-menu')?.addEventListener('click', () => {
            if (helpModal) helpModal.style.display = 'flex';
        });
        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            if (helpModal) helpModal.style.display = 'none';
        });
        helpModal?.addEventListener('click', (e) => {
            if (e.target === helpModal) helpModal.style.display = 'none';
        });

        // 6. Cross-Platform Fullscreen with iOS Safari Fallback
        const fsBtn = document.getElementById('btn-hud-fullscreen');
        const updateFsIcon = (isFull) => {
            if (!fsBtn) return;
            if (isFull) {
                fsBtn.innerHTML = '<svg fill="none" height="16" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" width="16"><path d="M4 14h6v6m10-10h-6V4M14 10l7-7M10 14l-7 7"></path></svg>';
                fsBtn.title = 'Exit Fullscreen';
                fsBtn.classList.add('active');
            } else {
                fsBtn.innerHTML = '<svg fill="none" height="16" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" width="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                fsBtn.title = 'Toggle Fullscreen';
                fsBtn.classList.remove('active');
            }
        };

        const toggleFullscreen = () => {
            const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.body.classList.contains('immersive-fullscreen'));
            if (isFull) {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
                document.body.classList.remove('immersive-fullscreen');
                updateFsIcon(false);
            } else {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {
                        document.body.classList.add('immersive-fullscreen');
                        updateFsIcon(true);
                    });
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                } else {
                    document.body.classList.add('immersive-fullscreen');
                    window.scrollTo(0, 1);
                }
                updateFsIcon(true);
            }
        };
        fsBtn?.addEventListener('click', toggleFullscreen);

        document.addEventListener('fullscreenchange', () => {
            const isFull = !!document.fullscreenElement;
            document.body.classList.toggle('immersive-fullscreen', isFull);
            updateFsIcon(isFull);
        });

        // 7. Mode Cards Synchronization
        const modeButtons = document.querySelectorAll('.mode-btn');
        const cardIpc = document.getElementById('hud-mode-ipc');
        const cardCpc = document.getElementById('hud-mode-cpc');
        const stratSelect = document.getElementById('select-strategy');
        const stratLabel = document.getElementById('hud-strategy-label');

        const setMode = (mode) => {
            this.controller.setMode(mode);
            modeButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === mode));
            if (cardIpc) cardIpc.classList.toggle('active', mode === 'ipc');
            if (cardCpc) cardCpc.classList.toggle('active', mode === 'cpc');
            if (stratSelect) stratSelect.value = mode;
            if (stratLabel) stratLabel.textContent = mode === 'ipc' ? 'INDIVIDUAL (IPC ACTIVE)' : 'COLLECTIVE (CPC BASELINE)';
        };

        cardIpc?.addEventListener('click', () => setMode('ipc'));
        cardCpc?.addEventListener('click', () => setMode('cpc'));
        stratSelect?.addEventListener('change', (e) => setMode(e.target.value));

        // Gust Card
        const gustBtn = document.getElementById('gustBtn');
        document.getElementById('hud-mode-gust')?.addEventListener('click', () => {
            gustBtn?.click();
            const cardGust = document.getElementById('hud-mode-gust');
            cardGust?.classList.add('active');
            setTimeout(() => cardGust?.classList.remove('active'), 1500);
        });

    }

    initUI() {
        // Control Mode Buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                let mode = btn.getAttribute('data-mode');
                this.controller.setMode(mode);
            });
        });

        // Wind Speed Slider
        const windSlider = document.getElementById('windSlider');
        const windVal = document.getElementById('windVal');
        if (windSlider) {
            windSlider.addEventListener('input', (e) => {
                this.physics.vHub = parseFloat(e.target.value);
                if (windVal) windVal.innerText = `${this.physics.vHub.toFixed(1)} m/s`;
            });
        }

        // Shear Exponent Slider
        const shearSlider = document.getElementById('shearSlider');
        const shearVal = document.getElementById('shearVal');
        if (shearSlider) {
            shearSlider.addEventListener('input', (e) => {
                this.physics.shearExponent = parseFloat(e.target.value);
                if (shearVal) shearVal.innerText = this.physics.shearExponent.toFixed(2);
            });
        }

        // Gust Button
        const gustBtn = document.getElementById('gustBtn');
        if (gustBtn) {
            gustBtn.addEventListener('click', () => {
                this.physics.gustSpeed = 5.0;
                setTimeout(() => { this.physics.gustSpeed = 0.0; }, 3000);
            });
        }
    }

    startLoop() {
        let lastTime = performance.now();

        const loop = (time) => {
            let dt = Math.min(0.05, (time - lastTime) / 1000.0);
            lastTime = time;

            // 1. Controller calculates blade pitch demands
            let targetPitches = this.controller.update(
                dt,
                this.physics.omega,
                this.physics.bladeMoments,
                this.physics.azimuth
            );

            // 2. Physics advances
            this.physics.step(dt, targetPitches);

            // 3. Coleman transform for monitoring
            let coleman = ColemanTransform.forward(this.physics.bladeMoments, this.physics.azimuth);

            // 4. Fatigue accumulation
            this.fatigue.addSample(this.physics.bladeMoments[0], this.controller.mode === 'ipc');

            // 5. Update UI & Telemetry
            this.view3d.update(this.physics);
            this.chart.pushData(this.physics.bladeMoments, coleman);
            this.chart.render();

            this.updateTelemetryDOM(coleman);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    updateTelemetryDOM(coleman) {
        let rpm = (this.physics.omega * 60 / (2 * Math.PI)).toFixed(2);
        let power = this.physics.electricalPowerMw.toFixed(2);
        let fatigueRed = this.fatigue.getFatigueReduction().toFixed(1);
        let b1Deg = (this.physics.bladePitches[0] * 180 / Math.PI).toFixed(1);

        let rpmElem = document.getElementById('telemRpm');
        if (rpmElem) rpmElem.innerText = `${rpm} RPM`;

        let pwrElem = document.getElementById('telemPower');
        if (pwrElem) pwrElem.innerText = `${power} MW`;

        let fatElem = document.getElementById('telemFatigue');
        if (fatElem) {
            if (this.controller.mode === 'ipc') {
                fatElem.innerText = `-${fatigueRed}% REDUCTION`;
                fatElem.className = 'status-pill success';
            } else {
                fatElem.innerText = 'BASELINE (CPC)';
                fatElem.className = 'status-pill warning';
            }
        }

        let pitchElem = document.getElementById('telemPitch');
        if (pitchElem) pitchElem.innerText = `β1: ${b1Deg}° | Md: ${Math.round(coleman.Md)} kNm`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new TurbineTwinApp();
});
