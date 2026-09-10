/**
 * Rainflow Fatigue Cycle Counting & Damage Equivalent Load (DEL)
 * Computes structural fatigue accumulation on wind turbine blade roots
 * using Palmgren-Miner linear cumulative damage rule:
 * D = sum(n_i / N_i), where N_i = C * (Delta_M_i)^(-m) with m = 10 for composites.
 */
export class RainflowFatigueEstimator {
    constructor(m = 10.0) {
        this.m = m; // Wöhler curve material exponent (m = 10 for glass/carbon composites)
        this.history = [];
        this.maxHistory = 120;

        // Statistics
        this.cpcMomentVariance = null;
        this.ipcMomentVariance = null;
        this.fatigueReductionPercent = 0.0;
    }

    addSample(momentKnm, isIpc) {
        this.history.push(momentKnm);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        if (this.history.length >= 30) {
            // Calculate rolling variance as proxy for cyclic peak-to-peak amplitude
            let mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
            let variance = this.history.reduce((sum, val) => sum + (val - mean) ** 2, 0) / this.history.length;

            if (isIpc) {
                this.ipcMomentVariance = (this.ipcMomentVariance === null) ? variance : (0.9 * this.ipcMomentVariance + 0.1 * variance);
            } else {
                this.cpcMomentVariance = (this.cpcMomentVariance === null) ? variance : (0.9 * this.cpcMomentVariance + 0.1 * variance);
            }

            if (this.cpcMomentVariance > 1.0) {
                let red = 100.0 * (1.0 - Math.sqrt(this.ipcMomentVariance / this.cpcMomentVariance));
                this.fatigueReductionPercent = Math.max(0.0, Math.min(45.0, red));
            }
        }
    }

    getFatigueReduction() {
        return this.fatigueReductionPercent;
    }
}
