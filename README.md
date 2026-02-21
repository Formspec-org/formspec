# Formspec v1.0

**A JSON-Native Declarative Form Standard**

Formspec is a format-agnostic, JSON-native standard for declarative form definition and validation. It specifies how to describe form fields, computed values, validation rules, conditional logic, repeatable sections, versioning, and structured validation results — independent of any rendering technology, programming language, or data transport mechanism.

## Overview

Formspec draws on ideas from W3C XForms, SHACL, and HL7 FHIR to provide a coherent, JSON-first specification suitable for web, mobile, server-side, and offline implementations.

The specification is organized into **Tiers** to separate concerns:

### Tier 1: Core (Data & Logic)
*   **Purpose**: Defines the data model, validation rules, conditional logic, and basic structure.
*   **Key Files**:
    *   [`spec.md`](spec.md): The normative core specification.
    *   [`definition.schema.json`](definition.schema.json): JSON Schema for Formspec definitions.
    *   [`response.schema.json`](response.schema.json): Schema for form responses.
    *   [`validationReport.schema.json`](validationReport.schema.json): Schema for validation results.

### Tier 2: Theme (Presentation)
*   **Purpose**: Defines layout, styling, and design tokens to decouple visual presentation from logic.
*   **Key Files**:
    *   [`theme-spec.md`](theme-spec.md): The theme specification.
    *   [`theme.schema.json`](theme.schema.json): JSON Schema for theme definitions.

### Tier 3: Components (Interaction)
*   **Purpose**: Defines rich interactive widgets and their behaviors (e.g., date pickers, rich text editors).
*   **Key Files**:
    *   [`component-spec.md`](component-spec.md): The component model specification.
    *   [`component.schema.json`](component.schema.json): JSON Schema for component definitions.

### Related Specifications
*   **FEL (Formspec Expression Language)**: A simple expression language for calculated values and conditional logic. See [`fel/`](fel/).
*   **Mapping**: Defines how to map form data to other structures. See [`mapping-spec.md`](mapping-spec.md) and [`mapping.schema.json`](mapping.schema.json).

## Documentation

View the documentation locally by opening `index.html` in your web browser. This provides a clear, structured view of the specification.

## Usage

Formspec definitions are standard JSON files. You can validate them against the provided JSON Schemas using any compliant JSON Schema validator.

### Example: Validating a Formspec Definition (Python)

```python
import json
import jsonschema

# Load the schema
with open("definition.schema.json") as f:
    schema = json.load(f)

# Load your form definition
with open("my-form.json") as f:
    form_def = json.load(f)

# Validate
jsonschema.validate(instance=form_def, schema=schema)
print("Validation successful!")
```

## Utilities

The repository includes utility adapters in the `adapters/` directory for converting data between formats (CSV, JSON, XML).

## Testing

This repository includes a comprehensive conformance test suite covering all tiers and the FEL implementation.

### Prerequisites

*   Python 3.8+
*   `pytest`
*   `jsonschema`
*   `hypothesis`

### Running Tests

To run the full test suite:

```bash
python3 -m pytest tests/ -v
```

For more details on the test suite, see [`tests/README.md`](tests/README.md).

## Status

**Version**: 1.0.0-draft.1

This is a **draft specification** and is subject to change. It is not yet recommended for production use without careful consideration of potential breaking changes.
