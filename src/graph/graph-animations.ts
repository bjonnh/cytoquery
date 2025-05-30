import * as THREE from 'three';

export interface AnimationState {
    nodeObjects: Map<string, THREE.Group>;
    isIdleRotationActive: boolean;
    rotationStartTime: number;
    rotationSpeed: number;
    idlePreventionInterval: number | null;
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
        
        // Allow the graph to return to normal idle detection
        if ((Graph as any)._idleState) {
            (Graph as any)._idleState.userInteracting = false;
        }
    }
}

export function updateNodeObjectTracking(
    nodeGroup: THREE.Group,
    nodeId: string,
    animationState: AnimationState,
    hasHalo: boolean
): void {
    if (hasHalo && (nodeGroup as any).__haloContainer) {
        animationState.nodeObjects.set(nodeId, nodeGroup);
    } else {
        animationState.nodeObjects.delete(nodeId);
    }
}