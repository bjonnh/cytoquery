import { HyperdimensionManager } from '../types/hyperdimensions';
import { getNode3DPosition } from './hyperdimension-manager';

export interface CoordinateDisplay {
    element: HTMLDivElement;
    update: (nodeId: string, x: number, y: number, z: number) => void;
    show: () => void;
    hide: () => void;
}

/**
 * Creates a coordinate display overlay that shows node position during dragging
 */
export function createCoordinateDisplay(
    container: HTMLElement,
    hyperdimensionManager?: HyperdimensionManager
): CoordinateDisplay {
    // Create the display element
    const element = document.createElement('div');
    element.className = 'coordinate-display';
    element.style.position = 'absolute';
    element.style.top = '10px';
    element.style.right = '10px';
    element.style.padding = '10px 15px';
    element.style.background = 'rgba(0, 0, 0, 0.8)';
    element.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    element.style.borderRadius = '8px';
    element.style.color = 'rgba(255, 255, 255, 0.9)';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '12px';
    element.style.lineHeight = '1.5';
    element.style.zIndex = '1000';
    element.style.display = 'none';
    element.style.pointerEvents = 'none';
    element.style.minWidth = '200px';
    container.appendChild(element);

    const update = (nodeId: string, x: number, y: number, z: number) => {
        let content = `<div style="margin-bottom: 5px; font-weight: bold; color: #88ff88">Dragging Node</div>`;
        
        // Show 3D coordinates
        content += `<div style="color: #ff8888">X: ${x.toFixed(2)}</div>`;
        content += `<div style="color: #88ff88">Y: ${y.toFixed(2)}</div>`;
        content += `<div style="color: #8888ff">Z: ${z.toFixed(2)}</div>`;
        
        // Show hyperdimension coordinates if available
        if (hyperdimensionManager) {
            const manager = hyperdimensionManager;
            const nodePosition = manager.nodePositions.get(nodeId);
            
            if (nodePosition && nodePosition.positions.size > 0) {
                content += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2)">`;
                content += `<div style="margin-bottom: 3px; color: #ffcc88">Hyperdimensions:</div>`;
                
                // Show mapped axes with their current values
                if (manager.axisMapping.xAxis) {
                    const axis = manager.axes.get(manager.axisMapping.xAxis);
                    if (axis) {
                        const value = nodePosition.positions.get(axis.id);
                        if (value !== undefined) {
                            content += `<div style="color: #ff8888">${axis.name}: ${value.toFixed(2)}</div>`;
                        }
                    }
                }
                
                if (manager.axisMapping.yAxis) {
                    const axis = manager.axes.get(manager.axisMapping.yAxis);
                    if (axis) {
                        const value = nodePosition.positions.get(axis.id);
                        if (value !== undefined) {
                            content += `<div style="color: #88ff88">${axis.name}: ${value.toFixed(2)}</div>`;
                        }
                    }
                }
                
                if (manager.axisMapping.zAxis) {
                    const axis = manager.axes.get(manager.axisMapping.zAxis);
                    if (axis) {
                        const value = nodePosition.positions.get(axis.id);
                        if (value !== undefined) {
                            content += `<div style="color: #8888ff">${axis.name}: ${value.toFixed(2)}</div>`;
                        }
                    }
                }
                
                // Show other hyperdimension values (not currently mapped to 3D)
                const unmappedAxes: string[] = [];
                nodePosition.positions.forEach((value, axisId) => {
                    if (axisId !== manager.axisMapping.xAxis && 
                        axisId !== manager.axisMapping.yAxis && 
                        axisId !== manager.axisMapping.zAxis) {
                        const axis = manager.axes.get(axisId);
                        if (axis) {
                            unmappedAxes.push(`${axis.name}: ${value.toFixed(2)}`);
                        }
                    }
                });
                
                if (unmappedAxes.length > 0) {
                    content += `<div style="margin-top: 5px; color: #cccccc">`;
                    content += unmappedAxes.join('<br>');
                    content += `</div>`;
                }
                
                content += `</div>`;
            }
        }
        
        element.innerHTML = content;
    };

    const show = () => {
        element.style.display = 'block';
    };

    const hide = () => {
        element.style.display = 'none';
    };

    return { element, update, show, hide };
}