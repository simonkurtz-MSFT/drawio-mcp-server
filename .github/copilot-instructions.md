---
applyTo: "**"
---

# GitHub Copilot Instructions for this Repository

## Diagrams

- When asked to create diagrams such as flowcharts, decision trees, technical architecture diagrams, etc., we always want to use the draw.io mcp server and XML format.
- Content returned from the draw.io mcp server will be in XML format. Take this content and create or update a `.drawio` file in the repository with that content.
- Always use Azure as the initial context for the technical architecture diagrams unless otherwise specified. Use official Azure icons and colors for all components.
- Add labels for traffic paths (static vs API) or security boundaries (VNet/private endpoints). Labels should not overlay stencils. A bit of whitespace is fine to use.