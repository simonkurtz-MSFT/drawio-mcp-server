---
applyTo: "**"
---

# GitHub Copilot Instructions for this Repository

## Diagrams

- Use the drawio mcp server for all diagram generation tasks.
- When asked to create diagrams such as flowcharts, decision trees, technical architecture diagrams, etc., we always want to use the draw.io mcp server and XML format.
- Content returned from the draw.io mcp server will be in XML format. Take this content and create or update a `.drawio` file in the repository with that content.
- Always use Azure as the initial context for the technical architecture diagrams unless otherwise specified. Use official Azure icons and colors for all components.
- Diagram flow should be left-to-right and top-to-bottom unless otherwise specified.
- Use stencils for all components in the diagrams. Do not use basic shapes (rectangles, circles, etc.) to represent components.
- Add labels for traffic paths (static vs API) or security boundaries (VNet/private endpoints). Labels should not overlay stencils. Use whitespace for clarity.
- Favor the batch-add-cells call when adding multiple components to a diagram for efficiency.
