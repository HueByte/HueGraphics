import * as THREE from 'three';

// Fractal flame (particle system style)
export const generateFractalFlame = (time = 0) => {
	const points = [];
	const colors = [];
	const particleCount = 25000;
	const iterations = 100; // Warmup iterations

	let x = Math.random() * 2 - 1;
	let y = Math.random() * 2 - 1;

	// Affine transformation coefficients (IFS flames)
	const transforms = [
		{ a: 0.5, b: 0, c: 0, d: 0, e: 0.5, f: 0, color: 0, weight: 0.33 },
		{ a: 0.5, b: 0, c: 0.5, d: 0, e: 0.5, f: 0, color: 0.33, weight: 0.33 },
		{ a: 0.5, b: 0, c: 0.25, d: 0, e: 0.5, f: 0.5, color: 0.67, weight: 0.34 }
	];

	// Animated rotation
	const angle = time * 0.1;
	const cosA = Math.cos(angle);
	const sinA = Math.sin(angle);

	const variations = [
		(x, y) => ({ x, y }), // Linear
		(x, y) => ({ x: Math.sin(x), y: Math.sin(y) }), // Sinusoidal
		(x, y) => {
			const r = Math.sqrt(x*x + y*y) + 0.001;
			return { x: x / r * 0.3, y: y / r * 0.3 };
		}, // Spherical (bounded)
		(x, y) => {
			const r = Math.sqrt(x*x + y*y);
			const theta = Math.atan2(y, x);
			return {
				x: r * Math.cos(theta + r) * 0.3,
				y: r * Math.sin(theta + r) * 0.3
			};
		}, // Swirl
	];

	// Skip first iterations for convergence
	for (let i = 0; i < iterations; i++) {
		const transform = transforms[Math.floor(Math.random() * transforms.length)];
		const tx = transform.a * x + transform.b * y + transform.c;
		const ty = transform.d * x + transform.e * y + transform.f;

		const variation = variations[Math.floor(Math.random() * variations.length)];
		const v = variation(tx, ty);
		x = v.x;
		y = v.y;
	}

	// Now collect points
	for (let i = 0; i < particleCount; i++) {
		const transform = transforms[Math.floor(Math.random() * transforms.length)];
		const tx = transform.a * x + transform.b * y + transform.c;
		const ty = transform.d * x + transform.e * y + transform.f;

		const variation = variations[Math.floor(Math.random() * variations.length)];
		const v = variation(tx, ty);
		x = v.x;
		y = v.y;

		// Clamp to reasonable bounds
		if (Math.abs(x) > 5 || Math.abs(y) > 5) {
			x = Math.random() * 2 - 1;
			y = Math.random() * 2 - 1;
			continue;
		}

		// Apply rotation and create 3D structure
		const rx = x * cosA - y * sinA;
		const ry = x * sinA + y * cosA;
		const z = Math.sin(i * 0.01 + time * 0.3) * 1.5;

		points.push(new THREE.Vector3(rx * 6, ry * 6, z * 1.5));

		const hue = (transform.color + i / particleCount * 0.3 + time * 0.02) % 1;
		colors.push(new THREE.Color().setHSL(hue, 0.95, 0.5));
	}

	return { points, colors };
};
