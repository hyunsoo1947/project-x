import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const mount = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x061018);
scene.fog = new THREE.FogExp2(0x061018, 0.006);

const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 600);
camera.position.set(68, 58, 92);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(mount.clientWidth, mount.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.tabIndex = 0;
mount.prepend(renderer.domElement);

const labels = new CSS2DRenderer();
labels.setSize(mount.clientWidth, mount.clientHeight);
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
mount.append(labels.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 35;
controls.maxDistance = 220;
controls.maxPolarAngle = Math.PI / 2.05;
controls.target.set(0, 3, 0);

scene.add(new THREE.HemisphereLight(0xa7edff, 0x10202d, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.position.set(35, 60, 25); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); scene.add(sun);

const selectable = [];
const flowParticles = [];
const envs = [
  { name: 'DEV', x: -52, color: 0x2dd4bf, rds: true },
  { name: 'STAGING', x: 0, color: 0x4aa8ff, rds: false },
  { name: 'PROD', x: 52, color: 0xf1669a, rds: false }
];

function material(color, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .18, emissive, emissiveIntensity: .12 });
}
function box(group, name, size, pos, color, detail, bevel = false) {
  const geometry = bevel ? new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, size[1], 32) : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material(color, color));
  mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData = { title: name, type: detail.type, copy: detail.copy };
  group.add(mesh); selectable.push(mesh); return mesh;
}
function addLabel(parent, text, y, className = '') {
  const node = document.createElement('div'); node.className = `label ${className}`; node.textContent = text;
  const label = new CSS2DObject(node); label.position.set(0, y, 0); parent.add(label);
}
function line(points, color, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
  const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: .75, transparent: true, opacity: .85 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: .5 });
  const item = new THREE.Line(geo, mat); if (dashed) item.computeLineDistances(); scene.add(item); return item;
}
function makeEnvironment(config) {
  const group = new THREE.Group(); group.position.x = config.x; scene.add(group);
  const base = box(group, `${config.name} VPC`, [42, 1.4, 48], [0, -.7, 0], 0x102c37, { type: 'NETWORK / VPC', copy: `Isolated ${config.name.toLowerCase()} VPC spanning three availability zones.` });
  base.material.transparent = true; base.material.opacity = .86; addLabel(base, config.name, 3.2, 'environment');
  [-13, 0, 13].forEach((z, index) => {
    const az = String.fromCharCode(65 + index);
    const pub = box(group, `Public subnet ${az}`, [15, .9, 10], [-9.5, .45, z], 0x188b9d, { type: `PUBLIC SUBNET / AZ ${az}`, copy: 'Internet-facing subnet routed through the Internet Gateway.' });
    addLabel(pub, `PUBLIC ${az}`, 1.25);
    const priv = box(group, `Private subnet ${az}`, [15, .9, 10], [9.5, .45, z], 0x344462, { type: `PRIVATE SUBNET / AZ ${az}`, copy: 'Private workload subnet hosting EKS nodes and internal resources.' });
    addLabel(priv, `PRIVATE ${az}`, 1.25);
  });
  const igw = box(group, 'Internet Gateway', [7, 3.2, 7], [-17, 3, -19], 0x50d5e5, { type: 'VPC EDGE', copy: 'Internet Gateway routes public subnet traffic to and from the internet.' });
  addLabel(igw, 'IGW', 2.7);
  const cluster = box(group, `${config.name} EKS`, [13, 7, 13], [9.5, 4.2, 0], 0xf0a84b, { type: 'AMAZON EKS', copy: 'Kubernetes control plane with managed worker nodes distributed across all private subnets.' }, true);
  addLabel(cluster, 'EKS', 5.2);
  for (let i = 0; i < 3; i++) {
    const node = box(group, `Worker node ${i + 1}`, [3.3, 3.3, 3.3], [9.5, 2.3, -7 + i * 7], 0xffcb70, { type: 'EKS NODE GROUP', copy: 'Managed EC2 worker node in the private subnet tier.' });
    node.rotation.y = Math.PI / 4;
  }
  if (config.rds) {
    const rds = box(group, 'Dev PostgreSQL', [9, 7, 9], [9.5, 4, 14], 0x9f72ff, { type: 'RDS / DEV ONLY', copy: 'Encrypted PostgreSQL 16 instance. RDS is intentionally provisioned only in dev.' }, true);
    addLabel(rds, 'RDS · POSTGRES', 5.2);
    line([[config.x + 9.5, 6, 4], [config.x + 9.5, 6, 10]], 0xc6a8ff, true);
  }
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(42.4, 1.6, 48.4)), new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: .45 }));
  border.position.y = -.65; group.add(border);
}
envs.forEach(makeEnvironment);

const github = box(scene, 'GitHub Actions', [25, 5, 12], [0, 22, -42], 0x222932, { type: 'CI/CD', copy: 'OIDC-authenticated workflow runs Terraform init, plan, and apply for environment deployments.' });
addLabel(github, 'GITHUB ACTIONS', 4.4);
envs.forEach((env, i) => {
  const start = new THREE.Vector3(0, 20, -36); const end = new THREE.Vector3(env.x, 4, -23);
  line([start.toArray(), end.toArray()], env.color, true);
  const particle = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 12), new THREE.MeshBasicMaterial({ color: env.color }));
  scene.add(particle); flowParticles.push({ mesh: particle, start, end, offset: i / 3 });
});

const grid = new THREE.GridHelper(190, 38, 0x245363, 0x102934); grid.position.y = -1.5; scene.add(grid);
const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', event => {
  const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera); renderer.domElement.style.cursor = raycaster.intersectObjects(selectable).length ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('click', () => {
  raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(selectable)[0]; if (!hit) return;
  document.querySelector('#detail-type').textContent = hit.object.userData.type;
  document.querySelector('#detail-title').textContent = hit.object.userData.title;
  document.querySelector('#detail-copy').textContent = hit.object.userData.copy;
  document.querySelector('#details').classList.add('open');
});
document.querySelector('#close-details').addEventListener('click', () => document.querySelector('#details').classList.remove('open'));
function moveCamera(position, target) { camera.position.set(...position); controls.target.set(...target); controls.update(); }
document.querySelector('#bird-view').addEventListener('click', () => moveCamera([0, 135, .01], [0, 0, 0]));
document.querySelector('#reset-view').addEventListener('click', () => moveCamera([68, 58, 92], [0, 3, 0]));
window.addEventListener('resize', () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); labels.setSize(mount.clientWidth, mount.clientHeight); });

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate); const elapsed = clock.getElapsedTime();
  flowParticles.forEach(item => item.mesh.position.lerpVectors(item.start, item.end, (elapsed * .18 + item.offset) % 1));
  controls.update(); renderer.render(scene, camera); labels.render(scene, camera);
}
document.querySelector('#loading').remove(); animate();
