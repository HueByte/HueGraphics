import * as THREE from 'three';

// Advanced Mandelbulb with infinite zoom
export const generateMandelbulb = (time = 0) => {
	const points = [];
	const colors = [];
	const power = 8;
	const bailout = 2;
	const maxIterations = 8;
	const detail = 50; // Increased for better coverage

	// Infinite zoom: oscillate between scales
	const zoomCycle = time * 0.08;
	const zoomFactor = 1 + Math.sin(zoomCycle) * 0.5; // Gentler zoom
	const offset = {
		x: Math.sin(time * 0.03) * 0.05,
		y: Math.cos(time * 0.04) * 0.05,
		z: Math.sin(time * 0.05) * 0.05
	};

	for (let i = 0; i < detail; i++) {
		for (let j = 0; j < detail; j++) {
			for (let k = 0; k < detail; k++) {
				const x0 = ((i / detail - 0.5) * 3 / zoomFactor) + offset.x;
				const y0 = ((j / detail - 0.5) * 3 / zoomFactor) + offset.y;
				const z0 = ((k / detail - 0.5) * 3 / zoomFactor) + offset.z;

				let x = 0, y = 0, z = 0;
				let iterations = 0;

				while (iterations < maxIterations) {
					const r = Math.sqrt(x*x + y*y + z*z);
					if (r > bailout) break;

					// Mandelbulb formula (simplified)
					const theta = Math.acos(z / (r + 0.0001));
					const phi = Math.atan2(y, x);

					const zr = Math.pow(r, power);
					const newTheta = theta * power;
					const newPhi = phi * power;

					x = zr * Math.sin(newTheta) * Math.cos(newPhi) + x0;
					y = zr * Math.sin(newTheta) * Math.sin(newPhi) + y0;
					z = zr * Math.cos(newTheta) + z0;

					iterations++;
				}

				// Add point if it's on the boundary
				if (iterations > 2 && iterations < maxIterations) {
					points.push(new THREE.Vector3(x0 * 5, y0 * 5, z0 * 5));

					// Beautiful color gradient
					const hue = (iterations / maxIterations + time * 0.02) % 1;
					const sat = 0.9;
					const light = 0.4 + (iterations / maxIterations) * 0.3;
					colors.push(new THREE.Color().setHSL(hue, sat, light));
				}
			}
		}
	}

	return { points, colors };
};
