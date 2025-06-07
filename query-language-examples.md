# Query Language Examples

## Tag Support

### Tag Nodes vs Tagged Pages
The query language now distinguishes between tag nodes and pages that have tags:

- `tag("tagname")` - Matches the tag node itself (displayed as #tagname in the graph)
- `tagged("tagname")` - Matches all pages/notes that have this tag

Examples:
```
# Make the #important tag node gold and larger
tag("important") => color("gold"), size(3)

# Make all pages tagged with #important red
tagged("important") => color("red")
```

### Node Name Selector
You can now style specific nodes by their exact name:
```
# Style a specific note
"My Important Note" => color("blue"), size(2)

# Style a specific tag node
"#project" => color("green"), shape("cube")

# Multiple specific nodes
"Note 1", "Note 2" => color("purple")
```

## New Features

### 1. Comma-separated conditions
Instead of writing multiple rules:
```
tagged("important") => color("red")
tagged("urgent") => color("red")
```

You can now write:
```
tagged("important"), tagged("urgent") => color("red")
```

### 2. Comma-separated actions
Instead of writing:
```
tagged("special") => color("blue")
tagged("special") => size(3)
```

You can now write:
```
tagged("special") => color("blue"), size(3)
```

### 3. Named parameters
Define reusable action sets:
```
:highlight = color("yellow"), size(4)
:bluethings = color("blue"), shape("sphere")

tagged("important") => :highlight
link_to("ocean") => :bluethings
```

### 4. Complex combinations
You can combine all features:
```
:fancy = color("#FFD700"), shape("dodecahedron"), material("metal"), size(8)
tagged("treasure"), link_to("gold") => :fancy
```

## Complete Example
```
# Define named parameters
:highlight = color("yellow"), size(5)
:error = color("red"), shape("octahedron"), size(3)
:subtle = color("#808080"), size(0.5)

# Apply default styling
default => color("#CCCCCC")

# Style tag nodes themselves
tag("important") => color("gold"), size(4)
tag("project") => color("purple"), shape("cube")

# Style pages that have tags
tagged("important") => :highlight
tagged("error"), tagged("bug") => :error

# Style specific nodes by name
"Home" => color("green"), size(3)
"#todo" => color("orange"), shape("octahedron")

# Combine conditions and actions
link_to("index"), link_from("hub") => color("green"), shape("cube")

# Mix named and inline actions
tagged("archived") => :subtle, material("plastic")
```

## Edge Styling

### Edge Query Syntax
The query language now supports styling edges (links) based on their properties:

- `edge(default)` - Matches regular links (not from frontmatter properties)
- `edge("propertyname")` - Matches links from a specific frontmatter property (case-insensitive)
- `edge(*)` - Matches all edges (catch-all for both default and property edges)

### Edge Methods
You can filter edges further using methods:

- `.includes("value")` - Matches edges where source or target contains the value
- `.not_includes("value")` - Matches edges where neither source nor target contains the value

### Edge Actions
Available actions for edges:

- `color("color")` - Sets the edge color
- `width(number)` - Sets the edge width (0.1 to 10)
- `opacity(number)` - Sets the edge opacity (0 to 1)

### Notes
- Property matching is **case-insensitive**: `edge("Category")` will match frontmatter properties named "category", "Category", or "CATEGORY"
- The `edge(*)` syntax is useful for applying base styles to all edges

### Examples

```
# Style all edges (catch-all)
edge(*) => opacity(0.3)

# Style all default links
edge(default) => color("#999999")

# Style links from a specific frontmatter property (case-insensitive)
edge("related") => color("#00FF00"), width(2)
edge("Category") => color("#0099FF")  # Matches category, Category, CATEGORY, etc.

# Style links from 'references' property that include 'main'
edge("references").includes("main") => color("#FF0000"), width(3), opacity(0.8)

# Style all edges that include certain text
edge(*).includes("important") => color("#FFD700"), width(3)

# Style default links that don't include 'test'
edge(default).not_includes("test") => opacity(0.5)

# Combine multiple edge conditions
edge("important"), edge("critical") => color("#FF0000"), width(4)

# Complete example with nodes and edges
default => color("#CCCCCC")
tagged("important") => color("yellow"), size(3)

# Base style for all edges
edge(*) => opacity(0.2)

# Override for specific edge types
edge(default) => color("#666666")
edge("related") => color("#00FF00"), width(2)
edge("references").includes("index") => color("#FF0000"), width(3), opacity(0.8)
```
