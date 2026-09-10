/**
 * Wind Turbine Aerodynamic & Structural Dynamics Engine
 * Models a 15 MW offshore wind turbine:
 * - Rotor radius R = 118 m (diameter 236 m)
 * - Hub height H = 150 m
 * - Rated wind speed v_rated = 11.4 m/s
 * - Rated rotor speed Omega = 7.56 rpm (0.792 rad/s)
 * - Atmospheric wind shear boundary layer: v(z) = v_hub * (z/H)^alpha
 */
export class TurbinePhysics {
    constructor() {
        this.R = 118.0; // Rotor radius in meters
        this.H = 150.0; // Hub height in meters
        this.ratedSpeedRpm = 7.56;
        this.omegaRated = (this.ratedSpeedRpm * 2 * Math.PI) / 60.0; // rad/s
        this.rho = 1.225; // Air density kg/m^3
        this.bladeAreaEff = 180.0; // Effective aerodynamic chord area m^2
        this.rEff = 78.0; // Effective aerodynamic center of thrust m

        // Wind conditions
        this.vHub = 12.0; // Mean hub height wind speed m/s
        this.shearExponent = 0.20; // Atmospheric power-law shear alpha (0.1 to 0.35)
        this.gustSpeed = 0.0;

        // Rotor state
        this.azimuth = 0.0; // Rotor azimuth angle psi (rad)
        this.omega = this.omegaRated; // Rotor speed (rad/s)
        this.bladePitches = [0.0, 0.0, 0.0]; // Pitch angles beta_1, beta_2, beta_3 (rad)

        // Bending moments (kNm)
        this.bladeMoments = [0.0, 0.0, 0.0]; // M_y1, M_y2, M_y3 (flapwise root moments)
        this.aerodynamicTorque = 0.0;
        this.electricalPowerMw = 0.0;
    }

    /**
     * Compute wind speed at height z using atmospheric wind shear model
     */
    getWindSpeedAtHeight(z) {
        let clampedZ = Math.max(15.0, z);
        let baseWind = this.vHub * Math.pow(clampedZ / this.H, this.shearExponent);
        return baseWind + this.gustSpeed;
    }

    /**
     * Advance simulation by dt seconds
     */
    step(dt, targetPitches) {
        // 1. Actuator dynamics (rate limited to 8 deg/s = 0.14 rad/s)
        const maxRate = 0.14 * dt;
        for (let i = 0; i < 3; i++) {
            let diff = targetPitches[i] - this.bladePitches[i];
            let rate = Math.max(-maxRate, Math.min(maxRate, diff));
            this.bladePitches[i] += rate;
        }

        // 2. Advance rotor azimuth
        this.azimuth = (this.azimuth + this.omega * dt) % (2 * Math.PI);

        // 3. Compute aerodynamic forces on each blade
        let totalTorque = 0.0;
        for (let i = 0; i < 3; i++) {
            // Blade azimuth: 0, 120, 240 deg
            let psi_i = (this.azimuth + i * (2 * Math.PI / 3)) % (2 * Math.PI);
            
            // Blade center-of-thrust height: z = H + rEff * cos(psi_i)
            // (psi = 0 is straight up, psi = PI is straight down)
            let zBlade = this.H + this.rEff * Math.cos(psi_i);
            let vBlade = this.getWindSpeedAtHeight(zBlade);

            // Aerodynamic lift coefficient approximation: C_L = 2*pi*(alpha_aoa)
            // Relative inflow angle phi = atan(vBlade / (omega * rEff))
            let omegaR = Math.max(1.0, this.omega * this.rEff);
            let phiInflow = Math.atan2(vBlade, omegaR);
            let angleOfAttack = phiInflow - this.bladePitches[i];
            let cL = Math.max(-0.2, Math.min(1.8, 5.5 * angleOfAttack));
            let cD = 0.02 + 0.5 * (cL * cL);

            // Relative velocity magnitude
            let vRel = Math.hypot(vBlade, omegaR);
            let dynamicPressure = 0.5 * this.rho * (vRel * vRel);

            // Flapwise out-of-plane thrust force and root bending moment (kNm)
            let thrustForce = dynamicPressure * this.bladeAreaEff * (cL * Math.cos(phiInflow) + cD * Math.sin(phiInflow));
            this.bladeMoments[i] = (thrustForce * this.rEff) / 1000.0; // kNm

            // In-plane tangential force producing rotor torque
            let tangentialForce = dynamicPressure * this.bladeAreaEff * (cL * Math.sin(phiInflow) - cD * Math.cos(phiInflow));
            totalTorque += tangentialForce * this.rEff;
        }

        this.aerodynamicTorque = totalTorque;

        // 4. Generator drivetrain dynamics
        let generatorTorque = (15.0e6) / this.omegaRated; // 15 MW rated generator counter-torque
        let rotorInertia = 1.6e8; // kg*m^2
        let dOmega = (this.aerodynamicTorque - generatorTorque) / rotorInertia;
        this.omega = Math.max(0.2, this.omega + dOmega * dt);

        this.electricalPowerMw = (generatorTorque * this.omega) / 1.0e6;
    }
}
