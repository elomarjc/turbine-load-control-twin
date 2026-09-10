/**
 * Multi-Blade Coordinate (MBC) Coleman Transformation
 * Decouples rotating blade 1P flapwise bending moments into stationary
 * tilt (d-axis) and yaw (q-axis) coordinates.
 */
export class ColemanTransform {
    /**
     * Forward Coleman Transform: [My1, My2, My3] -> [Md, Mq, M0]
     * @param {Array<number>} bladeMoments - [My1, My2, My3] in kNm
     * @param {number} azimuth - Rotor azimuth psi in radians
     * @returns {{Md: number, Mq: number, M0: number}}
     */
    static forward(bladeMoments, azimuth) {
        const [m1, m2, m3] = bladeMoments;
        const psi1 = azimuth;
        const psi2 = azimuth + (2 * Math.PI / 3);
        const psi3 = azimuth + (4 * Math.PI / 3);

        // Tilt moment (d-axis): Md = (2/3) * sum(Myi * cos(psi_i))
        const Md = (2.0 / 3.0) * (
            m1 * Math.cos(psi1) +
            m2 * Math.cos(psi2) +
            m3 * Math.cos(psi3)
        );

        // Yaw moment (q-axis): Mq = (2/3) * sum(Myi * sin(psi_i))
        const Mq = (2.0 / 3.0) * (
            m1 * Math.sin(psi1) +
            m2 * Math.sin(psi2) +
            m3 * Math.sin(psi3)
        );

        // Collective out-of-plane moment (0-axis)
        const M0 = (1.0 / 3.0) * (m1 + m2 + m3);

        return { Md, Mq, M0 };
    }

    /**
     * Inverse Coleman Transform: [d_beta_d, d_beta_q] -> [d_beta_1, d_beta_2, d_beta_3]
     * Maps stationary dq pitch adjustments back to individual rotating blade pitch offsets
     * @param {number} dBetaD - Pitch demand in tilt coordinate (rad)
     * @param {number} dBetaQ - Pitch demand in yaw coordinate (rad)
     * @param {number} azimuth - Rotor azimuth psi in radians
     * @returns {Array<number>} [dBeta1, dBeta2, dBeta3] in radians
     */
    static inverse(dBetaD, dBetaQ, azimuth) {
        const psi1 = azimuth;
        const psi2 = azimuth + (2 * Math.PI / 3);
        const psi3 = azimuth + (4 * Math.PI / 3);

        const dBeta1 = dBetaD * Math.cos(psi1) + dBetaQ * Math.sin(psi1);
        const dBeta2 = dBetaD * Math.cos(psi2) + dBetaQ * Math.sin(psi2);
        const dBeta3 = dBetaD * Math.cos(psi3) + dBetaQ * Math.sin(psi3);

        return [dBeta1, dBeta2, dBeta3];
    }
}
