# Hyperdimensional Node Positioning

This feature allows you to position nodes in multiple spatial systems beyond the traditional 3D X, Y, Z coordinates.

## Concepts

### Spatial Systems
A spatial system is a named collection of axes that represent a particular coordinate space. Examples:
- **Time**: Contains axes like Year, Month, Day
- **Geography**: Contains axes like Latitude, Longitude, Altitude
- **Concepts**: Contains axes like Complexity, Importance, Relevance

### Axes
An axis belongs to a spatial system and represents a single dimension within that system. Axes can have:
- A name (e.g., "Year", "Latitude")
- Optional description
- Optional bounds (min/max values)

### Axis Mapping
The 3D graph can only display three dimensions at a time. You can map any axis from any spatial system to the graph's X, Y, or Z dimension.

## Usage

### 1. Open the Hyperdimension Panel
Click the 📐 button in the graph view to open the hyperdimension panel.

### 2. Create a Spatial System
1. Click "+ New System" 
2. Enter a name (e.g., "Time")
3. Optionally add a description
4. Click "Create"

### 3. Add Axes to a Spatial System
1. Click "+ Axis" next to the spatial system
2. Enter axis name (e.g., "Year")
3. Optionally set min/max bounds
4. Click "Create"

### 4. Map Axes to 3D Dimensions
Use the dropdowns at the top of the panel to select which axis should be displayed on each 3D dimension:
- X Axis: Select an axis or "None"
- Y Axis: Select an axis or "None"
- Z Axis: Select an axis or "None"

### 5. Position Nodes
1. Click on any node in the graph
2. Select "Edit positions" (📐) from the circular menu
3. Enter values for each axis
4. Leave blank or click 🔓 to unlock the node in that dimension
5. Click "Close" when done

## Example: Time-Based Layout

```yaml
---
hyperdimensions:
  spatialSystems:
    - id: time-system
      name: Time
      description: Temporal positioning
  axes:
    - id: year-axis
      spatialSystemId: time-system
      name: Year
      bounds:
        min: 2020
        max: 2030
    - id: month-axis
      spatialSystemId: time-system
      name: Month
      bounds:
        min: 1
        max: 12
    - id: importance-axis
      spatialSystemId: time-system
      name: Importance
      bounds:
        min: 0
        max: 10
  nodePositions:
    - nodeId: Project Start
      positions:
        - axisId: year-axis
          value: 2023
        - axisId: month-axis
          value: 6
        - axisId: importance-axis
          value: 10
  axisMapping:
    xAxis: year-axis
    yAxis: importance-axis
    zAxis: month-axis
---
```

## Advanced Features

### Partial Locking
Nodes can be locked in some dimensions while remaining free in others. For example:
- Lock a node's time position (Year) while allowing it to move freely in other dimensions
- Fix vertical position (Y) while allowing horizontal movement

### Multiple Coordinate Systems
You can define multiple spatial systems and switch between them by changing the axis mapping. This allows you to view your data from different perspectives without losing position information.

### Bounds Enforcement
When an axis has bounds defined, the UI will prevent entering values outside those bounds. This helps maintain data consistency.

## Tips

- Use meaningful names for spatial systems and axes
- Add descriptions to help remember what each system represents
- Consider which dimensions are most important for your current task when mapping axes
- Save your parameters (💾) after making changes to persist hyperdimension data