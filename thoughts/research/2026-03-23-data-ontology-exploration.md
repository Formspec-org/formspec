# Formspec and Data Ontology: A Deep Exploration

## 1. Current State -- What Ontology-Adjacent Features Already Exist

Formspec already contains a surprising amount of ontological infrastructure, though it is not framed that way. The pieces are scattered across five specification layers.

### 1.1 Structural Typing (`definition.schema.json`)

Every field declares a `dataType` from a fixed enumeration: `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `time`, `uri`, `attachment`, `choice`, `multiChoice`, `money`. This is a simple type system -- it answers "what shape is this value?" but not "what does this value mean?"

The `money` type is interesting because it is the one case where formspec crosses from structural typing into domain semantics. A `money` value is not just a number; it is a composite `{amount, currency}` with domain-specific arithmetic (`moneyAdd` requires same currency). This is a micro-ontology embedded in the type system.

### 1.2 Semantic Annotation (`semanticType`)

The `semanticType` property on Field items is formspec's single explicit nod to ontological classification:

```json
"semanticType": "us-gov:ein"
```

Per the spec (Core spec section 4.2.3): "Domain meaning annotation. Purely metadata -- MUST NOT affect validation, calculation, or any behavioral semantics. Supports intelligent widget selection, data classification, and interoperability mapping."

The examples are namespaced identifiers: `us-gov:ein`, `ietf:email`, `iso:phone-e164`, `clinical:subject-id`. This is a rudimentary concept identifier system, but it is entirely unstructured. There is no schema constraint on the format, no registry of valid semantic types, no machine-readable definition of what `us-gov:ein` means, and no formal relationship between `semanticType` and the extension system.

Critically, `widgetHint` takes precedence over `semanticType` for widget selection (Core spec section 4.2.5.5). This subordination means renderers already understand that fields have meaning beyond their data type, but the spec does not provide machinery for that meaning to propagate.

### 1.3 Extension Type System (Registry)

The extension registry (`registries/formspec-common.registry.json`) is where formspec comes closest to domain-specific type ontology. The registry defines extensions like `x-formspec-email`, `x-formspec-ssn`, `x-formspec-ein`, `x-formspec-phone-nanp`, `x-formspec-postal-code-us`, `x-formspec-percentage`, `x-formspec-currency-usd`, and `x-formspec-credit-card`.

Each registry entry for a `dataType` extension declares:

- **`baseType`**: which core type it extends (structural inheritance)
- **`constraints`**: pattern, min/max, maxLength (validation semantics)
- **`metadata`**: inputMode, autocomplete, mask, prefix/suffix, sensitive, displayMask (presentation semantics)
- **`displayName`**: human-readable name

This is a two-level type system: a core structural type (`string`) refined by a domain extension (`x-formspec-ein`) that adds validation, presentation, and naming. The `baseType` relationship is genuine type inheritance -- "an EIN is a string that matches `^[0-9]{2}-[0-9]{7}$`."

But the extension system stops short of ontological depth. Registry entries do not declare:
- What concept the type represents (there is no IRI linking `x-formspec-ein` to a standard concept)
- Relationships to other types (no "an EIN identifies an Employer which is an Organization")
- Data lineage (no "this field comes from system X")
- Equivalence across systems (no "an EIN in this form equals taxpayerID in that form")

### 1.4 Option Sets as Controlled Vocabularies

Option sets (`optionSets`) are formspec's mechanism for constrained value domains:

```json
"eventSeverities": {
  "options": [
    { "value": "mild", "label": "Mild" },
    { "value": "moderate", "label": "Moderate" },
    { "value": "severe", "label": "Severe" },
    { "value": "critical", "label": "Critical" }
  ]
}
```

These are, in ontological terms, controlled vocabularies -- enumerated concept sets with both machine identifiers (`value`) and human labels (`label`). But they are entirely local to a single definition. There is no mechanism to declare that these severity values correspond to an external vocabulary, that `"severe"` in this form means the same thing as `Grade3` in CTCAE (Common Terminology Criteria for Adverse Events), or that this option set is a projection of a larger taxonomy.

Option sets also support external sources via URI, but this is a fetch mechanism, not a semantic binding.

### 1.5 The Mapping Spec as Implicit Ontology Alignment

The mapping spec is the richest ontology-adjacent feature in formspec. Consider the FHIR mapping example in the spec (`specs/mapping/mapping-spec.md`, section 3.1.3):

```json
{
  "sourcePath": "biological_sex",
  "targetPath": "gender",
  "transform": "valueMap",
  "valueMap": {
    "forward": { "male": "male", "female": "female", "intersex": "other" },
    "reverse": { "male": "male", "female": "female", "other": "intersex" }
  }
}
```

This is concept alignment, implemented as value translation. The mapping says: "the concept my form calls `intersex` is what FHIR calls `other`." The `valueMap` is literally a function between two terminologies.

The `targetSchema` descriptor declares the external system:

```json
{
  "format": "json",
  "name": "FHIR Patient R4",
  "url": "https://hl7.org/fhir/R4/patient.schema.json"
}
```

This names and points to the target ontology but does not formally bind to it. The `url` is informational -- processors do not resolve or validate against it.

The mapping spec's transforms -- `preserve`, `coerce`, `valueMap`, `expression`, `flatten`, `nest` -- constitute a vocabulary for describing how concepts move between systems. This is the operational layer of ontology alignment: not declaring what things mean, but declaring how to translate between systems that mean different things.

### 1.6 References Spec -- Contextual Knowledge Binding

The References specification (`specs/core/references-spec.md`) adds another ontological layer by binding external knowledge to form items:

```json
{
  "target": "budget.personnel",
  "type": "regulation",
  "audience": "both",
  "title": "2 CFR 200 Subpart E - Cost Principles",
  "uri": "https://ecfr.gov/..."
}
```

Reference types include `regulation`, `policy`, `glossary`, `schema`, `vector-store`, `knowledge-base`. The `glossary` type is overtly ontological -- it is a term definition set. The `schema` type links form items to external data dictionaries. These are semantic annotations that connect form fields to the knowledge domain they participate in.

### 1.7 Variables, Binds, and Implicit Relations

FEL expressions in binds and variables encode implicit ontological relationships:

```
"calculate": "$quantity * $unitPrice"
```

This declares that `total` is functionally dependent on `quantity` and `unitPrice`. In ontological terms, this is a derived property -- its value is determined by a rule over other properties. The dependency graph that the processing model builds from these expressions is a directed acyclic graph of property relationships, which is itself a lightweight ontological structure.

Repeat groups encode multiplicity relationships: "a grant application has many budget line items." Nested groups encode composition: "each line item has a description, quantity, and unit price." These are `hasMany` and `hasPart` relationships expressed structurally rather than declared semantically.

### 1.8 `derivedFrom` and Version Lineage

The `derivedFrom` property creates lineage relationships between form definitions:

```json
"derivedFrom": {
  "url": "https://example.gov/forms/generic-application-template",
  "version": "2.0.0"
}
```

Combined with the changelog spec's structural diff system (`change.type`: added/removed/modified/moved/renamed, `change.impact`: breaking/compatible/cosmetic), formspec already has a formal model for ontological evolution -- how a data model changes over time, what those changes mean, and whether they break backward compatibility.

---

## 2. Ontological Foundations -- What Formspec Already IS

### 2.1 Every Form Definition IS an Ontology

This is the central insight. A Formspec definition is not merely a UI specification; it is a self-contained, versioned, machine-readable data model with:

- **Concepts** (items with keys, labels, descriptions)
- **Properties** (fields with data types, constraints)
- **Relationships** (groups composing fields, FEL references between fields)
- **Cardinality** (repeatable groups with minRepeat/maxRepeat)
- **Constraints** (binds, shapes -- rules about valid states)
- **Derived properties** (calculate binds)
- **Conditional existence** (relevance binds)
- **Controlled vocabularies** (option sets)
- **Identity and versioning** (url + version tuple)
- **Provenance** (derivedFrom)

Compare this to OWL:

| OWL Concept | Formspec Equivalent |
|---|---|
| Class | Group item |
| DataProperty | Field item (with dataType) |
| ObjectProperty | FEL reference / nested group |
| Restriction (min/max cardinality) | minRepeat/maxRepeat |
| DataRange (enumeration) | Options / optionSet |
| Individual | A single response entry |
| Annotation | label, description, hint, semanticType |

The gap is not in the primitives but in the formal semantics. OWL declares "Person hasProperty dateOfBirth with range xsd:date" and that declaration is machine-interpretable by any reasoner. Formspec declares `{ "key": "dateOfBirth", "dataType": "date" }` and that declaration is machine-interpretable by any form processor. The structural information is equivalent; the interpretive framework differs.

### 2.2 Fields Have Types but Lack Semantics

Formspec distinguishes syntactic type (dataType) from domain meaning (semanticType), but the distinction is advisory. Both `dateOfBirth` and `reportingDate` are `"dataType": "date"`. The semantic difference -- one is an immutable biographical fact, the other is a mutable administrative marker -- is captured only in labels and variable names, which are opaque to processors.

The `semanticType` property acknowledges this gap but does not close it. `"semanticType": "ietf:email"` is a free-text string. Nothing prevents someone from writing `"semanticType": "email"` or `"semanticType": "electronic-mail"` or `"semanticType": "https://schema.org/email"`. The lack of controlled vocabulary for semantic types means the annotation cannot drive reliable machine behavior.

### 2.3 Extensions as Type Refinement

The extension system is the closest thing formspec has to a type hierarchy with behavioral implications. When a field declares `"extensions": { "x-formspec-email": true }`, and the registry defines `x-formspec-email` with a base type of `string` and constraints of `{ "pattern": "..." }`, the processor applies the refinement. This is subtype polymorphism: an email is a string with additional constraints.

But it is only one level deep. There is no mechanism for `x-org-work-email` to extend `x-formspec-email`, adding the constraint that the domain must be `@org.example.com`. Extension composition is not specified.

### 2.4 Mapping as Ontology Alignment (Already)

The mapping spec's `valueMap` transform is literally a function between concept systems. Its `coerce` transform is type system bridging. Its `expression` transform is arbitrary computation at the semantic boundary. Its bidirectional support (`direction: "both"`) models concept equivalence -- the assertion that the same information can be expressed in two systems.

The distinction between reversible and non-reversible transforms is deeply ontological. A `preserve` (identity) mapping says the concept is the same. A lossy `coerce` (datetime to date) says information is lost in translation. A non-bijective `valueMap` says the target ontology has coarser granularity than the source. The mapping spec already speaks the language of ontology alignment; it just does not use the terminology.

---

## 3. Creative Possibilities -- What Formspec Could Become

### 3.1 Semantic Field Annotations with IRIs

The simplest extension: give `semanticType` structure.

**Current state:**
```json
{ "key": "ein", "semanticType": "us-gov:ein" }
```

**Possibility:**
```json
{
  "key": "ein",
  "semanticType": {
    "concept": "https://www.irs.gov/terms/employer-identification-number",
    "system": "https://www.irs.gov/terms",
    "display": "Employer Identification Number",
    "equivalents": [
      { "system": "https://schema.org", "code": "taxID" },
      { "system": "urn:fhir:sid/us-ein", "code": "EIN" }
    ]
  }
}
```

This is what FHIR calls a `Coding` -- a concept bound to a code system with optional cross-system equivalences. The power is that two independently authored forms can now be mechanically determined to collect the same concept, even if their field keys, labels, and internal names differ.

The equivalence declarations are precisely what the mapping spec needs to auto-generate rules. If Form A's `employerTaxId` and Form B's `ein` both declare `"concept": "https://www.irs.gov/terms/employer-identification-number"`, a mapping between them can be synthesized automatically for `preserve`-type fields.

### 3.2 Form-as-Ontology Export

A formspec definition contains enough structural information to generate an OWL ontology, an RDF vocabulary, or a JSON-LD context automatically.

Given:
```json
{
  "key": "lineItems",
  "type": "group",
  "repeatable": true,
  "children": [
    { "key": "description", "dataType": "string" },
    { "key": "amount", "dataType": "money" },
    { "key": "category", "dataType": "choice", "optionSet": "budgetCategories" }
  ]
}
```

A generator could produce:

```turtle
form:LineItem a owl:Class ;
    rdfs:label "Line Item" ;
    rdfs:subClassOf [
        a owl:Restriction ;
        owl:onProperty form:description ;
        owl:cardinality 1
    ] , [
        a owl:Restriction ;
        owl:onProperty form:amount ;
        owl:cardinality 1
    ] , [
        a owl:Restriction ;
        owl:onProperty form:category ;
        owl:someValuesFrom form:BudgetCategory
    ] .

form:description a owl:DatatypeProperty ;
    rdfs:range xsd:string .

form:amount a owl:DatatypeProperty ;
    rdfs:range form:Money .

form:BudgetCategory a owl:Class ;
    owl:oneOf (form:travel form:supplies form:equipment) .
```

Or a JSON-LD context:
```json
{
  "@context": {
    "lineItems": { "@id": "form:lineItems", "@container": "@list" },
    "description": "form:description",
    "amount": { "@id": "form:amount", "@type": "form:Money" },
    "category": { "@id": "form:category", "@type": "@vocab" }
  }
}
```

This is not merely academic. A JSON-LD context derived from a form definition means that form responses become linked data artifacts automatically. They can be ingested by SPARQL endpoints, merged with other RDF datasets, and reasoned about.

### 3.3 Ontology-Driven Form Generation

The inverse of 3.2: given an external ontology, generate a formspec definition.

Given a FHIR StructureDefinition for Patient:
```
Patient.name (0..*) : HumanName
Patient.name.given (0..*) : string
Patient.name.family (0..1) : string
Patient.birthDate (0..1) : date
Patient.gender (0..1) : code [AdministrativeGender]
```

A generator could produce:
```json
{
  "items": [
    {
      "type": "group", "key": "name", "repeatable": true,
      "children": [
        { "key": "given", "dataType": "string", "semanticType": "fhir:Patient.name.given" },
        { "key": "family", "dataType": "string", "semanticType": "fhir:Patient.name.family" }
      ]
    },
    { "key": "birthDate", "dataType": "date", "semanticType": "fhir:Patient.birthDate" },
    {
      "key": "gender", "dataType": "choice",
      "semanticType": "fhir:Patient.gender",
      "options": [
        { "value": "male", "label": "Male" },
        { "value": "female", "label": "Female" },
        { "value": "other", "label": "Other" },
        { "value": "unknown", "label": "Unknown" }
      ]
    }
  ]
}
```

With the `semanticType` annotations, the form is self-documenting about its conceptual origins. A mapping document back to FHIR becomes trivially generatable because the semantic bridge is already declared.

This is how FHIR Questionnaire's `item.definition` property works -- it links a question item to an ElementDefinition in a StructureDefinition, allowing the question to inherit type, cardinality, and value set constraints. Formspec could support the same pattern without coupling to FHIR's type system.

### 3.4 Vocabulary Binding for Choice Fields

Option sets are currently flat lists. But many real-world value domains are hierarchical taxonomies:

- **ICD-10**: A00-B99 (Certain infectious diseases) > A00-A09 (Intestinal infectious diseases) > A00 (Cholera) > A00.0 (Cholera due to Vibrio cholerae)
- **NAICS**: 11 (Agriculture) > 111 (Crop Production) > 1111 (Oilseed and Grain Farming) > 11111 (Soybean Farming)
- **MeSH**: D01 (Inorganic Chemicals) > D01.045 (Acids) > D01.045.075 (Amino Acids)

A vocabulary-bound option set could declare:

```json
{
  "optionSets": {
    "diagnosisCodes": {
      "vocabulary": {
        "system": "http://hl7.org/fhir/sid/icd-10",
        "version": "2024",
        "display": "ICD-10-CM"
      },
      "source": "formspec-fn:lookupICD10",
      "hierarchical": true,
      "filter": {
        "ancestor": "F00-F99",
        "maxDepth": 3
      },
      "valueField": "code",
      "labelField": "display"
    }
  }
}
```

The `vocabulary` property binds the option set to an external terminology system. The `hierarchical` flag tells renderers to present a tree picker or cascading dropdown. The `filter` constrains which portion of the vocabulary is relevant (mental health diagnoses only). The `source` provides the lookup mechanism.

This pattern already has a natural extension point: `"vocabulary"` could be a new property on the `OptionSet` schema that augments rather than replaces the existing `options`/`source` mechanism.

### 3.5 Cross-Form Semantic Alignment

The most powerful ontological capability would be the ability to declare that two independently authored forms collect the same information. Today, this requires manual inspection and mapping document authoring. With semantic annotations, it becomes automatable.

Consider two forms:

**Form A (Federal grant application):**
```json
{ "key": "orgEIN", "semanticType": "https://irs.gov/terms/ein" }
```

**Form B (State compliance report):**
```json
{ "key": "taxIdentifier", "semanticType": "https://irs.gov/terms/ein" }
```

A tooling pipeline could:
1. Index all fields by `semanticType` across a corpus of definitions
2. Identify concept overlap between forms
3. Auto-generate mapping documents for cross-form data transfer
4. Flag conceptual gaps (Form B requires data that Form A does not collect)

This is exactly what the mapping spec's `targetSchema.url` hints at but does not formalize. A formspec ecosystem with rich semantic annotations becomes a discoverable, queryable network of data collection instruments rather than an isolated collection of JSON documents.

### 3.6 Data Lineage via Mapping Chains

The mapping spec already models one-hop data lineage: "this field in the form came from / goes to this path in an external system." But real data flows are multi-hop:

```
FHIR EHR  --mapping--> Formspec Form A  --mapping--> Grant Reporting CSV
                                          --mapping--> State DB API
```

If mapping documents are composable (the output of one mapping becomes the input of another), then a data lineage graph emerges automatically. Each field in the final CSV can trace its provenance back through a chain of mapping rules to its original source.

The formspec response already pins to a definition version. A mapping document pins to a definition version range. Chain these, and you have end-to-end data lineage with version compatibility checking at every link.

### 3.7 Semantic Validation

Today, formspec validation checks structural constraints (type, pattern, cardinality) and FEL-expressible business rules. Semantic validation would check domain-level correctness:

- A field annotated as `semanticType: "icd10"` could validate that the entered code is a real ICD-10 code (not just a string matching a pattern)
- A field annotated as `semanticType: "iso:country-alpha2"` could validate against the actual ISO 3166-1 list
- Cross-field semantic validation: if `diagnosisCode` starts with "Z" (ICD-10 Factors influencing health status), then `clinicalSetting` should not be "emergency"

This could work through the existing extension mechanism. A registry entry for `x-org-icd10` could declare a `validate` function category extension that performs server-side concept validation, returning results through the existing `source: "external"` validation pathway.

### 3.8 Knowledge Graph Integration

Form responses, when semantically annotated, become nodes in a knowledge graph:

```turtle
response:R001 a form:GrantApplication ;
    form:hasApplicant [
        a schema:Organization ;
        schema:taxID "12-3456789" ;
        schema:name "Research Institute" ;
        schema:email "grants@research.example"
    ] ;
    form:hasBudget [
        form:hasBudgetItem [
            form:category "personnel" ;
            form:amount [ a form:Money ; form:value "50000.00" ; form:currency "USD" ]
        ]
    ] ;
    form:pinnedTo <https://example.gov/forms/grant-application|1.0.0> .
```

If responses carry semantic annotations (via the definition's semantic types and a JSON-LD context), they can be ingested into triple stores and queried across forms:

```sparql
SELECT ?org ?totalBudget WHERE {
    ?response a form:GrantApplication ;
        form:hasApplicant/schema:name ?org ;
        form:hasBudget/form:hasBudgetItem/form:amount/form:value ?amount .
} GROUP BY ?org HAVING (SUM(?amount) AS ?totalBudget)
```

This query works across all grant application responses, regardless of form version, because the semantic annotations provide stable concept identifiers that survive version evolution.

### 3.9 Data Contracts

Formspec definitions, extended with semantic annotations, become machine-readable data contracts between systems. A downstream system can declare: "I require a response conforming to this definition, and I expect the following semantic types to be present." The contract is verifiable before any data flows.

```json
{
  "contract": {
    "consumer": "https://reporting.agency.gov",
    "requires": {
      "definition": "https://example.gov/forms/grant-application",
      "version": ">=1.0.0 <2.0.0",
      "requiredConcepts": [
        "https://irs.gov/terms/ein",
        "https://sam.gov/terms/uei",
        "https://grants.gov/terms/cfda-number"
      ]
    }
  }
}
```

A linter could verify that a definition satisfies a data contract by checking that fields with the required `semanticType` values exist and have compatible data types. If a new version of the form removes a required concept, the changelog spec's impact classification flags it as breaking. The contract, the definition, and the changelog interlock.

---

## 4. The Mapping Spec as Ontology Bridge

### 4.1 Bidirectional Mapping as Ontology Equivalence

The mapping spec's `direction: "both"` with reversible transforms declares bidirectional concept equivalence. When a `preserve` rule maps `sourcePath: "name"` to `targetPath: "name"`, it asserts identity -- the concept is the same in both systems. When a `valueMap` maps `{ "male": "M" }`, it asserts terminological equivalence with different representations.

This could be formalized. A mapping document could carry optional `alignmentType` metadata on each rule:

| Alignment Type | Meaning | Mapping Implication |
|---|---|---|
| `exact` | Identical concept | `preserve` |
| `narrower` | Source is more specific | Forward: safe; Reverse: may lose specificity |
| `broader` | Source is more general | Forward: may lose specificity; Reverse: safe |
| `related` | Related but not equivalent | Requires `expression` or `valueMap` |
| `noMatch` | No corresponding concept | `drop` or `constant` |

These alignment types come directly from SKOS (Simple Knowledge Organization System), the W3C standard for concept alignment. Annotating mapping rules with SKOS alignment types would make formspec mappings interoperable with the semantic web's concept alignment infrastructure.

### 4.2 Value Maps as Concept Alignment Tables

The `valueMap` transform is already a lookup table between two code systems. Extending it to reference external concept alignment resources would connect formspec to institutional terminology management:

```json
{
  "sourcePath": "severity",
  "targetPath": "ctcae_grade",
  "transform": "valueMap",
  "valueMap": {
    "forward": { "mild": "1", "moderate": "2", "severe": "3", "critical": "4" },
    "terminology": {
      "source": { "system": "urn:formspec:option/eventSeverities", "version": "1.0" },
      "target": { "system": "https://ctcae.cancer.gov", "version": "5.0" }
    }
  }
}
```

The `terminology` property makes the implicit explicit: this value map is not an arbitrary translation table but an alignment between two identified terminologies. This metadata enables:
- Version tracking of terminology alignments
- Automated revalidation when terminologies update
- Discovery of existing alignment tables in terminology servers

### 4.3 Coercion as Type System Bridging

The `coerce` transform already handles structural type conversion (string to number, date to string with format). But type bridging in an ontological context also involves semantic type conversion:

- A `money` field in formspec (composite `{amount, currency}`) coerced to a FHIR `Money` resource (which has `value` and `code`)
- A US phone number (`(202) 555-0100`) coerced to E.164 format (`+12025550100`)
- A date in `MM/DD/YYYY` format coerced to ISO 8601

The first case is structural. The second is format normalization within the same semantic domain. The third is format normalization with potential ambiguity (is `01/02/2025` January 2nd or February 1st?). An ontology-aware coercion system would distinguish these cases and handle ambiguity explicitly.

### 4.4 External Ontology References in Mapping Documents

The `targetSchema` property could carry an optional `ontology` reference:

```json
{
  "targetSchema": {
    "format": "json",
    "name": "FHIR Patient R4",
    "url": "https://hl7.org/fhir/R4/patient.schema.json",
    "ontology": {
      "type": "fhir-structure-definition",
      "uri": "https://hl7.org/fhir/R4/StructureDefinition/Patient",
      "profile": ["https://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
    }
  }
}
```

This makes the mapping target not just a data format but a formal data model with machine-readable semantics. Processors that understand FHIR StructureDefinitions could validate mapping rules against the target model's type constraints, cardinalities, and value set bindings.

---

## 5. Concrete Use Cases

### 5.1 Healthcare: Patient Intake to FHIR + CSV

A hospital intake form collects patient demographics. The form definition includes semantic annotations:

```json
{
  "key": "mrn",
  "dataType": "string",
  "semanticType": {
    "concept": "http://terminology.hl7.org/CodeSystem/v2-0203#MR",
    "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
    "display": "Medical Record Number"
  },
  "extensions": { "x-org-mrn": true }
}
```

Two mapping documents co-exist:
- **FHIR mapping**: Transforms the response into a FHIR Patient resource with proper resource type, coding system references, and extension URLs
- **CSV mapping**: Flattens the response into a registry CSV for state health department reporting

The semantic annotations ensure that the `mrn` field maps correctly in both targets: to `Patient.identifier` in FHIR (with the correct system URI) and to `medical_record_number` in the CSV (with proper column naming). The form, through its annotations and mappings, serves as the single source of truth for how patient data flows between systems.

### 5.2 Research: Survey with DDI Metadata

A social science survey needs its data to be reproducible and discoverable. Each question is annotated with DDI (Data Documentation Initiative) metadata:

```json
{
  "key": "education",
  "dataType": "choice",
  "semanticType": {
    "concept": "https://ddi-cdi.github.io/ddi-cdi/concepts#EducationalAttainment",
    "system": "https://ddi-cdi.github.io/ddi-cdi"
  },
  "optionSet": "educationLevels"
}
```

The `educationLevels` option set is bound to a standard vocabulary:

```json
{
  "educationLevels": {
    "vocabulary": {
      "system": "https://www.census.gov/topics/education/data/tables.html",
      "version": "2020"
    },
    "options": [
      { "value": "less_than_hs", "label": "Less than high school" },
      { "value": "hs_diploma", "label": "High school diploma or GED" }
    ]
  }
}
```

The references document attaches the study protocol, IRB approval, and codebook:

```json
{
  "references": [
    {
      "target": "#",
      "type": "documentation",
      "audience": "human",
      "title": "Study Protocol v2.1",
      "uri": "https://irb.university.edu/protocols/2025-0042.pdf"
    },
    {
      "target": "education",
      "type": "glossary",
      "audience": "both",
      "content": { "term": "Educational Attainment", "definition": "The highest level of education completed." }
    }
  ]
}
```

When the survey response is exported, the semantic annotations, vocabulary bindings, and references combine to produce a DDI-compliant metadata record that other researchers can discover, understand, and reuse.

### 5.3 Government: Regulatory Data Elements

A federal permit form where each field maps to a data element in a regulatory data dictionary:

```json
{
  "key": "facilityName",
  "dataType": "string",
  "semanticType": {
    "concept": "urn:epa:frs:FacilityName",
    "system": "urn:epa:frs",
    "display": "Facility Name"
  }
}
```

A data contract declares that the state reporting system requires specific regulatory data elements. The linter validates the form against the contract before deployment. If a new version of the form removes `facilityName`, the changelog classifies it as a breaking change, and the data contract check fails.

The References document attaches the relevant CFR section to each field, so form fillers see the regulatory requirement alongside the input. The AI agent uses the same reference to validate that the user's answer is consistent with the regulation.

### 5.4 Enterprise: CRM/ERP Population

An enterprise customer onboarding form semantically annotates fields with Salesforce and SAP equivalents:

```json
{
  "key": "companyName",
  "semanticType": {
    "concept": "https://schema.org/legalName",
    "equivalents": [
      { "system": "salesforce", "code": "Account.Name" },
      { "system": "sap", "code": "BP_HEADER.BU_SORT1" }
    ]
  }
}
```

Mapping documents for each target system can reference these annotations to auto-generate preserve rules for identity-mapped fields and flag fields that require transformation.

---

## 6. What Makes Formspec Unique Here

### 6.1 vs. XForms (W3C)

XForms has the same MVC architecture and reactive processing model, but it is XML-native. Its data model is an XML document navigated by XPath. Ontological annotation in XForms requires out-of-band RDF/OWL documents with no formal connection to the form model. XForms' submission mechanism sends XML -- integration with JSON APIs, REST services, and modern data platforms requires translation.

Formspec's JSON-nativeness is a fundamental advantage. JSON is the lingua franca of modern APIs, databases, and data pipelines. A semantically annotated formspec response is already 80% of the way to a JSON-LD document. XForms responses require a full XML-to-JSON transformation before they can participate in modern data ecosystems.

### 6.2 vs. FHIR Questionnaire

FHIR Questionnaire is the most mature form-as-data-model standard, but it is locked to the FHIR ecosystem. Every concept is expressed in FHIR's type system. Value sets are FHIR ValueSet resources resolved via FHIR terminology services. Extraction produces FHIR resources. The `item.definition` property links to FHIR StructureDefinitions.

Formspec can interoperate with FHIR (the mapping spec example demonstrates this) without being bound to it. The same form can produce FHIR, CSV, and XML outputs. The semantic annotation system, if extended, could reference FHIR terminologies alongside schema.org, DDI, EPA identifiers, and any other concept system. Formspec is ontology-agnostic by design; FHIR Questionnaire is ontology-committed.

FHIR's `item.definition` is, however, a specific idea worth stealing. It lets a question inherit type constraints and value set bindings from an external data model. An equivalent in formspec -- `"definedBy": "https://hl7.org/fhir/R4/StructureDefinition/Patient#Patient.birthDate"` -- would be a powerful tool for generating forms from external schemas and maintaining semantic alignment as schemas evolve.

### 6.3 vs. JSON Schema

JSON Schema validates structure. It answers "is this document shaped correctly?" Formspec answers "is this data behaviorally correct?" -- with conditional requirements, cross-field constraints, calculated values, and stateful validation (non-relevant field handling).

More importantly, JSON Schema has no concept of a response distinct from the schema itself. A JSON Schema validates a JSON document; there is no notion of "a document in progress" with partial validity, deferred validation, and save-without-valid. Formspec's response model, with its status lifecycle (in-progress, completed, amended, stopped) and distinction between errors (block completion) and warnings (do not block), is a fundamentally richer model for real-world data collection.

In ontological terms: JSON Schema is a static shape constraint. Formspec is a dynamic behavioral model. The two are complementary -- formspec uses JSON Schema for its own structural validation -- but they operate at different levels of abstraction.

### 6.4 vs. OWL/SHACL

OWL and SHACL are general-purpose ontology and constraint languages. They operate on RDF graphs and are designed for open-world reasoning. Formspec operates on JSON trees with closed-world semantics (a field not in the definition is an error, not an unknown).

Formspec's SHACL heritage is visible in its validation shapes -- named, composable, severity-leveled validation rules with structured results. But formspec shapes are simpler than SHACL shapes because they operate on a fixed, known data structure (the form's item tree) rather than an arbitrary RDF graph.

The key differentiator: formspec is an authoring and data collection tool. OWL/SHACL are description and reasoning tools. Formspec could emit OWL/SHACL from its definitions, and it could consume OWL/SHACL to generate definitions, but it would never replace them in their home domain (open-world knowledge representation and reasoning).

### 6.5 Formspec's Unique Position

Formspec sits at an intersection no other tool occupies: **a declarative, JSON-native form standard with a built-in expression language, composable validation, bidirectional data transformation, and an extension type system -- all versioned and machine-readable.**

This means formspec can be the operational bridge between domain ontologies (which describe what data means) and data systems (which store and process data). The form definition is the human-facing interface to the ontology: it translates abstract concepts into concrete fields that people can fill in, with validation that enforces the ontology's constraints, and mappings that route the collected data into the systems that need it.

No other form technology has all of these pieces in one coherent stack. XForms has the processing model but not the mapping layer. FHIR Questionnaire has the semantic annotations but is domain-locked. JSON Schema has the structural validation but not the behavioral model. OWL/SHACL have the ontological expressiveness but are not data collection tools.

---

## 7. What Would It Mean for Every Form to Be a First-Class Ontological Artifact?

If formspec embraced its ontological nature deliberately, every form definition would be simultaneously:

1. **A data collection instrument** (what it is today)
2. **A data model** (implicit today, could be explicit)
3. **A concept registry** (each field annotated with stable concept identifiers)
4. **A vocabulary publisher** (option sets bound to external terminologies)
5. **An alignment declaration** (mapping documents as formal ontology bridges)
6. **A data contract** (the definition as a machine-readable promise about what data looks like)
7. **A lineage node** (derivedFrom + mappings + changelogs as provenance chain)

The technical changes required are modest:
- Structured `semanticType` (concept IRI + system + display + equivalents)
- Optional `vocabulary` binding on option sets
- Optional `definedBy` on field items (link to external schema element)
- Alignment type annotation on mapping rules
- JSON-LD context generation from annotated definitions

The conceptual shift is larger: seeing form definitions not as throwaway UI configurations but as first-class knowledge artifacts that participate in an organization's data architecture. Every form becomes a node in a network of data contracts, every response becomes a graph-ready data record, and every mapping becomes a declared semantic bridge.

The infrastructure for this is already present in formspec's design. The extension system, the mapping spec, the references spec, the changelog spec, and the versioning model all point toward a future where forms are not just how you collect data but how you define what that data means.
