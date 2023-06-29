import * as THREE from 'three';

import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

import Stats from 'three/addons/libs/stats.module.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';

// Controls
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import * as CANNON from 'cannon-es'


const basePath = import.meta.env.BASE_URL;

const container = document.getElementById('container');
const loading = document.querySelector('.loading');

let camera, scene, composer, renderer, controls, stats;


// Pointer Lock Controls

let raycaster;

let moveSpeed = 100; // higher means slower for some reason
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Physics
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0)
let worldDelta;
const clock = new THREE.Clock()

const normalMaterial = new THREE.MeshNormalMaterial()
const phongMaterial = new THREE.MeshPhongMaterial()
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
const cubeMesh = new THREE.Mesh(cubeGeometry, normalMaterial)
const cubeShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
const cubeBody = new CANNON.Body({ mass: 1 })
const planeGeometry = new THREE.PlaneGeometry(25, 25)
const planeMesh = new THREE.Mesh(planeGeometry, phongMaterial)
const planeShape = new CANNON.Plane()
const planeBody = new CANNON.Body({ mass: 0 })

init();
animate();



function init() {

  scene = new THREE.Scene();
  // scene.fog = new THREE.FogExp2(0xffffff, 0.01);

  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.gammaFactor = 2.2;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2;
  renderer.outputEncoding = THREE.sRGBEncoding;

  container.appendChild(renderer.domElement);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(0, 1.9, 16.5);



  // Physics

  cubeMesh.position.x = 0
  cubeMesh.position.y = -10
  // scene.add(cubeMesh)

  cubeBody.addShape(cubeShape)
  cubeBody.position.x = cubeMesh.position.x
  cubeBody.position.y = cubeMesh.position.y
  cubeBody.position.z = cubeMesh.position.z
  // world.addBody(cubeBody)
  
  planeMesh.rotateX(-Math.PI / 2)
  // scene.add(planeMesh)
 
  planeBody.addShape(planeShape)
  planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
  // world.addBody(planeBody)



  // Lights

  const dirLight = new THREE.DirectionalLight(0xffffff, 10);
  dirLight.color.setHSL(0.1, 1, 0.95);
  dirLight.position.set(- 1, 1.75, 1);
  dirLight.position.multiplyScalar(30);
  // scene.add(dirLight);



  //
  // Post Processing
  //

  const renderScene = new RenderPass(scene, camera);

  // Bloom
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0;
  bloomPass.strength = 0.2;
  bloomPass.radius = 0;

  // Pixelated
  const renderPixelatedPass = new RenderPixelatedPass(4, scene, camera);

  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  // composer.addPass(renderPixelatedPass);
  // composer.addPass(bloomPass);




  //
  //  Controls
  //


  controls = new PointerLockControls(camera, container);
  controls.pointerSpeed = 0.5;

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  instructions.style.display = 'none';
  blocker.style.display = 'none';

  instructions.addEventListener('click', function () {
    controls.lock();
  });

  controls.addEventListener('lock', function () {
    instructions.style.display = 'none';
    blocker.style.display = 'none';
  });

  controls.addEventListener('unlock', function () {
    blocker.style.display = 'block';
    instructions.style.display = '';
  });

  scene.add(controls.getObject());


  const onKeyDown = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
      case 'Space':
        if (canJump === true) velocity.y += 350;
        canJump = false;
        break;
    }
  };

  const onKeyUp = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, - 1, 0), 0, 10);



  //
  //  Loading external assets
  //


  new EXRLoader()

    .setPath(basePath + 'images/textures/')
    .load('skybox.exr', function (texture) {

      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = texture;

      const loader = new GLTFLoader().setPath(basePath + 'models/');

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(basePath + 'libs/draco/');
      loader.setDRACOLoader(dracoLoader);

      const ktx2Loader = new KTX2Loader().setTranscoderPath(basePath + 'libs/basis/').detectSupport(renderer);

      loader.setKTX2Loader(ktx2Loader);
      loader.setMeshoptDecoder(MeshoptDecoder);

      loader.load('the-chapel.glb', function (building) {

        scene.add(building.scene);

        // Shows UI
        blocker.style.display = 'block';
        instructions.style.display = '';

        container.classList.add('in');
        loading.classList.remove('in');

      });

    });

  window.addEventListener('resize', onWindowResize);

} // /Init






//
// Misc
//

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}



//
// ANIMATE
//

function animate() {

  requestAnimationFrame(animate);
  const time = performance.now();

  worldDelta = Math.min(clock.getDelta(), 0.1);
  world.step(worldDelta);

  // Copy coordinates from Cannon to Three.js
  cubeMesh.position.set(
    cubeBody.position.x,
    cubeBody.position.y,
    cubeBody.position.z
  )
  cubeMesh.quaternion.set(
    cubeBody.quaternion.x,
    cubeBody.quaternion.y,
    cubeBody.quaternion.z,
    cubeBody.quaternion.w
  )

  raycaster.ray.origin.copy(controls.getObject().position);
  raycaster.ray.origin.y -= 10;

  const delta = (time - prevTime) / 1000;

  velocity.x -= velocity.x * moveSpeed * delta;
  velocity.z -= velocity.z * moveSpeed * delta;

  velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize(); // this ensures consistent movements in all directions

  if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

  controls.moveRight(- velocity.x * delta);
  controls.moveForward(- velocity.z * delta);

  prevTime = time;
  composer.render();

}
