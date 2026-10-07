import * as THREE from 'three';

import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';


import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';

// Controls

import * as CANNON from 'cannon-es'
import { PointerLockControlsCannon } from './js/PointerLockControlsCannon.js';
import { threeToCannon, ShapeType } from 'three-to-cannon';

const basePath = import.meta.env.BASE_URL;

const container = document.getElementById('container');
const loading = document.querySelector('.loading');

let camera, scene, composer, renderer, ambientSound, startButton;


// Pointer Lock Controls

// cannon.js variables
let world
let controls
const timeStep = 1 / 60
let lastCallTime = performance.now() / 1000
let sphereShape
let sphereBody
let physicsMaterial

const progressBar = document.querySelector('.progress-bar-inner');

initCannon();
init();
initPointerLock()

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
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1, 0);

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
  renderPixelatedPass.normalEdgeStrength = 0;


  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  // composer.addPass(renderPixelatedPass);
  // composer.addPass(bloomPass);



  //
  // Ambient Audio
  //

  // create an AudioListener and add it to the camera
  const listener = new THREE.AudioListener();
  camera.add(listener);

  // create a global audio source
  ambientSound = new THREE.Audio(listener);

  // load a sound and set it as the Audio object's buffer
  const audioLoader = new THREE.AudioLoader();
  audioLoader.load('sounds/ambient.mp3', function (buffer) {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(1);
  });



  //
  //  Loading external assets
  //

  const exrloader = new EXRLoader()

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

      loader.load('the-chapel.glb', function (mesh) {

        scene.add(mesh.scene);

        loader.load('collision.glb', function (mesh) {

          // scene.add(mesh.scene);

          mesh.scene.children.forEach(function (node) {
            if (node.isMesh) {
              // Converts mesh to cannonjs
              // The collision mesh needs to be made moslty of boxes
              const { shape, offset, quaternion } = threeToCannon(node);
              // Add the shape to a CANNON.Body.
              let body = new CANNON.Body({ mass: 0, material: physicsMaterial });
              body.addShape(shape, offset, quaternion);
              body.position = node.position;
              body.type = CANNON.Body.STATIC;
              world.addBody(body)
            }
          });

          // Shows UI
          blocker.style.display = 'block';
          instructions.style.display = '';

          container.classList.add('in');
          loading.classList.remove('in');

        });

      }, progressBarHandler);

    });


  window.addEventListener('resize', onWindowResize);

} // /Init

function progressBarHandler(e){
  console.log(e);
    progressBar.style.width = Math.round(e.loaded * 100 / e.total) + "%";
}


function initCannon() {
  // Setup world
  world = new CANNON.World()

  // Tweak contact properties.
  // Contact stiffness - use to make softer/harder contacts
  world.defaultContactMaterial.contactEquationStiffness = 1e9

  // Stabilization time in number of timesteps
  world.defaultContactMaterial.contactEquationRelaxation = 4

  const solver = new CANNON.GSSolver()
  solver.iterations = 7
  solver.tolerance = 0.1
  world.solver = new CANNON.SplitSolver(solver)
  // use this to test non-split solver
  // world.solver = solver

  world.gravity.set(0, -2, 0)

  world.broadphase.useBoundingBoxes = true

  physicsMaterial = new CANNON.Material('physics')
  const physics_physics = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
    friction: 0.0,
    restitution: 0.3,
  })

  world.addContactMaterial(physics_physics)

  // Create the user collision sphere
  const radius = 1;
  sphereShape = new CANNON.Sphere(radius);
  sphereBody = new CANNON.Body({ mass: 5, material: physicsMaterial });
  sphereBody.addShape(sphereShape);
  sphereBody.position.set(0, 1.75, 16.3);
  sphereBody.linearDamping = 0.9;
  world.addBody(sphereBody)

  // Create the ground plane
  const groundShape = new CANNON.Plane()
  const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial });
  groundBody.addShape(groundShape);
  groundBody.position.set(0, 0.02, 0); // There's a little offset on the model  
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
}


function initPointerLock() {

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');
  const aboutPage = document.querySelector('.about');
  const startButton = document.querySelector('.start-button');
  const aboutButton = document.querySelector('.about-button');
  const backButton = document.querySelector('.back-button');

  instructions.style.display = 'none';
  blocker.style.display = 'none';

  controls = new PointerLockControlsCannon(camera, sphereBody)
  controls.velocityFactor = 0.075;
  controls.jumpVelocity = 0;
  scene.add(controls.getObject())

  startButton.addEventListener('click', () => {
    controls.lock()
  })

  controls.addEventListener('lock', () => {
    controls.enabled = true
    instructions.style.display = 'none'
    blocker.style.display = 'none';
    ambientSound.play();
  })

  controls.addEventListener('unlock', () => {
    controls.enabled = false
    instructions.style.display = null
    blocker.style.display = 'block';
    ambientSound.pause();
  })

  aboutButton.addEventListener('click', () => {
    aboutPage.style.display = 'flex';
    instructions.style.display = 'none';
  })

  backButton.addEventListener('click', () => {
    aboutPage.style.display = 'none';
    instructions.style.display = 'flex';
  })

}


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

  const time = performance.now() / 1000
  const delta = time - lastCallTime
  lastCallTime = time

  if (controls.enabled) {
    world.step(timeStep, delta)
  }

  controls.update(delta)

  composer.render();

}
