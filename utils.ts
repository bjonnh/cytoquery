// Shared utility classes and interfaces for CytoQuery

export interface Node {
	id: string;
	label: string;
	color?: string; // Optional color property for styling
}

export interface Edge {
	id: string;
	source: string;
	target: string;
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

	addSourceTarget(source: string, target: string): void {
		const id = `edge-${this.counter++}`;
		this.edges.set(id, { id, source, target });
	}

	values(): Edge[] {
		return Array.from(this.edges.values());
	}

	get size(): number {
		return this.edges.size;
	}
}
