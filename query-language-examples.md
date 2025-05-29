# Query Language Examples

## New Features

### 1. Comma-separated conditions
Instead of writing multiple rules:
```
tag("important") => color("red")
tag("urgent") => color("red")
```

You can now write:
```
tag("important"), tag("urgent") => color("red")
```

### 2. Comma-separated actions
Instead of writing:
```
tag("special") => color("blue")
tag("special") => size(3)
```

You can now write:
```
tag("special") => color("blue"), size(3)
```

### 3. Named parameters
Define reusable action sets:
```
:highlight = color("yellow"), size(4)
:bluethings = color("blue"), shape("sphere")

tag("important") => :highlight
link_to("ocean") => :bluethings
```

### 4. Complex combinations
You can combine all features:
```
:fancy = color("#FFD700"), shape("dodecahedron"), material("metal"), size(8)
tag("treasure"), link_to("gold") => :fancy
```

## Complete Example
```
# Define named parameters
:highlight = color("yellow"), size(5)
:error = color("red"), shape("octahedron"), size(3)
:subtle = color("#808080"), size(0.5)

# Apply default styling
default => color("#CCCCCC")

# Use named parameters
tag("important") => :highlight
tag("error"), tag("bug") => :error

# Combine conditions and actions
link_to("index"), link_from("hub") => color("green"), shape("cube")

# Mix named and inline actions
tag("archived") => :subtle, material("plastic")
```