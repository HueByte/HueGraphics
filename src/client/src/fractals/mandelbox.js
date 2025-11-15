import * as THREE from 'three';

// Mandelbox fractal
export const generateMandelbox = (time = 0) => {
	const points = [];
	const colors = [];
	const detail = 35; // Increased for more points
	const maxIterations = 10;
	const scale = 2.0 + Math.sin(time * 0.1) * 0.5;
	const foldingLimit = 1.0;

	const zoomFactor = Math.pow(2, Math.sin(time * 0.08) * 2);

	for (let i = 0; i < detail; i++) {
		for (let j = 0; j < detail; j++) {
			for (let k = 0; k < detail; k++) {
				let x = ((i / detail - 0.5) * 4 / zoomFactor);
				let y = ((j / detail - 0.5) * 4 / zoomFactor);
				let z = ((k / detail - 0.5) * 4 / zoomFactor);

				const x0 = x, y0 = y, z0 = z;
				let iterations = 0;
				let escaped = false;

				for (iterations = 0; iterations < maxIterations; iterations++) {
					// Box fold
					x = x > foldingLimit ? 2 * foldingLimit - x : x < -foldingLimit ? -2 * foldingLimit - x : x;
					y = y > foldingLimit ? 2 * foldingLimit - y : y < -foldingLimit ? -2 * foldingLimit - y : y;
					z = z > foldingLimit ? 2 * foldingLimit - z : z < -foldingLimit ? -2 * foldingLimit - z : z;

					// Sphere fold
					const r2 = x*x + y*y + z*z;
					if (r2 < 0.5) {
						const temp = 1.0 / 0.5;
						x *= temp; y *= temp; z *= temp;
					} else if (r2 < 1.0) {
						const temp = 1.0 / r2;
						x *= temp; y *= temp; z *= temp;
					}

					x = scale * x + x0;
					y = scale * y + y0;
					z = scale * z + z0;

					if (x*x + y*y + z*z > 256) {
						escaped = true;
						break;
					}
				}

				// Add points that are part of the fractal boundary
				if (!escaped || iterations > 3) {
					points.push(new THREE.Vector3(x * 2.5, y * 2.5, z * 2.5));

					const hue = (0.7 - iterations / maxIterations * 0.4 + time * 0.02) % 1;
					colors.push(new THREE.Color().setHSL(hue, 0.9, 0.5));
				}
			}
		}
	}

	return { points, colors };
};
