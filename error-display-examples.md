# Error Display Examples

When a query has syntax errors, they will now be displayed on the graph view with a red error message that can be dismissed.

## Example Error Cases

### 1. Missing Arrow
```
default color("red")
```
Error: Parsing error: Expecting token of type --> Arrow <-- but found --> 'color' <--

### 2. Missing Parentheses
```
default => color"red"
```
Error: Parsing error: Expecting token of type --> LParen <-- but found --> '"red"' <--

### 3. Invalid Token
```
default => @invalid
```
Error: Lexing error: unexpected character: ->@<- at offset: 11

### 4. Invalid Syntax
```
invalid syntax
```
Error: Parsing error: Expecting token of type --> Arrow <-- but found --> 'syntax' <--

### 5. Missing Comma in List
```
tag("A") tag("B") => color("red")
```
Error: Parsing error: Expecting token of type --> Arrow <-- but found --> 'tag' <--

## How Errors Are Displayed

1. **3D Force Graph**: Errors appear at the top center of the graph view
2. **Cytoscape Graph**: Errors appear at the top center of the graph view
3. **Styling**: Red background with white text for high visibility
4. **Dismissible**: Click the × button to close the error message
5. **Non-blocking**: The graph still renders with default styling when there are query errors