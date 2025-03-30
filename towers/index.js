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

function randomValue(maxValue) {
  if (maxValue == undefined) {
    return Math.random();
  }
  return Math.random() * maxValue;
}

function randomColour() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
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
  camera.position.set(10, 7, 9);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.autoRotate = true;
  controls.enableDamping = true;
  controls.update();

  // For debugging
  const xElem = document.querySelector("#x");
  const yElem = document.querySelector("#y");
  const zElem = document.querySelector("#z");

  // Create the base group for the city
  const cityGroup = new THREE.Group(); // Parent group for platform + buildings
  scene.add(cityGroup);

  // Create the base platformer on which the tower will sit
  const platformSize = 10;
  const platformGeometry = new THREE.PlaneGeometry(platformSize, platformSize);
  const platformMaterial = new THREE.MeshBasicMaterial({ color: 0x787878 });
  const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
  platformMesh.position.x = 0;
  platformMesh.position.y = 0;
  platformMesh.position.z = 0;
  platformMesh.lookAt(0, 1, 0);
  cityGroup.add(platformMesh);

  // Add the buildings
  const gridSize = 5;
  for (let posX = 0; posX < gridSize; ++posX) {
    for (let posZ = 0; posZ < gridSize; ++posZ) {
      const buildingHeight = randomValue(2) + 1;
      const buildingWidth = 0.8;
      const buildingGeometry = new THREE.BoxGeometry(
        buildingWidth,
        buildingHeight,
        buildingWidth
      );
      const buildingMaterial = new THREE.MeshBasicMaterial({
        color: randomColour(),
      });
      const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
      buildingMesh.position.set(
        posX - gridSize / 2 + 0.5,
        buildingHeight / 2,
        posZ - gridSize / 2 + 0.5
      );
      cityGroup.add(buildingMesh);
    }
  }

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
