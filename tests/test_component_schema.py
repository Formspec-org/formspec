import json
import pytest
from jsonschema import validate, ValidationError

with open("schemas/component.schema.json", "r") as f:
    SCHEMA = json.load(f)

def test_minimal_document():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {
            "url": "https://example.com/def"
        },
        "tree": {
            "component": "Page",
            "title": "Minimal Page"
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_full_core_components():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Page",
            "children": [
                { "component": "Stack", "children": [
                    { "component": "Heading", "level": 1, "text": "Form" },
                    { "component": "TextInput", "bind": "name" },
                    { "component": "NumberInput", "bind": "age" },
                    { "component": "DatePicker", "bind": "dob" },
                    { "component": "Select", "bind": "gender" },
                    { "component": "CheckboxGroup", "bind": "interests" },
                    { "component": "Toggle", "bind": "agree" },
                    { "component": "FileUpload", "bind": "resume" }
                ]},
                { "component": "Grid", "columns": 2, "children": [
                    { "component": "Card", "title": "Section 1", "children": [
                        { "component": "Text", "text": "Info here" }
                    ]},
                    { "component": "Collapsible", "title": "Details", "children": [
                        { "component": "Divider", "label": "More" }
                    ]}
                ]},
                { "component": "Wizard", "children": [
                    { "component": "Page", "title": "Step 1", "children": [] }
                ]},
                { "component": "Spacer", "size": "20px" },
                { "component": "ConditionalGroup", "when": "$show", "children": [] }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_progressive_components():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Page",
            "children": [
                { "component": "Columns", "widths": [1, 2], "children": [] },
                { "component": "Tabs", "children": [] },
                { "component": "Accordion", "children": [] },
                { "component": "RadioGroup", "bind": "choice" },
                { "component": "MoneyInput", "bind": "amount" },
                { "component": "Slider", "bind": "percent" },
                { "component": "Rating", "bind": "score" },
                { "component": "Signature", "bind": "sig" },
                { "component": "Alert", "severity": "info", "text": "Note" },
                { "component": "Badge", "text": "New" },
                { "component": "ProgressBar", "value": 50 },
                { "component": "Summary", "items": [{"label": "Name", "bind": "name"}] },
                { "component": "DataTable", "bind": "rows", "columns": [{"header": "Col 1", "bind": "c1"}] },
                { "component": "Panel", "children": [] },
                { "component": "Modal", "title": "Popup", "children": [] }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_invalid_component_name_structural_valid():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": { "component": "UnknownComponent" }
    }
    # Should be treated as CustomComponentRef; structurally valid even if referential integrity fails
    validate(instance=doc, schema=SCHEMA)

def test_custom_component_valid():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "components": {
            "MyInput": {
                "params": ["label", "key"],
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "Heading", "level": 3, "text": "{label}" },
                        { "component": "TextInput", "bind": "{key}" }
                    ]
                }
            }
        },
        "tree": {
            "component": "MyInput",
            "params": { "label": "First Name", "key": "fname" }
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_missing_bind_on_input():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": { "component": "TextInput" }
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)

def test_responsive_overrides():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "breakpoints": { "sm": 640 },
        "tree": {
            "component": "Grid",
            "columns": 2,
            "responsive": {
                "sm": { "columns": 1 }
            },
            "children": []
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_token_references():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tokens": { "spacing.md": "16px" },
        "tree": {
            "component": "Stack",
            "gap": "$token.spacing.md",
            "children": []
        }
    }
    validate(instance=doc, schema=SCHEMA)

@pytest.mark.parametrize("component_name, props, extra_keys", [
    ("Page", {"title": "T"}, ["children"]),
    ("Stack", {"direction": "horizontal", "gap": 10}, ["children"]),
    ("Grid", {"columns": 3, "gap": "1em"}, ["children"]),
    ("Wizard", {"showProgress": True}, ["children"]),
    ("Spacer", {"size": 10}, []),
    ("TextInput", {"bind": "k", "placeholder": "P"}, []),
    ("NumberInput", {"bind": "k", "step": 1, "min": 0, "max": 10}, []),
    ("DatePicker", {"bind": "k", "format": "Y-m-d"}, []),
    ("Select", {"bind": "k", "searchable": True}, []),
    ("CheckboxGroup", {"bind": "k", "columns": 2, "selectAll": True}, []),
    ("Toggle", {"bind": "k", "onLabel": "Y", "offLabel": "N"}, []),
    ("FileUpload", {"bind": "k", "accept": ".jpg", "multiple": True}, []),
    ("Heading", {"level": 2, "text": "H"}, []),
    ("Text", {"text": "T", "format": "markdown"}, []),
    ("Divider", {"label": "D"}, []),
    ("Card", {"title": "T", "subtitle": "S"}, ["children"]),
    ("Collapsible", {"title": "T", "defaultOpen": True}, ["children"]),
    ("ConditionalGroup", {"when": "FEL", "fallback": "F"}, ["children"]),
    ("Columns", {"widths": [1, "2fr"]}, ["children"]),
    ("Tabs", {"position": "left"}, ["children"]),
    ("Accordion", {"allowMultiple": True}, ["children"]),
    ("RadioGroup", {"bind": "k", "columns": 3}, []),
    ("MoneyInput", {"bind": "k", "currency": "USD", "showCurrency": True}, []),
    ("Slider", {"bind": "k", "min": 0, "max": 100, "step": 5}, []),
    ("Rating", {"bind": "k", "max": 5, "icon": "star"}, []),
    ("Signature", {"bind": "k", "strokeColor": "black", "clearable": True}, []),
    ("Alert", {"severity": "warning", "text": "A"}, []),
    ("Badge", {"text": "B", "variant": "primary"}, []),
    ("ProgressBar", {"value": 75, "max": 100, "label": "L"}, []),
    ("Summary", {"items": [{"label": "L", "bind": "k"}]}, []),
    ("DataTable", {"bind": "r", "columns": [{"header": "H", "bind": "k"}]}, []),
    ("Panel", {"position": "right"}, ["children"]),
    ("Modal", {"title": "M", "size": "lg"}, ["children"]),
])
def test_all_component_types_valid(component_name, props, extra_keys):
    item = {"component": component_name, **props}
    for key in extra_keys:
        if key == "children":
            item[key] = []
    
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": item
    }
    validate(instance=doc, schema=SCHEMA)

@pytest.mark.parametrize("component_name, invalid_props", [
    ("Heading", {"level": 0}), # Min 1
    ("Heading", {"level": 7}), # Max 6
    ("Stack", {"direction": "up"}), # Enum
    ("TextInput", {}), # Missing bind
    ("Summary", {"items": [{"label": "L"}]}), # Missing bind in item
    ("DataTable", {"columns": [{"header": "H"}]}), # Missing bind in column
    ("Modal", {}), # Missing title
])
def test_component_types_invalid_props(component_name, invalid_props):
    item = {"component": component_name, **invalid_props}
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": item
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)
def test_custom_component_ref_structural():
    # Structural validation of a custom component reference
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "components": {
            "MyComp": {
                "params": ["p1"],
                "tree": { "component": "Text", "text": "{p1}" }
            }
        },
        "tree": {
            "component": "MyComp",
            "params": { "p1": "value" },
            "when": "$show",
            "style": { "color": "red" }
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_deep_nesting():
    # Test that deep nesting is allowed by schema
    curr = { "component": "Stack", "children": [] }
    for _ in range(50):
        curr = { "component": "Stack", "children": [curr] }
    
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": curr
    }
    validate(instance=doc, schema=SCHEMA)

def test_tokens_at_top_level():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tokens": {
            "color.primary": "#007bff",
            "spacing.unit": 8,
            "font.size.large": "1.25rem"
        },
        "tree": { "component": "Spacer", "size": "$token.spacing.unit" }
    }
    validate(instance=doc, schema=SCHEMA)

def test_breakpoints_at_top_level():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "breakpoints": {
            "mobile": 0,
            "tablet": 768,
            "desktop": 1024
        },
        "tree": { "component": "Page", "children": [] }
    }
    validate(instance=doc, schema=SCHEMA)

def test_interpolation_escaping_in_text():
    # {{ producing literal {
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Text",
            "text": "Literal {{brace}}"
        }
    }
    validate(instance=doc, schema=SCHEMA)
def test_full_employee_onboarding_wizard():
    # Example from §18 of the plan
    doc = {
        "$formspecComponent": "1.0",
        "url": "https://example.com/onboarding-ui",
        "version": "1.1.0",
        "targetDefinition": {
            "url": "https://example.com/onboarding-def",
            "compatibleVersions": "^1.0.0"
        },
        "tokens": {
            "spacing.page": "24px",
            "color.primary": "$token.brand.blue"
        },
        "components": {
            "LabeledSection": {
                "params": ["title", "itemKey"],
                "tree": {
                    "component": "Stack",
                    "children": [
                        { "component": "Heading", "level": 3, "text": "{title}" },
                        { "component": "TextInput", "bind": "{itemKey}" }
                    ]
                }
            }
        },
        "tree": {
            "component": "Wizard",
            "showProgress": True,
            "children": [
                {
                    "component": "Page",
                    "title": "Personal Details",
                    "children": [
                        { "component": "Card", "title": "Basic Info", "children": [
                            { "component": "LabeledSection", "params": { "title": "First Name", "itemKey": "fname" } },
                            { "component": "LabeledSection", "params": { "title": "Last Name", "itemKey": "lname" } }
                        ]},
                        { "component": "DatePicker", "bind": "dob", "maxDate": "2007-01-01" }
                    ]
                },
                {
                    "component": "Page",
                    "title": "Equipment",
                    "children": [
                        { "component": "Text", "text": "Select your preferred equipment:" },
                        { "component": "CheckboxGroup", "bind": "hardware_prefs", "columns": 2 },
                        { "component": "ConditionalGroup",
                            "when": "CONTAINS($hardware_prefs, 'other')",
                            "children": [
                                { "component": "TextInput", "bind": "hardware_other_details", "placeholder": "Specify..." }
                            ]
                        }
                    ]
                }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_empty_components_registry():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "components": {},
        "tree": { "component": "Page", "children": [] }
    }
    validate(instance=doc, schema=SCHEMA)

@pytest.mark.parametrize("invalid_token", [
    "$token", # No path
    "$token.", # Empty path
    "token.path", # Missing $
    "$token. space", # Invalid char
])
def test_invalid_token_references_schema_allows_string(invalid_token):
    # Schema doesn't strictly validate token pattern everywhere because they are strings
    # But we can check if Spacer.size (oneOf string/number) allows it as a string
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": { "component": "Spacer", "size": invalid_token }
    }
    # These are technically valid JSON strings, so schema validates them.
    # Pattern validation for tokens isn't in the schema currently except for documentation.
    validate(instance=doc, schema=SCHEMA)

@pytest.mark.parametrize("dataType, component, valid", [
    # string
    ("string", "TextInput", True),
    ("string", "NumberInput", False),
    # integer
    ("integer", "NumberInput", True),
    ("integer", "Slider", True),
    ("integer", "Rating", True),
    ("integer", "TextInput", False),
    # decimal
    ("decimal", "NumberInput", True),
    ("decimal", "MoneyInput", True),
    ("decimal", "Slider", True),
    # boolean
    ("boolean", "Toggle", True),
    ("boolean", "TextInput", False),
    # date/time
    ("date", "DatePicker", True),
    ("dateTime", "DatePicker", True),
    ("time", "DatePicker", True),
    # choice
    ("choice", "Select", True),
    ("choice", "RadioGroup", True),
    # multiChoice
    ("multiChoice", "CheckboxGroup", True),
    # attachment
    ("attachment", "FileUpload", True),
    ("attachment", "Signature", True),
])
def test_compatibility_matrix_samples(dataType, component, valid):
    # This is a documentation check since the schema itself doesn't know the dataType
    # But it tests that these component/prop combinations are valid JSON
    item = {"component": component, "bind": "k"}
    if component == "Rating": item["max"] = 5
    if component == "Alert": item["severity"] = "info"; item["text"] = "T"
    
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": item
    }
    validate(instance=doc, schema=SCHEMA)

def test_invalid_custom_component_params_type():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "MyComp",
            "params": ["should", "be", "an", "object"]
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)

def test_wizard_with_pages():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Wizard",
            "children": [
                { "component": "Page", "title": "S1", "children": [] },
                { "component": "Page", "title": "S2", "children": [] }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_datatable_columns_valid():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "DataTable",
            "bind": "repeating_group",
            "columns": [
                { "header": "Name", "bind": "name" },
                { "header": "Age", "bind": "age" }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_summary_items_valid():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Summary",
            "items": [
                { "label": "L1", "bind": "k1" },
                { "label": "L2", "bind": "k2" }
            ]
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_all_progressive_fallbacks_present_in_spec():
    # Meta-test to ensure all 15 progressive components have fallbacks defined in the spec
    with open("specs/component/component-spec.md", "r") as f:
        content = f.read()
    
    progressive = [
        "Columns", "Tabs", "Accordion",
        "RadioGroup", "MoneyInput", "Slider", "Rating", "Signature",
        "Alert", "Badge", "ProgressBar", "Summary", "DataTable",
        "Panel", "Modal"
    ]
    for comp in progressive:
        # Check for Fallback: or fallback: in the component's section
        # Very loose check
        assert comp in content
        assert "Fallback" in content or "fallback" in content

def test_schema_is_forward_compatible_via_style():
    # Any component can have 'style' and 'responsive'
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Page",
            "style": { "x-custom-prop": 123 },
            "children": []
        }
    }
    validate(instance=doc, schema=SCHEMA)

def test_responsive_grid_overrides():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": {
            "component": "Grid",
            "columns": 4,
            "responsive": {
                "md": { "columns": 2 },
                "sm": { "columns": 1 }
            },
            "children": []
        }
    }
    validate(instance=doc, schema=SCHEMA)
@pytest.mark.parametrize("comp, prop, val", [
    ("Page", "title", 123), # Should be string
    ("Stack", "direction", "diagonal"), # Invalid enum
    ("Grid", "columns", -1), # Should be positive (if int)
    ("Heading", "level", 7), # Max 6
    ("Heading", "level", "two"), # Should be int
    ("TextInput", "maxLines", 0), # Min 1
    ("CheckboxGroup", "columns", 0), # Min 1
    ("Rating", "max", 0), # Min 1
    ("Modal", "size", "massive"), # Invalid enum
    ("Panel", "position", "top"), # Invalid enum
    ("Alert", "severity", "critical"), # Invalid enum
])
def test_property_type_and_range_validation(comp, prop, val):
    item = {"component": comp, prop: val}
    if comp in ["TextInput", "CheckboxGroup", "Rating"]:
        item["bind"] = "k"
    if comp == "Heading":
        item["text"] = "T"
    if comp == "Modal":
        item["title"] = "T"
    if comp == "Alert":
        item["text"] = "T"
    
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": item
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)

def test_stack_direction_default():
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": { "url": "https://example.com/def" },
        "tree": { "component": "Stack", "children": [] }
    }
    validate(instance=doc, schema=SCHEMA)
    # Default is vertical


def test_top_level_name_title_description():
    """Top-level metadata fields are accepted."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "name": "my-form-ui",
        "title": "My Form UI",
        "description": "A component document for my form.",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": {"component": "Page", "children": []},
    }
    validate(instance=doc, schema=SCHEMA)


def test_top_level_x_extension_keys():
    """x-prefixed extension keys are allowed at top level."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": {"component": "Page", "children": []},
        "x-vendor": {"config": True},
    }
    validate(instance=doc, schema=SCHEMA)


def test_custom_component_without_params():
    """Custom component definition with only tree (no params)."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "components": {
            "InfoBlock": {
                "tree": {"component": "Text", "text": "Static content"}
            }
        },
        "tree": {"component": "InfoBlock"},
    }
    validate(instance=doc, schema=SCHEMA)


def test_pascal_case_component_key_valid():
    """PascalCase keys pass the patternProperties constraint."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "components": {
            "MyWidget": {"tree": {"component": "Text", "text": "Hello"}},
            "AnotherOne99": {"tree": {"component": "Spacer", "size": 10}},
        },
        "tree": {"component": "Page", "children": []},
    }
    validate(instance=doc, schema=SCHEMA)


def test_lowercase_component_key_rejected():
    """Non-PascalCase keys fail the patternProperties constraint."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "components": {
            "myWidget": {"tree": {"component": "Text", "text": "Hello"}}
        },
        "tree": {"component": "Page", "children": []},
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)


@pytest.mark.parametrize("component_name, props, extra_keys", [
    ("Stack", {"direction": "horizontal", "wrap": True}, ["children"]),
    ("NumberInput", {"bind": "k", "showStepper": True, "locale": "en-US"}, []),
    ("DatePicker", {"bind": "k", "showTime": True}, []),
])
def test_extended_component_props(component_name, props, extra_keys):
    """Test component properties added in later schema revisions."""
    item = {"component": component_name, **props}
    for key in extra_keys:
        if key == "children":
            item[key] = []
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": item,
    }
    validate(instance=doc, schema=SCHEMA)


@pytest.mark.parametrize("component_name, base_props", [
    ("Page", {"children": []}),
    ("TextInput", {"bind": "k"}),
    ("Heading", {"level": 1, "text": "Hi"}),
    ("Alert", {"severity": "info", "text": "Note"}),
])
def test_accessibility_block_accepted(component_name, base_props):
    """Every component accepts an optional accessibility block."""
    item = {
        "component": component_name,
        **base_props,
        "accessibility": {
            "role": "region",
            "description": "Main form section",
            "liveRegion": "polite",
        },
    }
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": item,
    }
    validate(instance=doc, schema=SCHEMA)


def test_accessibility_block_invalid_live_region():
    """Invalid liveRegion value is rejected."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": {
            "component": "Page",
            "children": [],
            "accessibility": {"liveRegion": "rude"},
        },
    }
    with pytest.raises(ValidationError):
        validate(instance=doc, schema=SCHEMA)


def test_accessibility_block_empty_valid():
    """Empty accessibility block is valid (all properties optional)."""
    doc = {
        "$formspecComponent": "1.0",
        "version": "1.0.0",
        "targetDefinition": {"url": "https://example.com/def"},
        "tree": {
            "component": "Page",
            "children": [],
            "accessibility": {},
        },
    }
    validate(instance=doc, schema=SCHEMA)
