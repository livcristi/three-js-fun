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
  return Math.random() * (maxValue || 1);
}

function randomColour() {
  return new THREE.Color(Math.random(), Math.random(), Math.random());
}

class PickHelper {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
  }
  pick(normalizedPosition, objects, camera) {
    // restore the picked object to none
    if (this.pickedObject) {
      this.pickedObject = undefined;
    }
    // cast a ray through the list of objects
    this.raycaster.setFromCamera(normalizedPosition, camera);
    // get the list of intersected objects
    const intersectedObjects = this.raycaster.intersectObjects(objects);
    if (intersectedObjects.length > 0) {
      // pick the closest object
      this.pickedObject = intersectedObjects[0].object;
      return this.pickedObject;
    }
    return null;
  }
}

function main() {
  // canvas
  const canvas = document.querySelector("#c");

  // renderer
  const renderer = new THREE.WebGLRenderer({ antialising: true, canvas });

  // scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ffe8d6");

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

  // Add pick helper for buildings info
  const pickHelper = new PickHelper();
  const pickPosition = new THREE.Vector2();
  const mousePosition = new THREE.Vector2();
  const tooltip = document.getElementById("tooltip");
  tooltip.style.display = "none";
  clearPickPosition();
  let isHovering = false;

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
  const platformMaterial = new THREE.MeshBasicMaterial({
    color: "#6b705c",
    side: THREE.DoubleSide,
  });
  const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
  platformMesh.position.x = 0;
  platformMesh.position.y = 0;
  platformMesh.position.z = 0;
  platformMesh.lookAt(0, 1, 0);
  cityGroup.add(platformMesh);

  // Add the buildings
  const buildings = {};
  const relationships = {};
  const gridSize = 4;
  for (let posX = 0; posX < gridSize; ++posX) {
    for (let posZ = 0; posZ < gridSize; ++posZ) {
      // construct the building geometry
      const buildingHeight = randomValue(2) + 1;
      const buildingWidth = randomValue(0.5) + 0.5;
      const buildingDepth = randomValue(0.5) + 0.5;
      const buildingGeometry = new THREE.BoxGeometry(
        buildingWidth,
        buildingHeight,
        buildingDepth
      );
      const buildingColour = randomColour();
      const buildingMaterial = new THREE.MeshBasicMaterial({
        color: buildingColour,
      });
      const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
      // construct the wire for the buildings
      const buildingEdges = new THREE.EdgesGeometry(buildingGeometry);
      const buildingLines = new THREE.LineSegments(
        buildingEdges,
        new THREE.LineBasicMaterial({ color: "#6b705c" })
      );
      // position the buildings on the platform, but float just above it to aboid z-fighting
      [buildingMesh, buildingLines].forEach((item) =>
        item.position.set(
          posX - gridSize / 2 + 0.5,
          buildingHeight / 2 + 0.001,
          posZ - gridSize / 2 + 0.5
        )
      );
      buildingMesh.userData = {
        xIndex: posX,
        zIndex: posZ,
        height: buildingHeight,
        color: `#${buildingColour.getHexString()}`,
      };
      buildings[`${posX},${posZ}`] = buildingMesh;
      cityGroup.add(buildingMesh);
      cityGroup.add(buildingLines);
    }
  }

  Object.keys(buildings).forEach((key) => {
    relationships[key] = [];

    // Randomly pick 1-3 connections
    const numConnections = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numConnections; i++) {
      const dx = Math.floor(Math.random() * gridSize);
      const dz = Math.floor(Math.random() * gridSize);
      const targetKey = `${dx},${dz}`;

      if (targetKey !== key && !relationships[key].includes(targetKey)) {
        relationships[key].push(targetKey);
      }
    }
  });

  function getCanvasRelativePosition(event) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) * canvas.width) / rect.width,
      ((event.clientY - rect.top) * canvas.height) / rect.height
    );
  }

  function setPickPosition(event) {
    // Set the pick position relative to the canvas NDC and the mouse position according to the screen
    const pos = getCanvasRelativePosition(event);
    pickPosition.setX((pos.x / canvas.width) * 2 - 1);
    pickPosition.setY((pos.y / canvas.height) * -2 + 1);
    mousePosition.setX(event.clientX);
    mousePosition.setY(event.clientY);
  }

  function clearPickPosition() {
    pickPosition.setX(-100000);
    pickPosition.setY(-100000);

    mousePosition.setX(-10000);
    mousePosition.setY(-100000);
  }

  window.addEventListener("mousemove", setPickPosition);
  window.addEventListener("mouseout", clearPickPosition);
  window.addEventListener("mouseleave", clearPickPosition);

  function updateToolTipData(building) {
    if (building == null || mousePosition.x < 0) {
      isHovering = false;
      tooltip.style.display = "none";
    } else {
      isHovering = true;
      const { xIndex, zIndex, height, color } = building.userData;
      tooltip.style.left = `${mousePosition.x + 10}px`;
      tooltip.style.top = `${mousePosition.y + 10}px`;
      tooltip.innerHTML = `Building ${xIndex}/${zIndex}<br>Height: ${height.toFixed(
        3
      )}<br>Color: ${color}`;
      tooltip.style.display = "block";
    }
  }

  function createCurve(from, to) {
    // const midY = Math.max(from.position.y, to.position.y) + 2; // Raise the curve
    const midY = 3.5;

    const points = [
      from.position
        .clone()
        .add(new THREE.Vector3(0, from.geometry.parameters.height / 2, 0)), // Start at top
      new THREE.Vector3(
        (from.position.x + to.position.x) / 2,
        midY,
        (from.position.z + to.position.z) / 2
      ), // Control point
      to.position
        .clone()
        .add(new THREE.Vector3(0, to.geometry.parameters.height / 2, 0)), // End at top of target
    ];

    return new THREE.CatmullRomCurve3(points);
  }

  let activeCurves = [];

  function showConnections(building) {
    const buildingKey = `${building.userData.xIndex},${building.userData.zIndex}`;
    // Remove old curves
    hideConnections();

    if (relationships[buildingKey]) {
      relationships[buildingKey].forEach((targetKey) => {
        const from = buildings[buildingKey];
        const to = buildings[targetKey];

        const curve = createCurve(from, to);
        const curveGeometry = new THREE.TubeGeometry(curve, 20, 0.05, 8, false);
        const curveMaterial = new THREE.MeshBasicMaterial({
          color: "#38a3a5",
        });
        const curveMesh = new THREE.Mesh(curveGeometry, curveMaterial);

        cityGroup.add(curveMesh);
        activeCurves.push(curveMesh);
      });
    }
  }

  function hideConnections() {
    activeCurves.forEach((curveObj) => cityGroup.remove(curveObj));
    activeCurves = [];
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

    const pickedBuilding = pickHelper.pick(
      pickPosition,
      Object.values(buildings),
      camera
    );
    updateToolTipData(pickedBuilding);

    // Only continue the camera controls if the user is not hovering
    if (!isHovering) {
      hideConnections();
      controls.update();
    } else {
      showConnections(pickedBuilding);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();