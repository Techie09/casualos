import {
  Scene,
  Camera,
  Renderer,
  Clock,
  Mesh,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  MeshStandardMaterial,
  Vector3,
  Vector2,
  Math as ThreeMath,
  Group,
  Raycaster,
  Intersection,
  MeshBasicMaterial,
  Object3D,
  LineBasicMaterial,
  PCFSoftShadowMap,
  BackSide,
  TextureLoader,
  OrbitControls,
  SphereBufferGeometry,
  BoxBufferGeometry,
  GLTFLoader,
  HemisphereLight,
  GridHelper,
  OrthographicCamera,
} from 'three';
import 'three-examples/controls/OrbitControls';
import 'three-examples/loaders/GLTFLoader';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Inject } from 'vue-property-decorator';
import {
  SubscriptionLike,
  Observable,
  fromEvent,
  combineLatest,
} from 'rxjs';
import {
  filter,
  map,
  tap,
  scan,
} from 'rxjs/operators';
import {
  find
} from 'lodash';

import { File, Object, Workspace } from '@yeti-cgi/aux-common';

import skyTextureUrl from '../public/images/CGSkies_0132_free.jpg';
import groundModelUrl from '../public/models/ground.gltf';
import { appManager } from '../../shared/AppManager';
import { HexGridMesh, Axial, posToKey } from '../../shared/scene/hex';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { GridMesh } from '../../shared/scene/grid/GridMesh';
import { WorkspaceMesh } from '../../shared/scene/WorkspaceMesh';

@Component({
})
export default class GameView extends Vue {

  tileRatio: number = 1;
  showInvalid: boolean = false;

  size: number = 3;

  get showDots() {
    return this._debugDots.visible;
  }

  set showDots(val: boolean) {
    this._debugDots.visible = false;
  }

  private _debugDots: Object3D;
  private _scene: Scene;
  private _camera: Camera;
  private _cameraControls: OrbitControls;
  private _cameraControlsEnabled: boolean = true;
  private _renderer: Renderer;
  private _raycaster: Raycaster;

  private _sun: DirectionalLight;
  private _ambient: AmbientLight;
  private _skylight: HemisphereLight;

  private _workspacePlane: Mesh;
  private _skydome: Mesh;
  private _draggableObjects: Object3D[];
  private _grids: Group;
  private _canvas: HTMLElement;

  private _checker: GridChecker;

  private _workspaces: WorkspaceMesh[];

  images: string[];

  get gameView() {
    const gameView: HTMLElement = <HTMLElement>this.$refs.gameView;
    return gameView;
  }

  get fileManager() {
    return appManager.fileManager;
  }

  constructor() {
    super();
    this.images = [];
  }

  async mounted() {
    this._workspaces = [];
    this._draggableObjects = [];    
    this._setupScene();
    this._renderGame();
  }

  private async _setupScene() {

    this._scene = new Scene();
    this._scene.background = new Color(0xCCE6FF);

    this._debugDots = new Object3D();
    this._scene.add(this._debugDots);

    this._raycaster = new Raycaster();

    this._setupRenderer();

    // Grid group.
    this._grids = new Group();
    this._grids.visible = false;
    this._scene.add(this._grids);


    // User's camera
    // this._camera = new PerspectiveCamera();
    // this._camera.position.z = 5;
    // this._camera.position.y = 3;
    // this._camera.rotation.x = ThreeMath.degToRad(-30);
    this._camera = new OrthographicCamera(-10, 10, 10, -10, 0.1);
    this._camera.position.y = 10;
    this._camera.rotation.x = ThreeMath.degToRad(-90);
    this._camera.updateMatrixWorld(false);

    this._cameraControls = new OrbitControls(this._camera, this._canvas);

    // Ambient light.
    this._ambient = new AmbientLight(0xffffff, 0.8);
    this._scene.add(this._ambient);

    // Sky light.
    this._skylight = new HemisphereLight(0xc1e0fd, 0xffffff, .6);
    this._scene.add(this._skylight);


    // Sun light.
    this._sun = new DirectionalLight(0xffffff, .6);
    this._sun.position.set(5, 5, 5);
    this._sun.position.multiplyScalar(50);
    this._sun.name = "sun";
    this._sun.castShadow = true;
    this._sun.shadowMapWidth = this._sun.shadowMapHeight = 1024 * 2;

    var d = 30;
    this._sun.shadow.camera.left = -d;
    this._sun.shadow.camera.right = d;
    this._sun.shadow.camera.top = d;
    this._sun.shadow.camera.bottom = -d;
    this._sun.shadow.camera.far = 3500;

    this._scene.add(this._sun);


    // Workspace plane.
    var gltfLoader = new GLTFLoader();
    gltfLoader.load(groundModelUrl, gltf => {
      gltf.scene.traverse((child) => {
        if ((<any>child).isMesh) {
          console.log('[GameView] Assigned workspace plane mesh from gltf file.');
          this._workspacePlane = <Mesh>child;
          this._workspacePlane.castShadow = true;
          this._workspacePlane.receiveShadow = true;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.position.y = 0;
          this._workspacePlane.position.x = 0;
          this._workspacePlane.rotation.x = ThreeMath.DEG2RAD * -90;
          this._workspacePlane.updateMatrixWorld(false);

          // Scale up the workspace plane.
          this._workspacePlane.scale.multiplyScalar(18000);
      
          this._scene.add(this._workspacePlane);
          return;
        }
      });
    });

    // Skydome
    const skydomeGeometry = new SphereBufferGeometry(9000, 64, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const skydomeTexture = new TextureLoader().load(skyTextureUrl);
    const skydomeMaterial = new MeshBasicMaterial({
      side: BackSide,
      map: skydomeTexture,
    });

    this._skydome = new Mesh(skydomeGeometry, skydomeMaterial);
    this._skydome.castShadow = false;
    this._skydome.receiveShadow = false;
    this._skydome.position.set(0, 0, 0);

    this._scene.add(this._skydome);

    this._checker = new GridChecker(0.1);
    const workspace: Workspace = {
      id: 'test',
      type: 'workspace',
      position: { x: 3, y: 0, z: 0},
      size: 3,
      grid: {
        [posToKey(new Axial(-2, 2))]: {
          height: 1
        },
        [posToKey(new Axial(-2, 1))]: {
          height: 1
        },
        [posToKey(new Axial(-2, 0))]: {
          height: 1
        },
        [posToKey(new Axial(-1, 2))]: {
          height: 1
        },
        [posToKey(new Axial(-1, -1))]: {
          height: 1
        },
      },
      scale: 0.5,
      gridScale: .2,
      defaultHeight: 0.1,
      color: "#999999"
    };
    const workspaceMesh = new WorkspaceMesh();
    await workspaceMesh.update(workspace);

    this._workspaces.push(workspaceMesh);
    
    this._workspaces.forEach(w => {
      this._scene.add(w);
    });

  }

  async test() {
    const workspace = this._workspaces[0];
    workspace.workspace.size = this.size;
    this._checker.tileRatio = this.tileRatio;

    workspace.updateHexGrid();
    const results = await workspace.updateSquareGrids(this._checker);
    workspace.gridsVisible = true;
    this.images = results.levels.map(l => l._image);

    this._scene.remove(this._debugDots);
    this._debugDots = GridChecker.createVisualization(results, { workspace: workspace });
    this._scene.add(this._debugDots);
  }

  toggleDots() {
    this._debugDots.visible = !this._debugDots.visible;
  }

  private _setupRenderer() {
    const webGlRenderer = this._renderer = new WebGLRenderer({
      antialias: true,
    });
    webGlRenderer.shadowMap.enabled = true;
    webGlRenderer.shadowMap.type = PCFSoftShadowMap;

    // TODO: Call each time the screen size changes
    const container: HTMLElement = <HTMLElement>this.$refs.container;
    const width = window.innerWidth;
    // const height = window.innerHeight - container.getBoundingClientRect().top;
    this._renderer.setSize(500, 500);
    // container.style.height = this._renderer.domElement.style.height;

    this._canvas = this._renderer.domElement;
    this.gameView.appendChild(this._canvas);

  }

  private _renderGame() {
    requestAnimationFrame(() => this._renderGame());


    this._updateGame();

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame() {
  }

};