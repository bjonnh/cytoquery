# Obsidian CytoQuery

A 3D graph visualization plugin for Obsidian that visualizes your vault as an interactive graph.
It is aimed at exploring the connections between your notes in 3D with stuff like path finding, node locking, 
and some fancy dynamic visual effects (because that was fun to do).

### Demo

Try the interactive demo at: **https://bjonnh.github.io/cytoquery/**

It shows most of the plugin features with a random graph of 500 interconnected nodes.

### Story 

This is a totally vibe-coded project with https://www.anthropic.com/claude-code. Code quality is not awesome, but it 
allowed me to iterate really quickly. And it worked much better than I expected (using Opus if you wondered).

This is a toy project, it is not meant for production, I am not sure if I will make it a released plugin yet, but you
can install it with BRAT and play with it.

It is called CytoQuery because this started as a cytoscape.js project. I will more than likely reintegrate it at some
point, especially for the whole graph management part, path finding etc.

## Features

- **3D Graph Visualization**: Navigate your graph in three dimensions using force-directed layouts
- **Node Interactions**: Click nodes to access circular menus with options to open notes, lock positions, set path endpoints, and more
- **Path Finding**: Find and visualize one of the shortest paths between any two notes with directional or undirectional routing
- **Visual Effects**: Bloom post-processing, node halos, lock indicators, and restriction center effects
- **Parameter Controls**: Adjust force simulation, visual styling, and performance settings with live preview
- **Query Language**: Filter and style nodes using condition-action syntax
- **Node Locking**: Pin nodes in place and save their positions
- **Graph Restrictions**: Show only neighbors within a specified depth
- **Performance Features**: FPS limiting and idle rotation modes


## Installation

### Option 1: BRAT (Recommended)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian Community Plugins
2. Open BRAT settings and click "Add Beta Plugin"
3. Enter this repository URL: `bjonnh/obsidian-cytoquery`
4. Click "Add Plugin" and enable CytoQuery in your plugin settings

### Option 2: Manual Installation

1. Download the latest release from the [releases page](https://github.com/bjonnh/obsidian-cytoquery/releases)
2. Extract the files to your vault's `.obsidian/plugins/cytoquery/` directory
3. Enable the plugin in Obsidian's settings

## Usage

### Basic 3D Graph

Create a 3D graph of your vault by adding a code block:

````markdown
```cytoquery
```
````

### Advanced Configuration

Customize the graph appearance and behavior with parameters:

````markdown
```cytoquery
nodeStyle.size: 6
nodeStyle.opacity: 0.8
linkStyle.opacity: 0.3
bloom.strength: 5.0
force.alphaDecay: 0.02
```
````

### Query Language

Filter and style nodes using condition-action rules:

````markdown
```cytoquery
default => color(#4a4a4a)
default => shape(sphere)
tag("important") => color(red) 
tag("important") => shape(cube)
tag("important") => size(2)
link_to("index") => color(gold)
link_to("index") => shape(dodecahedron)
```
````

#### Available Conditions

- `default` - Matches all nodes
- `tag("tagname")` - Matches nodes with specific tags
- `link_to("text")` - Matches nodes linking to pages containing text
- `link_from("text")` - Matches nodes linked from pages containing text
- `link("text")` - Matches nodes with bidirectional links

#### Available Actions
- `color(value)` - Set node color (names or hex values)
- `shape(value)` - Set node shape (sphere, cube, cylinder, cone, etc.)
- `material(value)` - Set material type (default, glass, metal, plastic)
- `size(value)` - Set size multiplier

### Interactive Controls

- **Left Click**: Select nodes and open circular menus
- **Right Drag**: Rotate the camera
- **Scroll**: Zoom in/out  
- **Middle Drag**: Pan the view
- **Circular Menu Options**:
  - Open note in new tab
  - Lock/unlock node position
  - Set as path start/end point
  - Center camera on node
  - Restrict graph to neighbors
  - Remove restrictions

### Parameter Categories

#### Force Simulation
- `force.alphaDecay`: Simulation cooling rate
- `force.velocityDecay`: Node movement damping
- `force.alphaMin`: Minimum simulation energy

#### Visual Styling
- `nodeStyle.size`: Base node size
- `nodeStyle.opacity`: Node transparency
- `linkStyle.opacity`: Link transparency
- `linkStyle.width`: Link thickness
- `bloom.strength`: Glow effect intensity

#### Performance
- `performance.warmupTicks`: Initial simulation steps
- `performance.cooldownTicks`: Maximum simulation steps
- `performance.cooldownTime`: Auto-pause delay

## Development

### Setup
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

## Projects used

- [Obsidian](https://obsidian.md) - The knowledge management platform this plugin extends
- [Three.js](https://threejs.org) - 3D graphics library for WebGL rendering
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) - Base force-directed graph library (heavily patched and integrated)
- [Vitest](https://vitest.dev) - Testing framework for unit tests

## License

MIT License - see LICENSE file for details.
