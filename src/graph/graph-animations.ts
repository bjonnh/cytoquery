import * as THREE from 'three';
import { AxisIndicatorSystem } from './axis-indicator';

export interface AnimationState {
    nodeObjects: Map<string, THREE.Group>;
    isIdleRotationActive: boolean;
    rotationStartTime: number;
    rotationSpeed: number;
    idlePreventionInterval: number | null;
    isFPSLimiterDisabled: boolean;
    fpsPreventionInterval: number | null;
    axisIndicatorSystem?: AxisIndicatorSystem;
}

export function createAnimationLoop(
    Graph: any,
    animationState: AnimationState
): void {
    const animate = () => {
        const time = Date.now() * 0.003;
        
        // Update halo animations for tracked nodes
        animationState.nodeObjects.forEach((nodeGroup, nodeId) => {
            const haloContainer = (nodeGroup as any).__haloContainer;
            const haloMesh1 = (nodeGroup as any).__haloMesh1;
            const haloMesh2 = (nodeGroup as any).__haloMesh2;
            
            if (haloContainer && haloMesh1 && haloMesh2) {
                // Pulsing scale effect for the entire container
                const pulseScale = 1.0 + Math.sin(time + nodeId.length) * 0.1;
                haloContainer.scale.setScalar(pulseScale);
                
                // Rotating animations on perpendicular axes for clean intersecting effect
                // First ring rotates around Y-axis (horizontal spin)
                haloMesh1.rotation.y = time * 1.2 + nodeId.length;
                
                // Second ring rotates around X-axis (vertical spin) - creates a gyroscope effect
                haloMesh2.rotation.x = time * -0.8 + nodeId.length * 0.5;
                
                // Add slight wobble to the container for extra dynamism
                haloContainer.rotation.z = Math.sin(time * 0.3 + nodeId.length) * 0.1;
                
                // Breathing opacity effect (synchronized for both rings)
                const pulseOpacity = 0.3 + Math.sin(time * 1.5 + nodeId.length) * 0.2;
                haloMesh1.material.opacity = pulseOpacity;
                haloMesh2.material.opacity = pulseOpacity;
            }
            
            // Animate lock indicator arrows
            const lockArrows = (nodeGroup as any).__lockArrows;
            const baseArrowDistance = (nodeGroup as any).__baseArrowDistance;
            
            if (lockArrows && baseArrowDistance) {
                // Create a back-and-forth motion along each arrow's axis
                const oscillation = Math.sin(time * 2) * 0.3; // Oscillate 30% of base distance
                const distance = baseArrowDistance * (1 + oscillation);
                
                // Update positions for each arrow
                lockArrows[0].position.y = distance;  // Top arrow
                lockArrows[1].position.y = -distance; // Bottom arrow
                lockArrows[2].position.x = distance;  // Right arrow
                lockArrows[3].position.x = -distance; // Left arrow
            }
            
            // Animate restriction center pulse effect
            const pulseContainer = (nodeGroup as any).__pulseContainer;
            const pulseSphere = (nodeGroup as any).__pulseSphere;
            const glowSphere = (nodeGroup as any).__glowSphere;
            
            if (pulseContainer && pulseSphere && glowSphere) {
                // Create a breathing/pulsing effect
                const breathScale = 1.0 + Math.sin(time * 0.5 + nodeId.length) * 0.1;
                pulseContainer.scale.setScalar(breathScale);
                
                // Animate the opacity to create color pulsing
                const pulseOpacity = 0.2 + Math.sin(time * 1.0) * 0.15;
                pulseSphere.material.opacity = pulseOpacity;
                
                // Animate the inner glow
                const glowOpacity = 0.1 + Math.sin(time * 1.2 + Math.PI/2) * 0.1;
                glowSphere.material.opacity = glowOpacity;
                
                // Subtle color shift between purple and pink
                const colorPhase = (Math.sin(time * 0.3) + 1) * 0.5;
                const r = 0.58 + colorPhase * 0.42; // 0.58 to 1.0
                const g = 0.0 + colorPhase * 0.63;  // 0.0 to 0.63
                const b = 0.83 + colorPhase * 0.17; // 0.83 to 1.0
                pulseSphere.material.color.setRGB(r, g, b);
                
                // Update transmission for shimmer effect
                pulseSphere.material.transmission = 0.7 + Math.sin(time * 0.8) * 0.2;
            }
        });
        
        // Handle idle rotation if active
        if (animationState.isIdleRotationActive) {
            
            const currentTime = Date.now();
            const elapsed = currentTime - animationState.rotationStartTime;
            
            // Calculate rotation angle based on elapsed time (rotationSpeed is in degrees per second)
            const rotationAngle = (elapsed / 1000) * animationState.rotationSpeed * (Math.PI / 180); // Convert to radians
            
            // Get current camera position and the graph center
            const cameraPos = Graph.cameraPosition();
            
            // Calculate the center of the graph (average of all node positions)
            const nodes = Graph.graphData().nodes;
            let centerX = 0, centerY = 0, centerZ = 0;
            if (nodes.length > 0) {
                nodes.forEach((node: any) => {
                    centerX += node.x || 0;
                    centerY += node.y || 0;
                    centerZ += node.z || 0;
                });
                centerX /= nodes.length;
                centerY /= nodes.length;
                centerZ /= nodes.length;
            }
            
            // Calculate distance from camera to center
            const dx = cameraPos.x - centerX;
            const dy = cameraPos.y - centerY;
            const dz = cameraPos.z - centerZ;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Calculate current angle in XZ plane (around Y-axis)
            const currentAngle = Math.atan2(dz, dx);
            
            // Apply rotation to get new angle
            const newAngle = currentAngle + rotationAngle;
            
            // Calculate new camera position maintaining distance and Y position
            const newCameraPos = {
                x: centerX + distance * Math.cos(newAngle) * Math.cos(Math.asin(dy / distance)),
                y: cameraPos.y, // Keep Y position constant for horizontal rotation
                z: centerZ + distance * Math.sin(newAngle) * Math.cos(Math.asin(dy / distance))
            };
            
            // Update camera position to orbit around center
            Graph.cameraPosition(
                newCameraPos,
                { x: centerX, y: centerY, z: centerZ }, // Look at center
                0 // No animation duration for smooth continuous rotation
            );
            
            // Reset rotation start time to current time for next frame
            animationState.rotationStartTime = currentTime;
        }
        
        // Update axis indicator if available
        if (animationState.axisIndicatorSystem && Graph.camera) {
            const { updateAxisIndicator } = require('./axis-indicator');
            updateAxisIndicator(animationState.axisIndicatorSystem, Graph.camera());
        }
        
        requestAnimationFrame(animate);
    };
    animate();
}

export function toggleIdleRotation(
    Graph: any,
    animationState: AnimationState,
    active: boolean
): void {
    animationState.isIdleRotationActive = active;
    
    if (active) {
        animationState.rotationStartTime = Date.now();
        
        // Pause and immediately resume to force requestAnimationFrame mode
        Graph.pauseAnimation();
        Graph.resumeAnimation();
        
        // Set up an interval to simulate user interaction
        animationState.idlePreventionInterval = window.setInterval(() => {
            if (animationState.isIdleRotationActive) {
                // Simulate a mouse move event on the renderer to trigger user interaction
                const renderer = Graph.renderer();
                if (renderer && renderer.domElement) {
                    const event = new MouseEvent('mousemove', {
                        bubbles: true,
                        cancelable: true,
                        clientX: window.innerWidth / 2,
                        clientY: window.innerHeight / 2
                    });
                    renderer.domElement.dispatchEvent(event);
                }
            }
        }, 100); // Trigger every 100ms to maintain interaction status
        
    } else {
        // Clear the interval
        if (animationState.idlePreventionInterval !== null) {
            window.clearInterval(animationState.idlePreventionInterval);
            animationState.idlePreventionInterval = null;
        }
    }
}

export function updateNodeObjectTracking(
    nodeGroup: THREE.Group,
    nodeId: string,
    animationState: AnimationState,
    hasHalo: boolean,
    hasLockIndicator: boolean = false
): void {
    if ((hasHalo && (nodeGroup as any).__haloContainer) || (hasLockIndicator && (nodeGroup as any).__lockArrows)) {
        animationState.nodeObjects.set(nodeId, nodeGroup);
    } else {
        animationState.nodeObjects.delete(nodeId);
    }
}

/**
 * Toggles the FPS limiter for the 3D force graph.
 * 
 * The 3d-force-graph library automatically optimizes performance by reducing frame rate to 1 FPS
 * when no user interaction is detected (idle mode). This is detected by monitoring mouse/wheel
 * events and node movement. After ~1 second of no activity, it switches to 1 FPS.
 * 
 * When the FPS limiter is disabled:
 * - We simulate continuous mouse movement events to trick the library into thinking the user
 *   is actively interacting with the graph
 * - This keeps the graph rendering at full 60 FPS continuously
 * - Useful for smooth idle rotation or when consistent frame rate is needed
 * 
 * When enabled (default):
 * - Normal behavior resumes - 60 FPS during interaction, 1 FPS when idle
 * - Better for performance and battery life
 */
export function toggleFPSLimiter(
    Graph: any,
    animationState: AnimationState,
    disabled: boolean
): void {
    animationState.isFPSLimiterDisabled = disabled;
    
    if (disabled) {
        // Clear any existing FPS prevention interval
        if (animationState.fpsPreventionInterval !== null) {
            window.clearInterval(animationState.fpsPreventionInterval);
        }
        
        // Simulate continuous user interaction by dispatching mouse events
        // This prevents the graph from entering idle mode (1 FPS)
        // Use a small delay to ensure renderer is ready
        setTimeout(() => {
            animationState.fpsPreventionInterval = window.setInterval(() => {
                if (animationState.isFPSLimiterDisabled) {
                    const renderer = Graph.renderer();
                    if (renderer && renderer.domElement) {
                        // Dispatch a mousemove event to keep the graph active
                        const event = new MouseEvent('mousemove', {
                            bubbles: true,
                            cancelable: true,
                            clientX: window.innerWidth / 2 + Math.random() * 2 - 1, // Slight variation to ensure event is processed
                            clientY: window.innerHeight / 2 + Math.random() * 2 - 1
                        });
                        renderer.domElement.dispatchEvent(event);
                    }
                }
            }, 90); // Trigger every 90ms to maintain active state
        }, 100);
        
    } else {
        // Clear the interval and allow normal idle detection
        if (animationState.fpsPreventionInterval !== null) {
            window.clearInterval(animationState.fpsPreventionInterval);
            animationState.fpsPreventionInterval = null;
        }
    }
}