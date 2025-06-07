// Shared utility classes and interfaces for CytoQuery

export interface Node {
	id: string;
	label: string;
	color?: string; // Optional color property for styling
	shape?: 'sphere' | 'cube' | 'cylinder' | 'cone' | 'torus' | 'tetrahedron' | 'octahedron' | 'dodecahedron' | 'icosahedron';
	material?: 'default' | 'glass' | 'metal' | 'plastic';
	size?: number; // Optional size multiplier (e.g., 0.5 for half size, 2 for double size)
}

export interface Edge {
	id: string;
	source: string;
	target: string;
	type?: 'default' | 'property';
	property?: string;
	color?: string;
	width?: number;
	opacity?: number;
}

export class NodeSet {
	private nodes = new Map<string, Node>();

	add(node: Node): void {
		this.nodes.set(node.id, node);
	}

	has(id: string): boolean {
		return this.nodes.has(id);
	}

	values(): Node[] {
		return Array.from(this.nodes.values());
	}

	get size(): number {
		return this.nodes.size;
	}
}

export class EdgeSet {
	private edges = new Map<string, Edge>();
	private counter = 0;

	add(edge: Edge): void {
		this.edges.set(edge.id, edge);
	}

	addSourceTarget(source: string, target: string, type: 'default' | 'property' = 'default', property?: string): void {
		const id = `edge-${this.counter++}`;
		const edge = { id, source, target, type, property };
		this.edges.set(id, edge);
	}

	values(): Edge[] {
		return Array.from(this.edges.values());
	}

	get size(): number {
		return this.edges.size;
	}
}
