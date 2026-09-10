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
