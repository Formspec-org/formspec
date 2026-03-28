/** Shared definition fixtures used across multiple story categories. */

/** Contact form — shared base for layout, display, and adapter stories. */
export const contactFormDef = {
    "$formspec": "1.0",
    title: "Contact Form",
    items: [
        { key: "firstName", type: "field", dataType: "string", label: "First Name", required: true },
        { key: "lastName", type: "field", dataType: "string", label: "Last Name", required: true },
        { key: "email", type: "field", dataType: "string", label: "Email" },
        { key: "phone", type: "field", dataType: "string", label: "Phone" },
        { key: "newsletter", type: "field", dataType: "boolean", label: "Subscribe to newsletter", presentation: { widgetHint: "Checkbox" } },
    ],
};

/** Display components: heading, text, alert, divider. Used by adapter stories. */
export const displayDef = {
    "$formspec": "1.0",
    title: "Display Components",
    items: [
        { key: "heading", type: "display", label: "Section Heading", presentation: { widgetHint: "heading" } },
        { key: "intro", type: "display", label: "This is a paragraph of informational text explaining the form section.", presentation: { widgetHint: "paragraph" } },
        { key: "info", type: "display", label: "Please complete all required fields before submitting.", presentation: { widgetHint: "banner" } },
        { key: "sep", type: "display", label: "", presentation: { widgetHint: "divider" } },
    ],
};
