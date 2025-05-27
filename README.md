# Obsidian CytoQuery Plugin

This is a graph visualization plugin for Obsidian (https://obsidian.md).

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This plugin provides graph visualization capabilities for your Obsidian vault:
- 2D graph visualization using Cytoscape.js
- 3D graph visualization using 3d-force-graph
- Visualizes connections between your notes
- Automatically builds the graph from your vault's files and links

## First time developing plugins?

Quick starting guide for new plugin devs:

- Check if [someone already developed a plugin for what you want](https://obsidian.md/plugins)! There might be an existing plugin similar enough that you can partner up with.
- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

## Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

## How to use

### Installation
- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

### Using the plugin
Once the plugin is installed and enabled, you can use it in your Markdown notes:

#### 2D Graph Visualization
To create a 2D graph visualization using Cytoscape.js, add a code block with the `cytoquery` language:

```cytoquery
```

This will display a 2D graph of your vault's files and their connections.

#### 3D Graph Visualization
To create a 3D graph visualization using 3d-force-graph, add a code block with the `3d-force-graph` language:

```3d-force-graph
```

This will display an interactive 3D graph of your vault's files and their connections. You can:
- Rotate the graph by dragging
- Zoom in/out using the mouse wheel
- Click on nodes to open a popup with options:
  - Open the note in a new tab (creates new notes for non-existent links)
  - Restrict the graph to show only the node and its neighbors within a specified depth
  - Remove all restrictions to show the full graph again

#### Query Language
Both visualization types support a simple query language that allows you to customize the appearance of nodes based on conditions. You can add queries inside the code blocks:

```cytoquery
link_to("daily") => color(red)
tag("note") => color(blue)
```

The query language syntax follows this pattern:
```
condition(value) => action(value)
```

Currently supported conditions:
- `default` - Matches all nodes (use this to set default properties for all nodes)
- `link_to("text")` - Matches nodes that link to pages containing the specified text
- `link_from("text")` - Matches nodes that are linked from pages containing the specified text
- `link("text")` - Matches nodes that either link to or are linked from pages containing the specified text
- `tag("tagname")` - Matches nodes that have the specified tag

Currently supported actions:
- `color(value)` - Sets the color of matching nodes (use color names like red, blue, green, or hex values like #FF0000)
- `shape(value)` - Sets the shape of matching nodes (3D graph only)
- `material(value)` or `texture(value)` - Sets the material/texture of matching nodes (3D graph only)
- `size(value)` - Sets the size multiplier for matching nodes (3D graph only, e.g., 0.5 for half size, 2 for double size)

Available shapes (3D graph only):
- `sphere` (default)
- `cube`
- `cylinder`
- `cone`
- `torus`
- `tetrahedron`
- `octahedron`
- `dodecahedron`
- `icosahedron`

Available materials/textures (3D graph only):
- `default` - Basic Lambert material
- `glass` - Transparent with refraction
- `metal` - Metallic with reflections
- `plastic` - Shiny plastic appearance

Examples:

```cytoquery
link_to("project") => color(green)
tag("important") => color(red)
link_from("index") => color("#FF00FF")
```

```3d-force-graph
default => shape(sphere)
default => material(plastic)
default => color("#4a4a4a")
default => size(1)
link_to("daily") => color(orange)
tag("todo") => color(purple)
tag("important") => shape(cube)
tag("important") => material(metal)
tag("important") => size(2)
link_to("index") => shape(dodecahedron)
link_to("index") => texture(glass)
link_to("index") => size(1.5)
tag("archived") => shape(cone)
tag("archived") => material(glass)
tag("archived") => color("#808080")
tag("archived") => size(0.5)
link("daily") => shape(cylinder)
link("daily") => material(plastic)
tag("personal") => size(0.7)
tag("core") => size(3)
```

Each line is a separate rule, and multiple rules can be applied to the same visualization. For nodes that match multiple rules, all matching actions will be applied. The `default` condition is useful for setting baseline properties for all nodes, which can then be overridden by more specific conditions.

#### Public Mode
The plugin includes a "Public Mode" feature that allows you to hide node names in your graph visualizations. This is useful when you want to share screenshots or videos of your graph without revealing the actual names of your notes.

When Public Mode is enabled, node labels are replaced with their internal IDs, preserving the structure of your graph while anonymizing the content.

To enable Public Mode:
1. Go to Settings > CytoQuery
2. Toggle on the "Public Mode" option

This setting affects both 2D and 3D graph visualizations. You can toggle it on when sharing your graphs publicly and off when using them for your own reference.

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code. 
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

## Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
