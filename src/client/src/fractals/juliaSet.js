import * as THREE from 'three';

// Julia Set 3D (animated)
export const generateJuliaSet3D = (time = 0) => {
	const points = [];
	const colors = [];
	const detail = 50; // Increased for more points

	const c = {
		x: -0.4 + Math.sin(time * 0.07) * 0.3,
		y: 0.6 + Math.cos(time * 0.09) * 0.2
	};

	const zoomFactor = Math.pow(2, Math.sin(time * 0.08) * 2.5);
	const maxIterations = 15;
	const threshold = 4;

	for (let x = 0; x < detail; x++) {
		for (let y = 0; y < detail; y++) {
			for (let z = 0; z < detail; z++) {
				let zx = (x / detail - 0.5) * 4 / zoomFactor;
				let zy = (y / detail - 0.5) * 4 / zoomFactor;
				let zz = (z / detail - 0.5) * 4 / zoomFactor;

				const origX = zx, origY = zy, origZ = zz;
				let i;

				for (i = 0; i < maxIterations; i++) {
					const xtemp = zx * zx - zy * zy - zz * zz + c.x;
					const ytemp = 2 * zx * zy + c.y;
					const ztemp = 2 * zx * zz;

					zx = xtemp;
					zy = ytemp;
					zz = ztemp;

					if (zx * zx + zy * zy + zz * zz > threshold) break;
				}

				// Less restrictive filter - include more points for better coverage
				if (i > 2 && i < maxIterations) {
					points.push(new THREE.Vector3(origX * 7, origY * 7, origZ * 7));

					const hue = (i / maxIterations * 0.8 + time * 0.02) % 1;
					colors.push(new THREE.Color().setHSL(hue, 0.9, 0.5));
				}
			}
		}
	}

	return { points, colors };
};
