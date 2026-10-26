# pen.dev .pen File Specification (v2.13)

Based on reverse-engineering analysis with REA MCP on `/Applications/Pen.app`.

## Document Structure
A `.pen` file is a UTF-8 JSON document that defines an infinite canvas with hierarchical vector nodes, styling tokens, and theme definitions.

```json
{
  "version": "2.13",
  "children": [
    /* Array of top-level frames or canvas nodes */
  ],
  "themes": {
    "Mode": ["Light", "Dark"]
  },
  "variables": {
    "--primary": {
      "type": "color",
      "value": [
        { "value": "#000000" },
        { "value": "#ffffff", "theme": { "Mode": "Dark" } }
      ]
    }
  }
}
```

## Node Types

### 1. Frame (`type: "frame"`)
The fundamental container node, representing artboards, cards, sections, or nested flex layouts.
- `id`: string (5-character alphanumeric UID, e.g. `YKsGt`)
- `name`: string label
- `x`, `y`: numbers (canvas coordinates)
- `width`, `height`: numbers
- `clip`: boolean (whether content outside bounding box is masked)
- `layout`: `"none" | "flex" | "grid"`
- `flexDirection`: `"row" | "column"` (optional)
- `gap`: number
- `padding`: number | [top, right, bottom, left]
- `fill`: string (hex, rgba, or CSS variable like `"var(--sidebar)"`)
- `stroke`, `strokeWidth`: stroke outline
- `cornerRadius`: number
- `children`: PenNode[]

### 2. Text (`type: "text"`)
Typography node for headers, body copy, labels.
- `content`: string
- `fontFamily`: string (e.g. `"Noto Sans"`, `"Inter"`)
- `fontSize`: number
- `fontWeight`: string (`"400"`, `"500"`, `"600"`, `"700"`)
- `lineHeight`: number (multiplier, e.g. `1.4`)
- `textAlign`: `"left" | "center" | "right"`
- `letterSpacing`: number
- `textGrowth`: `"auto" | "fixed-width" | "fixed-width-height"`
- `fill`: text color

### 3. Path & Shape (`type: "path" | "rect" | "ellipse"`)
Vector artwork and geometric shapes.
- `geometry`: SVG path string (e.g. `"M7 0l0 14m7-7l-7 7-7-7"`)
- `stroke`, `strokeWidth`, `strokeLinejoin`, `strokeLinecap`
- `rotation`: number in degrees

### 4. Component Instance (`type: "component"`)
Reusable master component instantiation with prop overrides.
- `componentId`: reference to master component ID
- `overrides`: key-value map of overridden properties
