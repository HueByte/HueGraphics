import * as THREE from 'three';

// Apollonian Gasket (circle packing fractal)
export const generateApollonianGasket = (time = 0) => {
	const points = [];
	const colors = [];

	const maxDepth = 6;
	const zoomFactor = 1 + Math.sin(time * 0.1) * 0.5;

	const addCircle = (x, y, z, radius, depth, parentHue = 0) => {
		if (depth > maxDepth || radius < 0.02) return;

		const pointsPerCircle = Math.max(20, Math.floor(radius * 200));
		const hue = (parentHue + depth * 0.15 + time * 0.02) % 1;

		for (let i = 0; i < pointsPerCircle; i++) {
			const angle = (i / pointsPerCircle) * Math.PI * 2;
			const spiralAngle = angle + time * 0.2;

			// Create 3D spiral effect
			points.push(new THREE.Vector3(
				(x + Math.cos(spiralAngle) * radius) * zoomFactor,
				(y + Math.sin(spiralAngle) * radius) * zoomFactor,
				z + Math.sin(angle * 3 + time * 0.3) * radius * 0.5
			));

			colors.push(new THREE.Color().setHSL(hue, 0.9, 0.4 + depth / maxDepth * 0.3));
		}

		// Recursive circle packing
		const newRadius = radius * 0.4142; // Apollonian packing ratio
		const dist = radius - newRadius;

		addCircle(x + dist, y, z, newRadius, depth + 1, hue);
		addCircle(x - dist, y, z, newRadius, depth + 1, hue);
		addCircle(x, y + dist, z, newRadius, depth + 1, hue);
		addCircle(x, y - dist, z, newRadius, depth + 1, hue);
	};

	addCircle(0, 0, 0, 5, 0);

	return { points, colors };
};
