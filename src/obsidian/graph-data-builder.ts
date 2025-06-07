import { App, CachedMetadata, getLinkpath, TFile, FrontmatterLinkCache } from 'obsidian';
import { NodeSet, EdgeSet } from '../utils/index';

export function buildGraphData(
    app: App,
    publicMode: boolean,
    generateRandomStringFromSeed: (input: string) => string
): { 
    nodeSet: NodeSet, 
    edgeSet: EdgeSet, 
    metadataMap: Map<string, CachedMetadata> 
} {
    const files = app.vault.getMarkdownFiles();
    const nodeSet = new NodeSet();
    const edgeSet = new EdgeSet();
    const metadataMap = new Map<string, CachedMetadata>();
    const tagSet = new Set<string>();

    // Process all files
    for (let file of files) {
        // Add file as node - use basename as label
        nodeSet.add({
            id: file.path,
            label: file.basename
        });

        let meta: CachedMetadata | null = app.metadataCache.getFileCache(file);
        if (meta) {
            // Store metadata for query processing
            metadataMap.set(file.path, meta);

            // Process tags from content
            if (meta.tags) {
                for (let tagCache of meta.tags) {
                    const tag = tagCache.tag;
                    const normalizedTag = tag.startsWith('#') ? tag.substring(1) : tag;
                    const tagNodeId = `tag:${normalizedTag}`;
                    
                    // Add tag as node if not already added
                    if (!tagSet.has(normalizedTag)) {
                        tagSet.add(normalizedTag);
                        nodeSet.add({
                            id: tagNodeId,
                            label: `#${normalizedTag}`
                        });
                    }
                    
                    // Create edge from file to tag
                    edgeSet.addSourceTarget(file.path, tagNodeId, 'default');
                }
            }

            // Process tags from frontmatter
            if (meta.frontmatter?.tags) {
                const frontmatterTags = Array.isArray(meta.frontmatter.tags) 
                    ? meta.frontmatter.tags 
                    : [meta.frontmatter.tags];
                
                for (let tag of frontmatterTags) {
                    if (tag && typeof tag === 'string') {
                        const normalizedTag = tag.startsWith('#') ? tag.substring(1) : tag;
                        const tagNodeId = `tag:${normalizedTag}`;
                        
                        // Add tag as node if not already added
                        if (!tagSet.has(normalizedTag)) {
                            tagSet.add(normalizedTag);
                            nodeSet.add({
                                id: tagNodeId,
                                label: `#${normalizedTag}`
                            });
                        }
                        
                        // Create edge from file to tag
                        edgeSet.addSourceTarget(file.path, tagNodeId, 'default');
                    }
                }
            }

            // Process regular content links
            if (meta.links) {
                for (let link of meta.links) {
                    let linkPath = getLinkpath(link.link);
                    let target: TFile | null = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

                    if (target) {
                        // Add target file as node with basename as label
                        nodeSet.add({
                            id: target.path,
                            label: target.basename
                        });
                        // Create an edge between file and target
                        if (file.path != target.path)
                            edgeSet.addSourceTarget(file.path, target.path, 'default');

                        // Get and store target metadata if not already stored
                        if (!metadataMap.has(target.path)) {
                            const targetMeta = app.metadataCache.getFileCache(target);
                            if (targetMeta) {
                                metadataMap.set(target.path, targetMeta);
                            }
                        }
                    } else {
                        // For non-existent links, use the raw link text as label
                        nodeSet.add({
                            id: link.link,
                            label: link.link
                        });
                        // Create an edge between file and link
                        edgeSet.addSourceTarget(file.path, link.link, 'default');
                    }
                }
            }

            // Process frontmatter links (added in v1.4)
            if (meta.frontmatterLinks) {
                for (let link of meta.frontmatterLinks) {
                    let linkPath = getLinkpath(link.link);
                    let target: TFile | null = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

                    if (target) {
                        // Add target file as node with basename as label
                        nodeSet.add({
                            id: target.path,
                            label: target.basename
                        });
                        // Create an edge between file and target
                        if (file.path != target.path)
                            edgeSet.addSourceTarget(file.path, target.path, 'property', (link as FrontmatterLinkCache).key);

                        // Get and store target metadata if not already stored
                        if (!metadataMap.has(target.path)) {
                            const targetMeta = app.metadataCache.getFileCache(target);
                            if (targetMeta) {
                                metadataMap.set(target.path, targetMeta);
                            }
                        }
                    } else {
                        // For non-existent links, use the raw link text as label
                        nodeSet.add({
                            id: link.link,
                            label: link.link
                        });
                        // Create an edge between file and link
                        edgeSet.addSourceTarget(file.path, link.link, 'property', (link as FrontmatterLinkCache).key);
                    }
                }
            }
        }
    }

    return { nodeSet, edgeSet, metadataMap };
}
