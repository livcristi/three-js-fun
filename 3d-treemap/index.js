import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

import * as d3 from "d3";
import {
  treemap,
  hierarchy,
  group,
  format as d3Format,
  scaleSequential,
  interpolateMagma,
} from "d3";
import { gsap } from "gsap";

// Other constants
const dimensions = { width: 954, height: 50, depth: 1060 };
// const height = 604.8;

const width = window.innerWidth; // Or however you define 'width'
const height = window.innerHeight; // Or however you define 'height'

// Data
let chartData;
let getNodesAt;
let getNodeFullName;
let format;
let color;

// Fonts
let helvetiker;
const fontSize = 10;
const tolerance = 0.6;

async function loadFont() {
  const url =
    "https://cdn.jsdelivr.net/npm/three@0.174.0/examples/fonts/helvetiker_regular.typeface.json";
  const response = await fetch(url);
  const json = await response.json();
  helvetiker = new FontLoader().parse(json);
}

// Three.js components
let camera;
let scene;
let cameraOrtho;
let sceneOrtho;
let controls;
let renderer;
let raycaster;
let mouse;
const tooltipType = "html";
let tooltip;
let pool;

function initGraphicalComponents() {
  // Initialise the camera
  camera = (() => {
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.2, 1500);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.set(0, 750, 0);
    return camera;
  })();

  // Initialise the scene
  scene = (() => {
    const scene = new THREE.Scene();
    scene.position.x = -dimensions.width / 2;
    scene.position.y = dimensions.height / 2;
    scene.position.z = -dimensions.depth / 2;
    scene.background = new THREE.Color(0xffffff);
    return scene;
  })();

  // Initialise the ortho camera for 2d
  cameraOrtho = (() => {
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      1,
      10
    );
    camera.position.z = 10;
    return camera;
  })();

  sceneOrtho = new THREE.Scene();

  // Initialise the renderer
  renderer = (() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClear = false;
    return renderer;
  })();

  // Initialise the controls
  controls = (() => {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2.5;
    controls.minDistance = 150;
    controls.maxDistance = 750;
    controls.addEventListener("change", () => {
      tooltip.clear();
      renderer.clear();
      renderer.render(scene, camera);
    });
    controls.update();
    return controls;
  })();

  // Initialise the user interaction part
  raycaster = new THREE.Raycaster();

  mouse = {
    screen: new THREE.Vector2(),
    scene: new THREE.Vector2(),
    animating: false,
    focus: null,
  };

  // Initialise the tooltip
  tooltip = (() => {
    const tooltip =
      tooltipType === "html" ? initDivTooltip() : initSpriteTooltip();
    return tooltip;
  })();

  console.log(camera);
  console.log(scene);
  console.log(cameraOrtho);
  console.log(sceneOrtho);
  console.log(renderer);
  console.log(controls);
  console.log(raycaster);
  console.log(mouse);
}

function render() {
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(sceneOrtho, cameraOrtho);
}

function trackMouse(e) {
  e.preventDefault();
  if (e.target instanceof HTMLCanvasElement) {
    const x = e.offsetX + e.target.offsetLeft;
    const y = e.offsetY + e.target.offsetTop;
    mouse.screen.x = x;
    mouse.screen.y = y;
    mouse.scene.x = (e.offsetX / width) * 2 - 1;
    mouse.scene.y = -(e.offsetY / height) * 2 + 1;
    if (!mouse.animating) {
      intersect();
    }
  }
}

function zoom(e) {
  mouse.animating = true;
  // Disable the OrbitControls to avoid interfering with the animation
  controls.enabled = false;

  let requestId;
  if (mouse.focus)
    moveCamera(
      true,
      camera.position.x,
      450,
      camera.position.z,
      -(mouse.focus.position.x + mouse.focus.scale.x / 2) + camera.position.x,
      dimensions.height / 2,
      -(mouse.focus.position.z + mouse.focus.scale.z / 2) + camera.position.z
    );
  else
    moveCamera(
      false,
      0,
      750,
      0,
      -dimensions.width / 2,
      dimensions.height / 2,
      -dimensions.depth / 2,
      -1.57,
      0,
      0
    );

  function moveCamera(dollyOut, x, y, z, sx, sy, sz, rx, ry, rz) {
    animate();
    if (dollyOut)
      gsap.to(camera.position, { duration: 0.1, y: 600 }).then(() => move());
    else move();

    function move() {
      const tweens = [];
      if (requires(x, y, z))
        tweens.push(gsap.to(camera.position, { duration: 0.25, x, y, z }));
      if (requires(sx, sy, sz))
        tweens.push(
          gsap.to(scene.position, { duration: 0.25, x: sx, y: sy, z: sz })
        );
      if (requires(rx, ry, rz))
        tweens.push(
          gsap.to(camera.rotation, { duration: 0.25, x: rx, y: ry, z: rz })
        );
      Promise.all(tweens).then(() => {
        // Exit the animation loop after the transition is finished.
        cancelAnimationFrame(requestId);
        if (!mouse.focus) controls.reset();
        else controls.update();

        mouse.animating = false;
        controls.enabled = true;
      });
    }
  }

  function requires(a, b, c) {
    return a || a === 0 || b || b === 0 || c || c === 0;
  }

  function animate() {
    requestId = requestAnimationFrame(animate);
    renderer.clear();
    renderer.render(scene, camera);
  }
}

function intersect() {
  camera.updateMatrixWorld();
  cameraOrtho.updateMatrixWorld();
  raycaster.setFromCamera(mouse.scene, camera);

  const intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0) {
    let target;
    for (let current of intersects) {
      if (current.object.info) {
        target = current.object;
        break;
      }
    }

    if (target) {
      if (mouse.focus !== target) {
        cancelHighlight();
        mouse.focus = target;
        addFrame(target);
        tooltip.update(mouse.focus);
        render();
      }
    } else {
      cancelHighlight();
    }
  } else {
    cancelHighlight();
  }
}

function cancelHighlight() {
  const f = mouse.focus;
  if (f) {
    if (f.frame) {
      f.remove(f.frame);
      f.frame.geometry.dispose();
      f.frame.material.dispose();
      f.frame = null;
    }
    mouse.focus = null;
    tooltip.clear();
    render();
  }
}

function initDivTooltip() {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.display = "none";
  div.style.font = "9pt Tahoma";
  div.style.backgroundColor = "white";
  div.style.opacity = 0.85;
  div.style.borderRadius = "3px";
  div.style.boxShadow = "1px 1px 1px #666666";
  div.style.border = "solid 1px #666666";
  div.style.padding = "3px";
  div.style.pointerEvents = "none";

  const tooltip = {
    attach: function (container) {
      if (container) container.appendChild(div);
    },
    update: function (target) {
      div.innerText =
        getNodeFullName(target.info) + "\n" + format(target.info.value);
      div.style.display = "block";
      div.style.left = `${mouse.screen.x + 5}px`;
      div.style.top = `${mouse.screen.y + 5}px`;
    },
    clear: function () {
      div.innerText = "";
      div.style.display = "none";
    },
    dispose: function () {
      if (div.parentElement) div.parentElement.removeChild(div);
    },
  };

  return tooltip;
}

function initSpriteTooltip() {
  const font = "9pt Tahoma",
    canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");

  ctx.font = font;
  const maxWidth = Math.ceil(calcWidth()),
    tm = ctx.measureText("Z"),
    fontHeight = tm.fontBoundingBoxAscent + tm.fontBoundingBoxDescent;

  canvas.width = maxWidth;
  canvas.height = fontHeight * 2 + 10;

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0, 1);
  sprite.scale.set(maxWidth, canvas.height, 1);
  sceneOrtho.add(sprite);

  const tooltip = {
    sprite,
    attach: function () {},
    update: function (target) {
      drawTooltip(target);
      sprite.position.set(
        mouse.screen.x - width / 2,
        -mouse.screen.y + height / 2,
        1
      );
    },
    clear: function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    dispose: function () {
      sceneOrtho.remove(this.sprite);
      sprite.geometry.dispose();
      sprite.material.map.dispose();
      sprite.material.dispose();
    },
  };

  return tooltip;

  function calcWidth() {
    let maxWidth = 0;
    getNodesAt(0)[0]
      .descendants()
      .forEach((node) => {
        const w = ctx.measureText(getNodeFullName(node)).width;
        if (w > maxWidth) maxWidth = w;
      });
    return maxWidth;
  }

  function drawTooltip(target) {
    ctx.font = font;
    const texts = [getNodeFullName(target.info), format(target.info.value)],
      w = Math.max(...texts.map((d) => ctx.measureText(d).width)),
      dims = { w: w + 10, h: fontHeight * texts.length + 10 };

    ctx.clearRect(0, 0, dims.w, dims.h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillRect(0, 0, dims.w, dims.h);
    ctx.fillStyle = "black";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.rect(0, 0, dims.w, dims.h);
    ctx.stroke();
    texts.forEach((t, i) => ctx.fillText(t, 5, fontHeight * i + fontHeight));
    texture.needsUpdate = true;
  }
}

function drawNode(node) {
  // Cuboid
  const h = 6,
    hh = h / 2,
    w = node.x1 - node.x0,
    d = node.y1 - node.y0,
    cl = chartData.length - node.height - 1;

  const cuboid = addCuboid(w, h, d, node.x0, cl * h, node.y0, cl);
  cuboid.info = node;

  const rx = Math.PI * 1.5;
  if (node.children) {
    let label = `${node.data.name} ${format(node.value)}`;
    if (estimate(label) > w) label = node.data.name;
    if (estimate(label) < w)
      addText(
        label,
        fontSize,
        0.3,
        node.x0 + 2,
        cl * h + hh,
        node.y0 + 12,
        rx,
        0,
        0
      );
  } else {
    const labels = node.data.name
        .split(/(?=[A-Z][^A-Z])/g)
        .concat(format(node.value)),
      max = Math.max(
        ...labels.map((label) => label.length * fontSize * tolerance)
      );

    if (max < w) {
      if (labels.length * fontSize > d) labels.pop();
      if (labels.length * fontSize < d) {
        labels.forEach((label, i) => {
          addText(
            label,
            fontSize,
            0.3,
            node.x0 + 2,
            cl * h + hh,
            node.y0 + i * 12 + 12,
            rx,
            0,
            0
          );
        });
      }
    }
  }

  function estimate(text) {
    return text.length * fontSize * tolerance;
  }
}

function addCuboid(w, h, d, x, y, z, color) {
  const cuboid = new THREE.Mesh(pool.geometry, pool.materials[color]);
  cuboid.position.set(x + w / 2, y, z + d / 2);
  cuboid.scale.set(w, h, d);

  const frame = new THREE.LineSegments(
    pool.edgeGeometry,
    pool.lineMaterials[color]
  );
  cuboid.add(frame);

  scene.add(cuboid);
  return cuboid;
}

function addText(text, size, h, x, y, z, rx, ry, rz) {
  const geometry = new TextGeometry(text, {
    font: helvetiker,
    size,
    depth: h,
  });
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, pool.textMaterial);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  scene.add(mesh);
  return mesh;
}

// Highlight frame
function addFrame(target) {
  const geometry = new THREE.EdgesGeometry(target.geometry),
    material = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 }),
    frame = new THREE.LineSegments(geometry, material);
  frame.renderOrder = 1;
  target.frame = frame;
  target.add(frame);
}

function dispose() {
  cleanup(scene);

  function cleanup(obj) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      const child = obj.children[i];
      obj.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      if (child.children && child.children.length > 0) cleanup(child);
    }
  }
}

function createPool() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const colors = chartData.map((layer) => color(layer[0]));

  return {
    geometry,
    materials: colors.map(
      (c) =>
        new THREE.MeshBasicMaterial({
          color: c,
          opacity: 0.9,
          transparent: true,
        })
    ),
    edgeGeometry: new THREE.EdgesGeometry(geometry),
    lineMaterials: colors.map(
      (c) =>
        new THREE.LineBasicMaterial({
          color: d3.color(c).darker(0.5).formatHex(),
          linewidth: 1,
        })
    ),
    textMaterial: new THREE.MeshBasicMaterial({ color: 0x333333 }),
  };
}

// Async init function
async function init() {
  await loadFont();

  // 1. Load JSON data
  const response = await fetch("./flare.json"); // make sure it's in your public folder or same directory
  const data = await response.json();

  // 2. Create D3 hierarchy and treemap layout
  const root = treemap()
    .size([dimensions.width, dimensions.depth])
    .paddingOuter(5)
    .paddingInner(5)
    .paddingTop(20)
    .round(true)(
    hierarchy(data)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value)
  );

  // 3. Group nodes by their height
  chartData = Array.from(group(root, (d) => d.height));

  // 4. Define helpers
  getNodesAt = (layer) => chartData[layer][1];
  getNodeFullName = (node) =>
    node
      .ancestors()
      .reverse()
      .map((d) => d.data.name)
      .join("/");
  format = d3Format(",d");
  color = scaleSequential([8, 0], interpolateMagma);

  // 5. Call your render/setup function now that data is ready
  initGraphicalComponents();
  initTreemap(document.body);
}

function initTreemap(containerElement) {
  // Append renderer to container
  containerElement.appendChild(renderer.domElement);

  // Prepare global pool based on chartData
  pool = createPool();

  // Draw the nodes
  chartData.forEach((layer) => layer[1].forEach(drawNode));

  render();

  // Add interaction listeners
  containerElement.addEventListener("mousemove", trackMouse, false);
  containerElement.addEventListener("dblclick", zoom, false);
  tooltip.attach(containerElement);

  // Clean up on unload
  window.addEventListener("unload", () => {
    dispose();
    containerElement.removeEventListener("mousemove", trackMouse);
    containerElement.removeEventListener("dblclick", zoom);

    const mem = renderer.info.memory;
    if (mem.geometries > 1 || mem.textures > 1) {
      console.log("Memory leak?", mem);
    }
    renderer.dispose();
  });
}

// Event listeners for clean-up
window.addEventListener("unload", () => {
  renderer.dispose();
  controls.dispose();
  tooltip.dispose();
});

// Start the async setup
init();
