import test from 'node:test';
import assert from 'node:assert/strict';

import { ColemanTransform } from '../js/engine/coleman-transform.js';
import { TurbinePhysics } from '../js/engine/turbine-physics.js';
import { PitchController } from '../js/engine/pitch-controller.js';
import { RainflowFatigueEstimator } from '../js/engine/rainflow-fatigue.js';

test('ColemanTransform: orthogonality and symmetric moment cancellation', () => {
    // 1. Equal symmetric moments across 3 blades should produce zero tilt and yaw moments
    const equalMoments = [25000, 25000, 25000];
    const azimuth = 0.45; // arbitrary angle
    const { Md, Mq, M0 } = ColemanTransform.forward(equalMoments, azimuth);

    assert.ok(Math.abs(Md) < 1e-6, `Md should be 0 for equal blade moments, got ${Md}`);
    assert.ok(Math.abs(Mq) < 1e-6, `Mq should be 0 for equal blade moments, got ${Mq}`);
    assert.ok(Math.abs(M0 - 25000) < 1e-6, `M0 should equal collective moment 25000, got ${M0}`);

    // 2. Inverse Coleman test
    const [b1, b2, b3] = ColemanTransform.inverse(0.04, 0.02, azimuth);
    assert.ok(!Number.isNaN(b1) && !Number.isNaN(b2) && !Number.isNaN(b3), 'Inverse pitch offsets should not be NaN');
});

test('TurbinePhysics: atmospheric wind shear gradient and blade moments', () => {
    const turbine = new TurbinePhysics();
    turbine.vHub = 12.0;
    turbine.shearExponent = 0.20;

    const vTop = turbine.getWindSpeedAtHeight(turbine.H + turbine.rEff); // 228 m
    const vBot = turbine.getWindSpeedAtHeight(turbine.H - turbine.rEff); // 72 m

    assert.ok(vTop > vBot + 2.0, `Wind at top of sweep (${vTop.toFixed(2)} m/s) should be > wind at bottom (${vBot.toFixed(2)} m/s)`);

    // Run 50 simulation steps
    for (let i = 0; i < 50; i++) {
        turbine.step(0.05, [0.12, 0.12, 0.12]);
    }

    assert.ok(turbine.electricalPowerMw > 1.0, 'Turbine should generate electrical power');
    assert.ok(turbine.bladeMoments[0] > 0, 'Blade root bending moment should be positive');
});

test('PitchController: IPC cyclic pitch response to asymmetric moments', () => {
    const controller = new PitchController(0.792);
    controller.setMode('ipc');

    // Asymmetric moments (e.g. Blade 1 at top experiences high thrust, Blade 2 & 3 experience low)
    const asymmetricMoments = [35000, 15000, 15000];
    const azimuth = 0.0; // Blade 1 is at top

    const targetPitches = controller.update(0.05, 0.792, asymmetricMoments, azimuth);

    // Blade 1 should pitch toward feather (higher pitch angle) to shed aerodynamic load
    assert.ok(targetPitches[0] > targetPitches[1], 'Blade 1 pitch should be higher than Blade 2 to shed load');
});

test('RainflowFatigueEstimator: fatigue variance reduction', () => {
    const estimator = new RainflowFatigueEstimator(10.0);

    // Feed high variance CPC samples
    for (let i = 0; i < 50; i++) {
        let mCpc = 25000 + 10000 * Math.sin(i * 0.2);
        estimator.addSample(mCpc, false);
    }

    // Feed low variance IPC samples
    for (let i = 0; i < 50; i++) {
        let mIpc = 25000 + 2000 * Math.sin(i * 0.2);
        estimator.addSample(mIpc, true);
    }

    const reduction = estimator.getFatigueReduction();
    assert.ok(reduction > 10.0, `Fatigue reduction should be > 10%, got ${reduction.toFixed(1)}%`);
});
