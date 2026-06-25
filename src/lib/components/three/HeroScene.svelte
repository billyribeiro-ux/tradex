<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';

	// A grid of points that undulates like a living volatility surface.
	const N = 54;
	const SIZE = 18;
	const count = N * N;

	const geom = new THREE.BufferGeometry();
	const pos = new Float32Array(count * 3);
	let k = 0;
	for (let i = 0; i < N; i++) {
		for (let j = 0; j < N; j++) {
			pos[k * 3] = (i / (N - 1) - 0.5) * SIZE;
			pos[k * 3 + 1] = 0;
			pos[k * 3 + 2] = (j / (N - 1) - 0.5) * SIZE;
			k++;
		}
	}
	geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));

	const mat = new THREE.PointsMaterial({
		color: new THREE.Color('#14e0a3'),
		size: 0.055,
		transparent: true,
		opacity: 0.9,
		sizeAttenuation: true
	});
	const points = new THREE.Points(geom, mat);
	points.rotation.x = -Math.PI / 2.4;

	let t = 0;
	useTask((delta) => {
		t += delta;
		const p = geom.attributes.position as THREE.BufferAttribute;
		for (let n = 0; n < count; n++) {
			const x = p.getX(n);
			const z = p.getZ(n);
			const y =
				Math.sin(x * 0.55 + t * 0.8) * 0.5 +
				Math.cos(z * 0.45 + t * 0.6) * 0.5 +
				Math.sin((x + z) * 0.3 + t) * 0.32;
			p.setY(n, y);
		}
		p.needsUpdate = true;
		points.rotation.z += delta * 0.04;
	});
</script>

<!-- Camera at an institutional 3/4 angle, looking down at the surface. -->
<T.PerspectiveCamera makeDefault position={[0, 7.5, 11]} rotation={[-0.6, 0, 0]} fov={46} />
<T is={points} />
