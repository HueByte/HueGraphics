import * as THREE from 'three';

// Sierpinski Pyramid (optimized)
export const generateSierpinskiTetrahedron = (time = 0) => {
	const points = [];
	const colors = [];

	const depth = 4; // Reduced to 4 for performance
	const baseScale = 6 * (1 + Math.sin(time * 0.08) * 0.3);

	const height = baseScale * Math.sqrt(2/3);
	const vertices = [
		new THREE.Vector3(0, height, 0),
		new THREE.Vector3(-baseScale/2, 0, baseScale/(2*Math.sqrt(3))),
		new THREE.Vector3(baseScale/2, 0, baseScale/(2*Math.sqrt(3))),
		new THREE.Vector3(0, 0, -baseScale/Math.sqrt(3))
	];

	const subdivide = (v0, v1, v2, v3, level, hueOffset = 0) => {
		if (level === 0) {
			// Only add corner and midpoint vertices - much more efficient
			const steps = 3; // Minimal steps
			for (let i = 0; i <= steps; i++) {
				const t = i / steps;
				points.push(
					v0.clone().lerp(v1, t),
					v0.clone().lerp(v2, t),
					v0.clone().lerp(v3, t),
					v1.clone().lerp(v2, t),
					v1.clone().lerp(v3, t),
					v2.clone().lerp(v3, t)
				);
			}
			return;
		}

		const m01 = v0.clone().lerp(v1, 0.5);
		const m02 = v0.clone().lerp(v2, 0.5);
		const m03 = v0.clone().lerp(v3, 0.5);
		const m12 = v1.clone().lerp(v2, 0.5);
		const m13 = v1.clone().lerp(v3, 0.5);
		const m23 = v2.clone().lerp(v3, 0.5);

		const newHue = (hueOffset + 0.1) % 1;

		subdivide(v0, m01, m02, m03, level - 1, newHue);
		subdivide(m01, v1, m12, m13, level - 1, newHue);
		subdivide(m02, m12, v2, m23, level - 1, newHue);
		subdivide(m03, m13, m23, v3, level - 1, newHue);
	};

	subdivide(vertices[0], vertices[1], vertices[2], vertices[3], depth);

	points.forEach((p) => {
		const distFromCenter = p.length();
		const normalizedDist = Math.min(distFromCenter / baseScale, 1);
		const hue = (0.7 - normalizedDist * 0.4 + time * 0.02) % 1;
		colors.push(new THREE.Color().setHSL(hue, 0.9, 0.45));
	});

	return { points, colors };
};
