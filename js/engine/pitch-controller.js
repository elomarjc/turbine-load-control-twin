import { ColemanTransform } from './coleman-transform.js';

/**
 * Individual Pitch Controller (IPC) & Collective Pitch Controller (CPC)
 * - CPC regulates rotor speed Omega to rated value Omega_rated
 * - IPC minimizes asymmetric tilt/yaw moments (Md, Mq) via Coleman MBC
 */
export class PitchController {
    constructor(omegaRated = 0.792) {
        this.omegaRated = omegaRated;

        // Control Mode: 'cpc' or 'ipc'
        this.mode = 'ipc';

        // Collective Pitch Controller (Speed Regulation)
        this.cpcKp = 1.8;
        this.cpcKi = 0.45;
        this.cpcIntegral = 0.12; // Baseline fine pitch (~7 deg)
        this.beta0 = 0.12; // Collective pitch (rad)

        // Individual Pitch Controller (Load Alleviation)
        // Proportional & Integral gains for Md (tilt) and Mq (yaw)
        this.ipcKp = 1.8e-6; // rad / kNm
        this.ipcKi = 3.5e-6; // rad / (kNm * s)
        this.intMd = 0.0;
        this.intMq = 0.0;

        this.dBetaD = 0.0;
        this.dBetaQ = 0.0;
        this.dBetaBlades = [0.0, 0.0, 0.0];
    }

    setMode(mode) {
        if (['cpc', 'ipc'].includes(mode)) {
            this.mode = mode;
            if (mode === 'cpc') {
                this.intMd = 0.0;
                this.intMq = 0.0;
                this.dBetaD = 0.0;
                this.dBetaQ = 0.0;
                this.dBetaBlades = [0.0, 0.0, 0.0];
            }
        }
    }

    /**
     * Compute target pitch angles for all 3 blades
     * @param {number} dt - Time step (seconds)
     * @param {number} omega - Current rotor speed (rad/s)
     * @param {Array<number>} bladeMoments - [My1, My2, My3] in kNm
     * @param {number} azimuth - Rotor azimuth psi in radians
     * @returns {Array<number>} [beta1, beta2, beta3] in radians
     */
    update(dt, omega, bladeMoments, azimuth) {
        // 1. Collective Pitch Loop (PI on rotor speed error)
        let omegaError = omega - this.omegaRated;
        this.cpcIntegral += this.cpcKi * omegaError * dt;
        this.cpcIntegral = Math.max(0.0, Math.min(0.65, this.cpcIntegral)); // 0 to 37 deg
        this.beta0 = Math.max(0.0, Math.min(0.65, this.cpcKp * omegaError + this.cpcIntegral));

        // 2. Individual Pitch Control Loop
        if (this.mode === 'ipc') {
            // Forward Coleman transform
            const { Md, Mq } = ColemanTransform.forward(bladeMoments, azimuth);

            // Integrate tilt and yaw moment errors
            this.intMd += Md * dt;
            this.intMq += Mq * dt;
            // Anti-windup clamping
            this.intMd = Math.max(-50000, Math.min(50000, this.intMd));
            this.intMq = Math.max(-50000, Math.min(50000, this.intMq));

            // Decoupled PI control in non-rotating frame: positive Md requires positive pitch to shed load
            this.dBetaD = +(this.ipcKp * Md + this.ipcKi * this.intMd);
            this.dBetaQ = +(this.ipcKp * Mq + this.ipcKi * this.intMq);

            // Limit cyclic pitch perturbation to +/- 4 degrees (+/- 0.07 rad)
            const maxCyclic = 0.07;
            this.dBetaD = Math.max(-maxCyclic, Math.min(maxCyclic, this.dBetaD));
            this.dBetaQ = Math.max(-maxCyclic, Math.min(maxCyclic, this.dBetaQ));

            // Inverse Coleman transform back to rotating blade frame
            this.dBetaBlades = ColemanTransform.inverse(this.dBetaD, this.dBetaQ, azimuth);
        } else {
            this.dBetaBlades = [0.0, 0.0, 0.0];
        }

        // Superimpose cyclic pitch on collective pitch
        return [
            this.beta0 + this.dBetaBlades[0],
            this.beta0 + this.dBetaBlades[1],
            this.beta0 + this.dBetaBlades[2]
        ];
    }
}
