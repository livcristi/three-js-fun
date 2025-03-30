import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const pixelRatio = window.devicePixelRatio;
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }

  return needResize;
}

function main() {
  // canvas
  const canvas = document.querySelector("#c");

  // renderer
  const renderer = new THREE.WebGLRenderer({ antialising: true, canvas });

  // scene
  const scene = new THREE.Scene();

  // camera
  const fov = 45;
  const aspect = 2;
  const near = 1;
  const far = 1000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  // Lighting
  // const light = new THREE.AmbientLight(0xffffff, 1);
  // scene.add(light);

  // Position camera
  camera.position.set(3, 5, 4);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.autoRotate = true;
  controls.enableDamping = true;
  controls.update();

  // Create a cube at the center of the scene
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x0088ff });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  scene.add(cube);

  // For debugging
  const xElem = document.querySelector("#x");
  const yElem = document.querySelector("#y");
  const zElem = document.querySelector("#z");

  // render function
  function render(time) {
    xElem.textContent = camera.position.x.toFixed(3);
    yElem.textContent = camera.position.y.toFixed(3);
    zElem.textContent = camera.position.z.toFixed(3);

    if (resizeRendererToDisplaySize(renderer)) {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
