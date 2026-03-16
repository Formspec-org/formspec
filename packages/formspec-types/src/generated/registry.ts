/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
/**
 * A single extension record. Describes one Formspec extension — its identity, category, lifecycle status, compatibility bounds, and category-specific metadata (signatures, base types, members). Category-specific properties become required based on the category value: dataType requires baseType; function requires parameters and returns; constraint requires parameters.
 *
 * This interface was referenced by `RegistryDocument`'s JSON-Schema
 * via the `definition` "RegistryEntry".
 */
export type RegistryEntry = {
  [k: string]: unknown;
} & {
  /**
   * The x-prefixed extension identifier. Must be lowercase ASCII with hyphen-separated segments, each starting with a letter. The prefix x-formspec- is reserved for future core promotion.
   */
  name: string;
  /**
   * The extension mechanism this entry represents. Determines which category-specific properties are required: dataType requires baseType; function requires parameters and returns; constraint requires parameters; property and namespace have no additional required properties.
   */
  category: 'dataType' | 'function' | 'constraint' | 'property' | 'namespace';
  /**
   * Semver version of the extension itself (not the Formspec version). Within a registry document, the (name, version) tuple MUST be unique. A new major version MAY re-enter draft status.
   */
  version: string;
  /**
   * Lifecycle status. Transitions: draft → stable → deprecated → retired. Transitions MUST NOT skip states. Stable means the interface is frozen for the major version. Deprecated requires a deprecationNotice. Processors encountering retired extensions SHOULD emit a warning.
   */
  status: 'draft' | 'stable' | 'deprecated' | 'retired';
  publisher?: Publisher;
  /**
   * Human-readable summary of the extension's purpose and behavior.
   */
  description: string;
  /**
   * Link to the full human-readable extension documentation or specification.
   */
  specUrl?: string;
  /**
   * Link to a JSON Schema for validating the extension's data as it appears in a Formspec Definition document. Registry-aware processors SHOULD fetch and validate against this schema.
   */
  schemaUrl?: string;
  /**
   * Version compatibility bounds. Processors MUST verify the current Formspec version satisfies formspecVersion. A mismatch produces a warning (or hard error if x-formspec-strict is set in extensions).
   */
  compatibility: {
    /**
     * Semver range of compatible Formspec core specification versions. Uses npm-style range syntax.
     */
    formspecVersion: string;
    /**
     * Semver range of compatible Mapping DSL versions. Only relevant for extensions that interact with the Mapping specification.
     */
    mappingDslVersion?: string;
  };
  /**
   * SPDX license identifier for the extension (e.g. 'Apache-2.0', 'MIT', 'CC0-1.0'). See https://spdx.org/licenses/ for valid identifiers.
   */
  license?: string;
  /**
   * Human-readable deprecation message explaining why the extension is deprecated and identifying a replacement if one exists. REQUIRED when status is 'deprecated'. Processors SHOULD surface this message to form authors.
   */
  deprecationNotice?: string;
  /**
   * Array of JSON values demonstrating how this extension is used in a Formspec Definition. Each element is a free-form JSON value — typically a fragment of a definition document or an item using the extension.
   */
  examples?: unknown[];
  /**
   * Entry-level extension properties for vendor-specific metadata. All property keys MUST be x-prefixed.
   */
  extensions?: {};
  /**
   * The core Formspec data type that this custom dataType extends. REQUIRED when category is 'dataType'. The custom type inherits the base type's serialization, comparison, and FEL operator semantics.
   */
  baseType?: 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'dateTime' | 'time' | 'uri';
  /**
   * Default constraint values applied to fields using this custom dataType. Keys are constraint names, values are their defaults. Only meaningful when category is 'dataType'.
   */
  constraints?: {};
  /**
   * Presentation-layer metadata for this custom dataType. Provides rendering hints such as prefix symbols, precision, and formatting options. Only meaningful when category is 'dataType'.
   */
  metadata?: {};
  /**
   * Function or constraint signature parameters. REQUIRED when category is 'function' or 'constraint'. Each parameter declares name, type, and optional description. Parameters are positional — order matters for function calls in FEL.
   */
  parameters?: {
    /**
     * Parameter name used in documentation and error messages.
     */
    name: string;
    /**
     * Core Formspec data type name for this parameter (e.g. 'string', 'number', 'date', 'boolean', 'array').
     */
    type: string;
    /**
     * Human-readable explanation of what this parameter represents.
     */
    description?: string;
  }[];
  /**
   * Core Formspec data type name for the return value of a custom function. REQUIRED when category is 'function'. Used by processors for type checking in FEL expressions.
   */
  returns?: string;
  /**
   * Array of x-prefixed extension names grouped under this namespace. Only meaningful when category is 'namespace'. Members should be other entries in the same or a referenced registry.
   */
  members?: string[];
};

/**
 * A static JSON document format for publishing, discovering, and validating Formspec extensions. A Registry Document enumerates named extensions — custom data types, functions, constraints, properties, and namespaces — with metadata, version history, compatibility bounds, and machine-readable schemas. Any organization MAY publish its own Registry Document. Interoperability is achieved through the common format, not centralized authority.
 */
export interface RegistryDocument {
  /**
   * Registry specification version. MUST be '1.0'.
   */
  $formspecRegistry: '1.0';
  /**
   * Optional JSON Schema URI for editor validation and autocompletion.
   */
  $schema?: string;
  publisher: Publisher;
  /**
   * ISO 8601 timestamp indicating when this registry version was published. Used for freshness checks and conditional GET cache validation.
   */
  published: string;
  /**
   * Array of extension registry entries. Each entry describes one extension with its category, version, compatibility bounds, and category-specific metadata. Within a single document, the (name, version) tuple MUST be unique.
   */
  entries: RegistryEntry[];
  /**
   * Registry-level extension properties for vendor-specific metadata. All property keys MUST be x-prefixed.
   */
  extensions?: {};
}
/**
 * Organization publishing this registry document. Provides provenance and contact information for all entries unless overridden at the entry level.
 */
export interface Publisher {
  /**
   * Human-readable organization name.
   */
  name: string;
  /**
   * Organization home page URI.
   */
  url: string;
  /**
   * Contact email address or URI for extension-related inquiries.
   */
  contact?: string;
}
