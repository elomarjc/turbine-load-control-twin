/**
 * Real-Time Telemetry & Strip-Chart Canvas Scope
 * Visualizes rotating blade root moments (My1, My2, My3) and stationary Coleman
 * decoupled tilt/yaw moments (Md, Mq) showing 1P fatigue alleviation.
 */
export class TelemetryChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.historyLength = 120;
        this.historyMy1 = new Float32Array(this.historyLength);
        this.historyMy2 = new Float32Array(this.historyLength);
        this.historyMy3 = new Float32Array(this.historyLength);
        this.historyMd = new Float32Array(this.historyLength);
        this.historyMq = new Float32Array(this.historyLength);
    }

    pushData(bladeMoments, colemanMoments) {
        // Shift left
        for (let i = 0; i < this.historyLength - 1; i++) {
            this.historyMy1[i] = this.historyMy1[i + 1];
            this.historyMy2[i] = this.historyMy2[i + 1];
            this.historyMy3[i] = this.historyMy3[i + 1];
            this.historyMd[i] = this.historyMd[i + 1];
            this.historyMq[i] = this.historyMq[i + 1];
        }

        this.historyMy1[this.historyLength - 1] = bladeMoments[0];
        this.historyMy2[this.historyLength - 1] = bladeMoments[1];
        this.historyMy3[this.historyLength - 1] = bladeMoments[2];
        this.historyMd[this.historyLength - 1] = colemanMoments.Md;
        this.historyMq[this.historyLength - 1] = colemanMoments.Mq;
    }

    render() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, width, height);

        const padLeft = 45;
        const padRight = 15;
        const padTop = 15;
        const padBottom = 25;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;

        // Split into Top Plot (Blade Moments Myi: 0 to 45,000 kNm)
        // and Bottom Plot (Coleman Md, Mq: -15,000 to +15,000 kNm)
        const halfH = (plotH - 15) / 2;

        // Grid lines
        ctx.strokeStyle = '#141d2e';
        ctx.lineWidth = 1;
        ctx.font = '10px Inter, monospace';
        ctx.fillStyle = '#4a5b78';
        ctx.textAlign = 'right';

        // Top Plot Grid
        const topY = (v) => padTop + halfH - (v / 45000.0) * halfH;
        [0, 15000, 30000, 45000].forEach(val => {
            let py = topY(val);
            ctx.beginPath();
            ctx.moveTo(padLeft, py);
            ctx.lineTo(padLeft + plotW, py);
            ctx.stroke();
            ctx.fillText(`${val / 1000}k`, padLeft - 6, py + 3);
        });

        // Bottom Plot Grid
        const botTop = padTop + halfH + 15;
        const botY = (v) => botTop + halfH / 2 - (v / 15000.0) * (halfH / 2);
        [-10000, 0, 10000].forEach(val => {
            let py = botY(val);
            ctx.beginPath();
            ctx.moveTo(padLeft, py);
            ctx.lineTo(padLeft + plotW, py);
            ctx.stroke();
            ctx.fillText(`${val / 1000}k`, padLeft - 6, py + 3);
        });

        const mapX = (idx) => padLeft + (idx / (this.historyLength - 1)) * plotW;

        // Plot Function
        const drawTrace = (data, mapYFunc, color, lineWidth = 1.5) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            for (let i = 0; i < this.historyLength; i++) {
                let px = mapX(i);
                let py = mapYFunc(data[i]);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        };

        // Top Traces: Blade Moments
        drawTrace(this.historyMy1, topY, '#38bdf8', 1.8); // Blade 1 Cyan
        drawTrace(this.historyMy2, topY, '#10b981', 1.5); // Blade 2 Emerald
        drawTrace(this.historyMy3, topY, '#f59e0b', 1.5); // Blade 3 Amber

        // Bottom Traces: Coleman Decoupled Moments
        drawTrace(this.historyMd, botY, '#ec4899', 2.0); // Tilt Md Magenta
        drawTrace(this.historyMq, botY, '#a855f7', 2.0); // Yaw Mq Purple

        // Labels
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('Rotating Blade Flapwise Moments My1, My2, My3 (kNm)', padLeft + 10, padTop + 14);
        ctx.fillText('Stationary Coleman Decoupled Tilt (Md) & Yaw (Mq) Moments (kNm)', padLeft + 10, botTop + 14);
    }
}
