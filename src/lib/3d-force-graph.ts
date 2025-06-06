import { 
  REVISION, 
  AmbientLight, 
  DirectionalLight,
  Light,
  Scene,
  Camera,
  WebGLRenderer,
  WebGLRendererParameters,
  Object3D,
  Vector3
} from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import ThreeForceGraph, { NodeObject, LinkObject, GraphData, ThreeForceGraphGeneric } from 'three-forcegraph';
import ThreeRenderObjects, { ThreeRenderObjectsInstance } from 'three-render-objects';
import accessorFn from 'accessor-fn';
import Kapsule, { KapsuleInstance } from 'kapsule';

type Accessor<In, Out> = Out | string | ((obj: In) => Out);
type ObjAccessor<T, InT = object> = Accessor<InT, T>;
type Label = string | HTMLElement;
type Coords = { x: number; y: number; z: number };

interface ConfigOptions {
  controlType?: 'trackball' | 'orbit' | 'fly';
  rendererConfig?: WebGLRendererParameters;
  extraRenderers?: any[];
}

interface IdleState {
  lastRenderTime: number;
  isIdle: boolean;
  lastNodePositions: Map<string | number, Coords>;
  consecutiveIdleFrames: number;
  userInteracting: boolean;
  targetFPS: number;
  idleFPS: number;
  useTimer: boolean;
  interactionTimeout?: NodeJS.Timeout;
  wheelTimeout?: NodeJS.Timeout;
}

interface GraphObject<N extends NodeObject = NodeObject, L extends LinkObject<N> = LinkObject<N>> extends Object3D {
  __graphObjType?: 'node' | 'link';
  __data?: N | L;
  __initialFixedPos?: { fx?: number; fy?: number; fz?: number };
  __initialPos?: Coords;
  __dragged?: boolean;
  __disposeControlsAfterDrag?: boolean;
  position: Vector3;
}

interface State<N extends NodeObject = NodeObject, L extends LinkObject<N> = LinkObject<N>> {
  // Core components
  forceGraph: ThreeForceGraph<N, L>;
  renderObjs: ThreeRenderObjectsInstance;
  container?: HTMLDivElement;
  
  // Graph data
  graphData: { nodes: N[]; links: L[] };
  
  // Interaction state
  hoverObj?: GraphObject | null;
  enablePointerInteraction: boolean;
  enableNavigationControls: boolean;
  enableNodeDrag: boolean;
  
  // Animation state
  animationFrameRequestId: number | null;
  _idleState?: IdleState;
  _dragControls?: DragControls;
  lastSetCameraZ: number;
  
  // Event callbacks
  onNodeDrag: (node: N, translate: Coords) => void;
  onNodeDragEnd: (node: N, translate: Coords) => void;
  onNodeClick?: (node: N, event: MouseEvent) => void;
  onNodeRightClick?: (node: N, event: MouseEvent) => void;
  onNodeHover?: (node: N | null, previousNode: N | null) => void;
  onLinkClick?: (link: L, event: MouseEvent) => void;
  onLinkRightClick?: (link: L, event: MouseEvent) => void;
  onLinkHover?: (link: L | null, previousLink: L | null) => void;
  onBackgroundClick?: (event: MouseEvent) => void;
  onBackgroundRightClick?: (event: MouseEvent) => void;
  
  // Labels
  nodeLabel: ObjAccessor<Label, N>;
  linkLabel: ObjAccessor<Label, L>;
  
  // Engine
  forceEngine: 'd3' | 'ngraph';
}

interface LinkedKapsule<T> {
  linkProp: (prop: keyof T) => {
    default: any;
    onChange: (v: any, state: any) => void;
    triggerUpdate: boolean;
  };
  linkMethod: (method: keyof T) => (state: any, ...args: any[]) => any;
}

function linkKapsule<T extends Record<string, any>>(kapsulePropName: string, kapsuleType: new() => T): LinkedKapsule<T> {
  const dummyK = new kapsuleType();
  if ('_destructor' in dummyK && typeof dummyK._destructor === 'function') {
    dummyK._destructor();
  }
  
  return {
    linkProp: (prop: keyof T) => ({
      default: typeof dummyK[prop] === 'function' ? dummyK[prop]() : dummyK[prop],
      onChange(v: any, state: Record<string, any>) {
        const instance = state[kapsulePropName];
        if (typeof instance[prop] === 'function') {
          instance[prop](v);
        }
      },
      triggerUpdate: false
    }),
    linkMethod: (method: keyof T) => {
      return function(this: any, state: Record<string, any>, ...args: any[]) {
        const kapsuleInstance = state[kapsulePropName];
        const returnVal = kapsuleInstance[method](...args);
        return returnVal === kapsuleInstance ? this : returnVal;
      };
    }
  };
}

const three = (window as any).THREE ? (window as any).THREE : {
  AmbientLight,
  DirectionalLight,
  REVISION
};

const CAMERA_DISTANCE2NODES_FACTOR = 170;

// Expose config from forceGraph
// @ts-ignore - Complex generic types
const bindFG = linkKapsule('forceGraph', ThreeForceGraph as any);
const linkedFGProps = Object.assign(
  {},
  ...['jsonUrl', 'graphData', 'numDimensions', 'dagMode', 'dagLevelDistance', 'dagNodeFilter', 'onDagError',
    'nodeRelSize', 'nodeId', 'nodeVal', 'nodeResolution', 'nodeColor', 'nodeAutoColorBy', 'nodeOpacity',
    'nodeVisibility', 'nodeThreeObject', 'nodeThreeObjectExtend', 'nodePositionUpdate',
    'linkSource', 'linkTarget', 'linkVisibility', 'linkColor', 'linkAutoColorBy', 'linkOpacity', 'linkWidth',
    'linkResolution', 'linkCurvature', 'linkCurveRotation', 'linkMaterial', 'linkThreeObject',
    'linkThreeObjectExtend', 'linkPositionUpdate', 'linkDirectionalArrowLength', 'linkDirectionalArrowColor',
    'linkDirectionalArrowRelPos', 'linkDirectionalArrowResolution', 'linkDirectionalParticles',
    'linkDirectionalParticleSpeed', 'linkDirectionalParticleWidth', 'linkDirectionalParticleColor',
    'linkDirectionalParticleResolution', 'forceEngine', 'd3AlphaDecay', 'd3VelocityDecay', 'd3AlphaMin',
    'ngraphPhysics', 'warmupTicks', 'cooldownTicks', 'cooldownTime', 'onEngineTick', 'onEngineStop'
  ].map(p => ({ [p]: (bindFG as any).linkProp(p) }))
);

const linkedFGMethods = Object.assign(
  {},
  ...['refresh', 'getGraphBbox', 'd3Force', 'd3ReheatSimulation', 'emitParticle'].map(p => ({ [p]: (bindFG as any).linkMethod(p) }))
);

// Expose config from renderObjs
const bindRenderObjs = linkKapsule('renderObjs', ThreeRenderObjects as any);
const linkedRenderObjsProps = Object.assign(
  {},
  ...['width', 'height', 'backgroundColor', 'showNavInfo', 'enablePointerInteraction'].map(p => ({ [p]: (bindRenderObjs as any).linkProp(p) }))
);

const linkedRenderObjsMethods = Object.assign(
  {},
  ...['lights', 'cameraPosition', 'postProcessingComposer'].map(p => ({ [p]: (bindRenderObjs as any).linkMethod(p) })),
  {
    graph2ScreenCoords: bindRenderObjs.linkMethod('getScreenCoords'),
    screen2GraphCoords: bindRenderObjs.linkMethod('getSceneCoords')
  }
);

function getGraphObj(object: Object3D): GraphObject | null {
  let obj: any = object;
  while (obj && !obj.hasOwnProperty('__graphObjType')) {
    obj = obj.parent;
  }
  return obj;
}

const ForceGraph3DComponent = Kapsule({
  props: {
    ...linkedFGProps,
    ...linkedRenderObjsProps,
    nodeLabel: { default: 'name', triggerUpdate: false },
    linkLabel: { default: 'name', triggerUpdate: false },
    linkHoverPrecision: {
      default: 1,
      onChange(p: number, state: State) {
        state.renderObjs.lineHoverPrecision(p);
      },
      triggerUpdate: false
    },
    enableNavigationControls: {
      default: true,
      onChange(enable: boolean, state: State) {
        const controls = state.renderObjs.controls();
        if (controls) {
          controls.enabled = enable;
          if (enable && controls.domElement) {
            controls.domElement.dispatchEvent(new PointerEvent('pointerup'));
          }
        }
      },
      triggerUpdate: false
    },
    enableNodeDrag: { default: true, triggerUpdate: false },
    onNodeDrag: { default: () => {}, triggerUpdate: false },
    onNodeDragEnd: { default: () => {}, triggerUpdate: false },
    onNodeClick: { triggerUpdate: false },
    onNodeRightClick: { triggerUpdate: false },
    onNodeHover: { triggerUpdate: false },
    onLinkClick: { triggerUpdate: false },
    onLinkRightClick: { triggerUpdate: false },
    onLinkHover: { triggerUpdate: false },
    onBackgroundClick: { triggerUpdate: false },
    onBackgroundRightClick: { triggerUpdate: false }
  },
  
  methods: {
    ...linkedFGMethods,
    ...linkedRenderObjsMethods,
    
    zoomToFit(state: State, transitionDuration?: number, padding?: number, ...bboxArgs: any[]) {
      state.renderObjs.fitToBbox(
        state.forceGraph.getGraphBbox(...bboxArgs),
        transitionDuration,
        padding
      );
      return this;
    },
    
    pauseAnimation(state: State) {
      if (state.animationFrameRequestId !== null) {
        if (state._idleState && state._idleState.isIdle) {
          clearTimeout(state.animationFrameRequestId);
        } else {
          cancelAnimationFrame(state.animationFrameRequestId);
        }
        state.animationFrameRequestId = null;
      }
      return this;
    },
    
    resumeAnimation(state: State) {
      if (state.animationFrameRequestId === null) {
        this._animationCycle();
      }
      return this;
    },
    
    _animationCycle(state: State) {
      if (state.enablePointerInteraction) {
        this.renderer().domElement.style.cursor = null;
      }
      
      // Initialize idle detection state if not present
      if (!state._idleState) {
        state._idleState = {
          lastRenderTime: 0,
          isIdle: false,
          lastNodePositions: new Map(),
          consecutiveIdleFrames: 0,
          userInteracting: false,
          targetFPS: 60,
          idleFPS: 1,
          useTimer: false
        };
      }
      
      const now = performance.now();
      const idleState = state._idleState;
      
      // Check if simulation is still active by comparing node positions
      let nodesMoving = false;
      const nodes = state.forceGraph.graphData().nodes;
      
      if (nodes && nodes.length > 0) {
        for (let i = 0; i < Math.min(10, nodes.length); i++) {
          const node = nodes[i] as any;
          if (node.__threeObj) {
            const prevPos = idleState.lastNodePositions.get(node.id);
            const currPos = {
              x: node.__threeObj.position.x,
              y: node.__threeObj.position.y,
              z: node.__threeObj.position.z
            };
            
            if (prevPos) {
              const movement = Math.sqrt(
                Math.pow(currPos.x - prevPos.x, 2) +
                Math.pow(currPos.y - prevPos.y, 2) +
                Math.pow(currPos.z - prevPos.z, 2)
              );
              
              if (movement > 0.01) {
                nodesMoving = true;
              }
            }
            
            idleState.lastNodePositions.set(node.id, currPos);
          }
        }
      }
      
      // Update idle state
      const wasIdle = idleState.isIdle;
      if (!nodesMoving && !idleState.userInteracting) {
        idleState.consecutiveIdleFrames++;
        if (idleState.consecutiveIdleFrames > 60) { // After 1 second of no movement
          idleState.isIdle = true;
        }
      } else {
        idleState.consecutiveIdleFrames = 0;
        idleState.isIdle = false;
      }
      
      // Frame cycle
      state.forceGraph.tickFrame();
      state.renderObjs.tick();
      
      idleState.lastRenderTime = now;
      
      // Schedule next frame based on idle state
      if (idleState.isIdle && !idleState.userInteracting) {
        // Use setTimeout for idle state (1 FPS)
        if (!wasIdle) {
          console.log('Switching to idle mode (1 FPS)');
        }
        state.animationFrameRequestId = window.setTimeout(() => {
          state.animationFrameRequestId = null;
          this._animationCycle();
        }, 1000); // 1 FPS when idle
      } else {
        // Use requestAnimationFrame for active state (60 FPS)
        if (wasIdle) {
          console.log('Switching to active mode (60 FPS)');
        }
        state.animationFrameRequestId = requestAnimationFrame(() => this._animationCycle());
      }
    },
    
    scene(state: State): Scene {
      return state.renderObjs.scene();
    },
    
    camera(state: State): Camera {
      return state.renderObjs.camera();
    },
    
    renderer(state: State): WebGLRenderer {
      return state.renderObjs.renderer();
    },
    
    controls(state: State): object {
      return state.renderObjs.controls();
    },
    
    tbControls(state: State): object {
      return state.renderObjs.tbControls();
    },
    
    _destructor() {
      this.pauseAnimation();
      this.graphData({ nodes: [], links: [] });
    }
  },
  
  stateInit: ({ controlType, rendererConfig, extraRenderers }: ConfigOptions = {}) => {
    const forceGraph = new ThreeForceGraph();
    return {
      forceGraph,
      renderObjs: (ThreeRenderObjects as any)({
        controlType,
        rendererConfig,
        extraRenderers
      })
        .objects([forceGraph])
        .lights([
          new three.AmbientLight(0xcccccc, Math.PI),
          new three.DirectionalLight(0xffffff, 0.6 * Math.PI)
        ])
    };
  },
  
  update() {},
  
  init: function(domNode: HTMLElement, state: State) {
    // Wipe DOM
    domNode.innerHTML = '';
    
    // Add relative container
    domNode.appendChild(state.container = document.createElement('div'));
    state.container.style.position = 'relative';
    
    // Add renderObjs
    const roDomNode = document.createElement('div');
    state.container.appendChild(roDomNode);
    state.renderObjs(roDomNode);
    
    const camera = state.renderObjs.camera();
    const renderer = state.renderObjs.renderer();
    const controls = state.renderObjs.controls();
    controls.enabled = !!state.enableNavigationControls;
    state.lastSetCameraZ = camera.position.z;
    
    // Add user interaction tracking for idle detection
    const domElement = renderer.domElement;
    const setUserInteracting = (interacting: boolean) => {
      if (state._idleState) {
        state._idleState.userInteracting = interacting;
        if (interacting) {
          state._idleState.isIdle = false;
          state._idleState.consecutiveIdleFrames = 0;
          // If currently using timer, cancel it and switch to requestAnimationFrame
          if (state._idleState.isIdle && state.animationFrameRequestId !== null) {
            clearTimeout(state.animationFrameRequestId);
            state.animationFrameRequestId = null;
            // Restart animation cycle with requestAnimationFrame
            (this as any)._animationCycle();
          }
        }
      }
    };
    
    // Mouse events
    domElement.addEventListener('mousedown', () => setUserInteracting(true));
    domElement.addEventListener('mouseup', () => setUserInteracting(false));
    domElement.addEventListener('mousemove', () => {
      setUserInteracting(true);
      // Reset interaction state after a short delay
      if (state._idleState && state._idleState.interactionTimeout) {
        clearTimeout(state._idleState.interactionTimeout);
      }
      if (state._idleState) {
        state._idleState.interactionTimeout = setTimeout(() => setUserInteracting(false), 100);
      }
    });
    
    // Touch events
    domElement.addEventListener('touchstart', () => setUserInteracting(true));
    domElement.addEventListener('touchend', () => setUserInteracting(false));
    domElement.addEventListener('touchmove', () => setUserInteracting(true));
    
    // Wheel event
    domElement.addEventListener('wheel', () => {
      setUserInteracting(true);
      if (state._idleState && state._idleState.wheelTimeout) {
        clearTimeout(state._idleState.wheelTimeout);
      }
      if (state._idleState) {
        state._idleState.wheelTimeout = setTimeout(() => setUserInteracting(false), 300);
      }
    });
    
    // Add info space
    const infoElem = document.createElement('div');
    state.container.appendChild(infoElem);
    infoElem.className = 'graph-info-msg';
    infoElem.textContent = '';
    
    // config forcegraph
    state.forceGraph
      .onLoading(() => {
        infoElem.textContent = 'Loading...';
      })
      .onFinishLoading(() => {
        infoElem.textContent = '';
      })
      .onUpdate(() => {
        // sync graph data structures
        state.graphData = state.forceGraph.graphData();
        
        // re-aim camera, if still in default position (not user modified)
        if (camera.position.x === 0 && camera.position.y === 0 && 
            camera.position.z === state.lastSetCameraZ && state.graphData.nodes.length) {
          camera.lookAt(state.forceGraph.position);
          state.lastSetCameraZ = camera.position.z = Math.cbrt(state.graphData.nodes.length) * CAMERA_DISTANCE2NODES_FACTOR;
        }
      })
      .onFinishUpdate(() => {
        // Setup node drag interaction
        if (state._dragControls) {
          const curNodeDrag = state.graphData.nodes.find((node: any) => 
            node.__initialFixedPos && !node.__disposeControlsAfterDrag
          );
          if (curNodeDrag) {
            (curNodeDrag as any).__disposeControlsAfterDrag = true;
          } else {
            state._dragControls.dispose();
          }
          state._dragControls = undefined;
        }
        
        if (state.enableNodeDrag && state.enablePointerInteraction && state.forceEngine === 'd3') {
          const dragControls = state._dragControls = new DragControls(
            state.graphData.nodes
              .map((node: any) => node.__threeObj)
              .filter((obj: any) => obj),
            camera,
            renderer.domElement
          );
          
          dragControls.addEventListener('dragstart', (event: any) => {
            const nodeObj = getGraphObj(event.object);
            if (!nodeObj) return;
            controls.enabled = false;
            
            if (state._idleState) {
              state._idleState.userInteracting = true;
              state._idleState.isIdle = false;
              state._idleState.consecutiveIdleFrames = 0;
            }
            
            event.object.__initialPos = event.object.position.clone();
            event.object.__prevPos = event.object.position.clone();
            const node: any = nodeObj.__data;
            !node.__initialFixedPos && (node.__initialFixedPos = {
              fx: node.fx,
              fy: node.fy,
              fz: node.fz
            });
            !node.__initialPos && (node.__initialPos = {
              x: node.x,
              y: node.y,
              z: node.z
            });
            
            ['x', 'y', 'z'].forEach(c => node[`f${c}`] = node[c]);
            
            renderer.domElement.classList.add('grabbable');
          });
          
          dragControls.addEventListener('drag', (event: any) => {
            const nodeObj = getGraphObj(event.object);
            if (!nodeObj) return;
            
            if (!event.object.hasOwnProperty('__graphObjType')) {
              const initPos = event.object.__initialPos;
              const prevPos = event.object.__prevPos;
              const newPos = event.object.position;
              nodeObj.position.add(newPos.clone().sub(prevPos));
              prevPos.copy(newPos);
              newPos.copy(initPos);
            }
            
            const node: any = nodeObj.__data;
            const newPos = nodeObj.position;
            const translate = {
              x: newPos.x - node.x,
              y: newPos.y - node.y,
              z: newPos.z - node.z
            };
            
            ['x', 'y', 'z'].forEach(c => node[`f${c}`] = node[c] = (newPos as any)[c]);
            state.forceGraph.d3AlphaTarget(0.3).resetCountdown();
            
            node.__dragged = true;
            state.onNodeDrag(node, translate);
          });
          
          dragControls.addEventListener('dragend', (event: any) => {
            const nodeObj = getGraphObj(event.object);
            if (!nodeObj) return;
            
            if (state._idleState) {
              state._idleState.userInteracting = false;
            }
            delete event.object.__initialPos;
            delete event.object.__prevPos;
            const node: any = nodeObj.__data;
            
            if (node.__disposeControlsAfterDrag) {
              dragControls.dispose();
              delete node.__disposeControlsAfterDrag;
            }
            
            const initFixedPos = node.__initialFixedPos;
            const initPos = node.__initialPos;
            const translate = {
              x: initPos.x - node.x,
              y: initPos.y - node.y,
              z: initPos.z - node.z
            };
            
            if (initFixedPos) {
              ['x', 'y', 'z'].forEach(c => {
                const fc = `f${c}`;
                if (initFixedPos[fc] === undefined) {
                  delete node[fc];
                }
              });
              delete node.__initialFixedPos;
              delete node.__initialPos;
              if (node.__dragged) {
                delete node.__dragged;
                state.onNodeDragEnd(node, translate);
              }
            }
            
            state.forceGraph.d3AlphaTarget(0).resetCountdown();
            
            if (state.enableNavigationControls) {
              controls.enabled = true;
              controls.domElement && controls.domElement.ownerDocument && 
                controls.domElement.ownerDocument.dispatchEvent(
                  new PointerEvent('pointerup', { pointerType: 'touch' })
                );
            }
            
            renderer.domElement.classList.remove('grabbable');
          });
        }
      });
    
    // config renderObjs
    if (three.REVISION < 155) {
      (state.renderObjs.renderer() as any).useLegacyLights = false;
    }
    
    state.renderObjs
      .hoverOrderComparator((a: Object3D, b: Object3D) => {
        const aObj = getGraphObj(a);
        if (!aObj) return 1;
        const bObj = getGraphObj(b);
        if (!bObj) return -1;
        
        const isNode = (o: GraphObject) => o.__graphObjType === 'node';
        return (isNode(bObj) ? 1 : 0) - (isNode(aObj) ? 1 : 0);
      })
      .tooltipContent((obj: Object3D): string => {
        const graphObj = getGraphObj(obj);
        return graphObj ? String(accessorFn(state[`${graphObj.__graphObjType}Label` as keyof State] as any)(graphObj.__data) || '') : '';
      })
      .hoverDuringDrag(false)
      .onHover((obj: Object3D | null) => {
        const hoverObj = obj ? getGraphObj(obj) : null;
        if (hoverObj !== state.hoverObj) {
          const prevObjType = state.hoverObj ? state.hoverObj.__graphObjType : null;
          const prevObjData = state.hoverObj ? state.hoverObj.__data : null;
          const objType = hoverObj ? hoverObj.__graphObjType : null;
          const objData = hoverObj ? hoverObj.__data : null;
          
          if (prevObjType && prevObjType !== objType) {
            // Hover out
            const fn = state[`on${prevObjType === 'node' ? 'Node' : 'Link'}Hover` as keyof State] as any;
            if (typeof fn === 'function') fn(null, prevObjData);
          }
          
          if (objType) {
            // Hover in
            const fn = state[`on${objType === 'node' ? 'Node' : 'Link'}Hover` as keyof State] as any;
            if (typeof fn === 'function') fn(objData, prevObjType === objType ? prevObjData : null);
          }
          
          // set pointer if hovered object is clickable
          const clickFn = objType ? state[`on${objType === 'node' ? 'Node' : 'Link'}Click` as keyof State] : state.onBackgroundClick;
          renderer.domElement.classList[hoverObj && clickFn || !hoverObj && state.onBackgroundClick ? 'add' : 'remove']('clickable');
          state.hoverObj = hoverObj;
        }
      })
      .clickAfterDrag(false)
      .onClick((obj: Object3D | null, ev: MouseEvent) => {
        const graphObj = obj ? getGraphObj(obj) : null;
        if (graphObj) {
          const fn = state[`on${graphObj.__graphObjType === 'node' ? 'Node' : 'Link'}Click` as keyof State] as any;
          if (typeof fn === 'function') fn(graphObj.__data, ev);
        } else {
          state.onBackgroundClick && state.onBackgroundClick(ev);
        }
      })
      .onRightClick((obj: Object3D | null, ev: MouseEvent) => {
        const graphObj = obj ? getGraphObj(obj) : null;
        if (graphObj) {
          const fn = state[`on${graphObj.__graphObjType === 'node' ? 'Node' : 'Link'}RightClick` as keyof State] as any;
          if (typeof fn === 'function') fn(graphObj.__data, ev);
        } else {
          state.onBackgroundRightClick && state.onBackgroundRightClick(ev);
        }
      });
    
    // Kick-off renderer
    this._animationCycle();
  }
}) as any;

// Export the Kapsule component directly
// The original JS version exported _3dForceGraph which was the direct result of Kapsule({...})
export default ForceGraph3DComponent;
export type { ConfigOptions, Coords, Label, ObjAccessor };
