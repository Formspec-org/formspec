# Implementation Plan: Clinical Intake Survey with Screener

> [!IMPORTANT]
> This example is the **feature mop-up** — it covers every remaining framework feature that neither the Grant Report nor the Invoice touches: screener routing, nested repeats, secondary instances, FEL advanced features (let, prev/next, countWhere), demand-timing shapes, attachments, date functions, pre-population, disabledDisplay, remoteOptions, and extension functions/constraints.

## Directory Structure

```
examples/clinical-intake/
├── intake.definition.json             # Full definition with screener + nested repeats
├── intake.component.json              # Component doc with wizard + conditional sections
├── intake.theme.json                  # Healthcare-themed styling
├── instances/
│   ├── patient.instance.json          # Pre-population data (secondary instance)
│   └── drug-database.instance.json    # Medication lookup data (secondary instance)
└── fixtures/
    ├── screener-emergency.response.json   # Screener routes to emergency
    ├── screener-routine.response.json     # Screener routes to main form
    ├── intake-empty.response.json         # Main form, no data
    ├── intake-partial.response.json       # Pre-populated + partial entry
    ├── intake-complete.response.json      # Fully completed with nested repeats
    ├── intake-nested-repeat.response.json # Multiple conditions with multiple meds each
    └── intake-demand-shape.response.json  # Demand-timing shape evaluation results
```

---

## Phase 1: Definition (`intake.definition.json`)

### 1.1 Identity & Metadata

```json
{
  "$formspec": "1.0",
  "url": "https://formspec.org/examples/clinical-intake",
  "version": "1.0.0",
  "status": "active",
  "title": "Clinical Intake Survey",
  "name": "clinical-intake",
  "description": "Patient intake form with triage screener, medical history with nested repeats, and clinical assessment.",
  "extensions": ["x-formspec-common"],
  "nonRelevantBehavior": "keep",
  "formPresentation": {
    "pageMode": "wizard",
    "labelPosition": "top",
    "density": "comfortable"
  }
}
```

> [!NOTE]
> `nonRelevantBehavior: "keep"` is deliberate — clinical forms should preserve all captured data even for non-relevant sections, for audit trail purposes. This contrasts with the Grant Report's default `"remove"` behavior.

### 1.2 Screener

The screener runs **before** the main form, routing to different targets based on triage answers.

```json
{
  "screener": {
    "items": [
      {
        "key": "chiefComplaint",
        "type": "field",
        "dataType": "choice",
        "label": "What is the primary reason for your visit?",
        "options": [
          { "value": "acute", "label": "Acute illness or injury" },
          { "value": "chronic", "label": "Chronic condition management" },
          { "value": "preventive", "label": "Preventive care / checkup" },
          { "value": "emergency", "label": "Emergency symptoms" }
        ]
      },
      {
        "key": "painLevel",
        "type": "field",
        "dataType": "integer",
        "label": "Current pain level (0-10)",
        "hint": "0 = no pain, 10 = worst possible pain"
      }
    ],
    "routes": [
      {
        "condition": "$chiefComplaint = 'emergency' or $painLevel >= 8",
        "target": "https://formspec.org/examples/emergency-intake",
        "label": "Route to Emergency Intake"
      },
      {
        "condition": "$chiefComplaint = 'acute' and $painLevel >= 5",
        "target": "https://formspec.org/examples/urgent-intake",
        "label": "Route to Urgent Care Intake"
      },
      {
        "condition": "true",
        "target": "https://formspec.org/examples/clinical-intake",
        "label": "Continue to Standard Intake"
      }
    ]
  }
}
```

> [!IMPORTANT]
> Screener items are **NOT** part of the form's instance data or response. They exist solely for routing. The `condition: "true"` route is the default fallback (first matching route wins).

### 1.3 Instances (Secondary Data Sources)

```json
{
  "instances": {
    "patient": {
      "description": "Pre-populated patient demographics from EHR",
      "source": "formspec-fn:lookupPatient",
      "static": false,
      "readonly": true,
      "schema": {
        "firstName": "string",
        "lastName": "string",
        "dob": "date",
        "sex": "string",
        "phone": "string",
        "email": "string",
        "insuranceMemberId": "string"
      }
    },
    "drugDatabase": {
      "description": "Common medications lookup table",
      "static": true,
      "readonly": true,
      "data": [
        { "name": "Lisinopril", "class": "ACE Inhibitor", "commonDosages": ["5mg", "10mg", "20mg", "40mg"] },
        { "name": "Metformin", "class": "Biguanide", "commonDosages": ["500mg", "850mg", "1000mg"] },
        { "name": "Atorvastatin", "class": "Statin", "commonDosages": ["10mg", "20mg", "40mg", "80mg"] },
        { "name": "Omeprazole", "class": "PPI", "commonDosages": ["20mg", "40mg"] },
        { "name": "Amlodipine", "class": "CCB", "commonDosages": ["2.5mg", "5mg", "10mg"] }
      ]
    }
  }
}
```

### 1.4 Items (Structure Layer)

#### Patient Information (Pre-populated)

```json
{
  "key": "patient",
  "type": "group",
  "label": "Patient Information",
  "children": [
    {
      "key": "firstName",
      "type": "field",
      "dataType": "string",
      "label": "First Name",
      "prePopulate": {
        "instance": "patient",
        "path": "firstName",
        "editable": false
      }
    },
    {
      "key": "lastName",
      "type": "field",
      "dataType": "string",
      "label": "Last Name",
      "prePopulate": {
        "instance": "patient",
        "path": "lastName",
        "editable": false
      }
    },
    {
      "key": "dob",
      "type": "field",
      "dataType": "date",
      "label": "Date of Birth",
      "prePopulate": {
        "instance": "patient",
        "path": "dob",
        "editable": false
      }
    },
    {
      "key": "age",
      "type": "field",
      "dataType": "integer",
      "label": "Age"
    },
    {
      "key": "sex",
      "type": "field",
      "dataType": "choice",
      "label": "Sex",
      "options": [
        { "value": "male", "label": "Male" },
        { "value": "female", "label": "Female" },
        { "value": "other", "label": "Other" }
      ],
      "prePopulate": {
        "instance": "patient",
        "path": "sex",
        "editable": false
      }
    },
    {
      "key": "phone",
      "type": "field",
      "dataType": "string",
      "label": "Phone",
      "extensions": { "x-formspec-phone": true },
      "prePopulate": {
        "instance": "patient",
        "path": "phone",
        "editable": true
      }
    },
    {
      "key": "email",
      "type": "field",
      "dataType": "string",
      "label": "Email",
      "extensions": { "x-formspec-email": true },
      "prePopulate": {
        "instance": "patient",
        "path": "email",
        "editable": true
      }
    },
    {
      "key": "insuranceMemberId",
      "type": "field",
      "dataType": "string",
      "label": "Insurance Member ID",
      "prePopulate": {
        "instance": "patient",
        "path": "insuranceMemberId",
        "editable": false
      }
    },
    {
      "key": "insuranceCard",
      "type": "field",
      "dataType": "attachment",
      "label": "Insurance Card (photo)",
      "hint": "Upload a photo of the front of your insurance card"
    }
  ]
}
```

> [!NOTE]
> `prePopulate` with `editable: false` creates an implicit `readonly` bind — the field is pre-filled from the instance and cannot be modified. Combined with `disabledDisplay: "protected"` in the bind, the field renders as visible but grayed out.

#### Symptoms & Current Visit

```json
{
  "key": "currentVisit",
  "type": "group",
  "label": "Current Visit",
  "children": [
    {
      "key": "symptoms",
      "type": "field",
      "dataType": "multiChoice",
      "label": "Current Symptoms",
      "options": [
        { "value": "fever", "label": "Fever" },
        { "value": "cough", "label": "Cough" },
        { "value": "headache", "label": "Headache" },
        { "value": "fatigue", "label": "Fatigue" },
        { "value": "pain", "label": "Pain" },
        { "value": "nausea", "label": "Nausea" },
        { "value": "dizziness", "label": "Dizziness" },
        { "value": "other", "label": "Other" }
      ]
    },
    {
      "key": "otherSymptoms",
      "type": "field",
      "dataType": "text",
      "label": "Describe other symptoms"
    },
    {
      "key": "onsetDate",
      "type": "field",
      "dataType": "date",
      "label": "When did symptoms begin?"
    },
    {
      "key": "onsetTime",
      "type": "field",
      "dataType": "time",
      "label": "Approximate time of onset"
    },
    {
      "key": "appointmentDateTime",
      "type": "field",
      "dataType": "dateTime",
      "label": "Preferred appointment date/time"
    }
  ]
}
```

#### Medical History — Nested Repeat Groups

```json
{
  "key": "medicalHistory",
  "type": "group",
  "label": "Medical History",
  "children": [
    {
      "key": "hasAllergies",
      "type": "field",
      "dataType": "boolean",
      "label": "Do you have any known allergies?"
    },
    {
      "key": "allergies",
      "type": "field",
      "dataType": "text",
      "label": "List all known allergies"
    },
    {
      "key": "conditions",
      "type": "group",
      "label": "Active Medical Conditions",
      "repeatable": true,
      "minRepeat": 0,
      "maxRepeat": 20,
      "children": [
        {
          "key": "name",
          "type": "field",
          "dataType": "string",
          "label": "Condition Name"
        },
        {
          "key": "diagnosedDate",
          "type": "field",
          "dataType": "date",
          "label": "Date Diagnosed"
        },
        {
          "key": "severity",
          "type": "field",
          "dataType": "choice",
          "label": "Severity",
          "optionSet": "severityLevels"
        },
        {
          "key": "medications",
          "type": "group",
          "label": "Medications for this condition",
          "repeatable": true,
          "minRepeat": 0,
          "maxRepeat": 10,
          "children": [
            {
              "key": "drugName",
              "type": "field",
              "dataType": "string",
              "label": "Medication Name"
            },
            {
              "key": "dosage",
              "type": "field",
              "dataType": "string",
              "label": "Dosage"
            },
            {
              "key": "frequency",
              "type": "field",
              "dataType": "choice",
              "label": "Frequency",
              "options": [
                { "value": "daily", "label": "Once daily" },
                { "value": "bid", "label": "Twice daily" },
                { "value": "tid", "label": "Three times daily" },
                { "value": "qid", "label": "Four times daily" },
                { "value": "prn", "label": "As needed" },
                { "value": "weekly", "label": "Weekly" }
              ]
            },
            {
              "key": "startDate",
              "type": "field",
              "dataType": "date",
              "label": "Started"
            }
          ]
        }
      ]
    }
  ]
}
```

> [!IMPORTANT]
> **Nested repeats**: `conditions[*].medications[*]` — this is 2 levels of repeat nesting. Each condition can have multiple medications. This exercises the most complex structural pattern in the engine: adding/removing at either level triggers Phase 1 (rebuild), signal initialization cascades through both levels, and `@current`/`@index` resolve at the inner level.

#### Assessment / Summary

```json
{
  "key": "assessment",
  "type": "group",
  "label": "Clinical Assessment",
  "children": [
    {
      "key": "totalConditions",
      "type": "field",
      "dataType": "integer",
      "label": "Total Active Conditions"
    },
    {
      "key": "severeConditionCount",
      "type": "field",
      "dataType": "integer",
      "label": "Severe Conditions"
    },
    {
      "key": "totalMedications",
      "type": "field",
      "dataType": "integer",
      "label": "Total Medications"
    },
    {
      "key": "symptomDuration",
      "type": "field",
      "dataType": "integer",
      "label": "Days Since Symptom Onset"
    },
    {
      "key": "maskedInsuranceId",
      "type": "field",
      "dataType": "string",
      "label": "Insurance ID (masked)"
    },
    {
      "key": "riskSummary",
      "type": "display",
      "label": "Risk Assessment Summary"
    }
  ]
}
```

### 1.5 Option Sets

```json
{
  "optionSets": {
    "severityLevels": [
      { "value": "mild", "label": "Mild" },
      { "value": "moderate", "label": "Moderate" },
      { "value": "severe", "label": "Severe" },
      { "value": "critical", "label": "Critical" }
    ]
  }
}
```

### 1.6 Variables

```json
{
  "variables": [
    {
      "name": "patientAge",
      "expression": "x-formspec-age($patient.dob)",
      "scope": "#"
    },
    {
      "name": "isMinor",
      "expression": "@patientAge < 18",
      "scope": "#"
    },
    {
      "name": "isSenior",
      "expression": "@patientAge >= 65",
      "scope": "#"
    }
  ]
}
```

> [!TIP]
> Uses the `x-formspec-age()` extension function instead of manual `dateDiff(today(), $patient.dob, 'years')`. Cleaner, null-safe (returns null for future dates), and demonstrates extension function usage.

### 1.7 Binds (Behavior Layer)

#### Pre-populate + Disabled Display

```json
[
  {
    "path": "patient.firstName",
    "readonly": true,
    "disabledDisplay": "protected"
  },
  {
    "path": "patient.lastName",
    "readonly": true,
    "disabledDisplay": "protected"
  },
  {
    "path": "patient.dob",
    "readonly": true,
    "disabledDisplay": "protected"
  },
  {
    "path": "patient.sex",
    "readonly": true,
    "disabledDisplay": "protected"
  },
  {
    "path": "patient.insuranceMemberId",
    "readonly": true,
    "disabledDisplay": "protected"
  }
]
```

#### Relevance Binds

```json
[
  {
    "path": "currentVisit.otherSymptoms",
    "relevant": "selected($currentVisit.symptoms, 'other')"
  },
  {
    "path": "medicalHistory.allergies",
    "relevant": "$medicalHistory.hasAllergies = true"
  }
]
```

#### Calculate Binds — FEL Advanced Features

```json
[
  {
    "path": "patient.age",
    "calculate": "x-formspec-age($patient.dob)"
  },
  {
    "path": "assessment.totalConditions",
    "calculate": "count($medicalHistory.conditions[*].name)"
  },
  {
    "path": "assessment.severeConditionCount",
    "calculate": "countWhere($medicalHistory.conditions[*].severity, $ = 'severe' or $ = 'critical')"
  },
  {
    "path": "assessment.totalMedications",
    "calculate": "sum($medicalHistory.conditions[*].medications[*].drugName ? 1 : 0)"
  },
  {
    "path": "assessment.symptomDuration",
    "calculate": "if present($currentVisit.onsetDate) then dateDiff(today(), $currentVisit.onsetDate, 'days') else null"
  },
  {
    "path": "assessment.maskedInsuranceId",
    "calculate": "x-formspec-mask($patient.insuranceMemberId, 4)"
  }
]
```

> [!NOTE]
> Key FEL patterns demonstrated:
>
> - `countWhere()` with predicate — counts conditions matching severity criteria
> - `x-formspec-age()` — extension function
> - `x-formspec-mask()` — extension function showing last 4 characters
> - `dateDiff(today(), ...)` — date arithmetic
> - `if present(...) then ... else null` — conditional with null handling
> - Nested wildcard path: `$medicalHistory.conditions[*].medications[*].drugName`

#### Required Binds

```json
[
  {
    "path": "patient.firstName",
    "required": true
  },
  {
    "path": "patient.lastName",
    "required": true
  },
  {
    "path": "currentVisit.symptoms",
    "required": true
  },
  {
    "path": "currentVisit.onsetDate",
    "required": true
  },
  {
    "path": "medicalHistory.conditions[*].name",
    "required": true
  },
  {
    "path": "medicalHistory.conditions[*].severity",
    "required": true
  },
  {
    "path": "medicalHistory.conditions[*].medications[*].drugName",
    "required": true
  }
]
```

#### Constraint Binds

```json
[
  {
    "path": "currentVisit.onsetDate",
    "constraint": "$ <= today()",
    "constraintMessage": "Onset date cannot be in the future"
  },
  {
    "path": "medicalHistory.conditions[*].diagnosedDate",
    "constraint": "$ <= today()",
    "constraintMessage": "Diagnosis date cannot be in the future"
  },
  {
    "path": "medicalHistory.conditions[*].medications[*].startDate",
    "constraint": "$ <= today()",
    "constraintMessage": "Medication start date cannot be in the future"
  }
]
```

### 1.8 Shapes (Validation Layer)

#### Continuous Shapes

```json
[
  {
    "id": "onsetBeforeAppointment",
    "target": "currentVisit.appointmentDateTime",
    "constraint": "date($) >= $currentVisit.onsetDate",
    "message": "Appointment should be after symptom onset",
    "severity": "warning"
  }
]
```

#### Submit-Timing Shapes

```json
[
  {
    "id": "allergyDetailRequired",
    "target": "medicalHistory.allergies",
    "constraint": "present($)",
    "message": "Please describe your allergies",
    "severity": "error",
    "timing": "submit",
    "activeWhen": "$medicalHistory.hasAllergies = true"
  }
]
```

> [!NOTE]
> `activeWhen` on the shape means it only evaluates when the patient has reported allergies. Combined with `timing: "submit"`, this shape only fires at submission time AND only when the condition is met.

#### Demand-Timing Shape

```json
[
  {
    "id": "medicationInteractionCheck",
    "target": "#",
    "constraint": "let medNames = $medicalHistory.conditions[*].medications[*].drugName in count(medNames) = count(medNames)",
    "message": "Potential medication interaction detected",
    "severity": "warning",
    "timing": "demand"
  }
]
```

> [!TIP]
> The `demand` timing shape is only evaluated when explicitly triggered via `evaluateShape("medicationInteractionCheck")`. This models a "Check Interactions" button in the UI. The actual interaction logic would be more complex in production — this is a placeholder that demonstrates the demand-timing pattern.

#### Composed Shape

```json
[
  {
    "id": "highRiskPatient",
    "target": "#",
    "message": "Patient may be high-risk — review before scheduling",
    "severity": "warning",
    "timing": "submit",
    "or": ["seniorWithSevereCondition", "manyMedications"]
  },
  {
    "id": "seniorWithSevereCondition",
    "target": "#",
    "constraint": "@isSenior and $assessment.severeConditionCount > 0",
    "message": "Senior patient with severe condition(s)",
    "severity": "info"
  },
  {
    "id": "manyMedications",
    "target": "#",
    "constraint": "$assessment.totalMedications >= 5",
    "message": "Patient taking 5 or more medications",
    "severity": "info"
  }
]
```

> [!NOTE]
> Shape composition with `or`: `highRiskPatient` fires if EITHER `seniorWithSevereCondition` OR `manyMedications` is true. This demonstrates the SHACL-inspired composable validation that Formspec inherited.

---

## Phase 2: Component Document (`intake.component.json`)

4-step wizard: Patient Info → Current Visit → Medical History → Assessment

```json
{
  "$formspecComponent": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://formspec.org/examples/clinical-intake",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tree": {
    "component": "Wizard",
    "children": [
      {
        "component": "Page",
        "style": { "title": "Patient Information" },
        "children": [
          {
            "component": "Card",
            "style": { "title": "Demographics" },
            "children": [
              {
                "component": "Alert",
                "style": { "type": "info", "text": "The following fields are pre-populated from your medical record. Contact the front desk to make changes." }
              },
              {
                "component": "Grid",
                "style": { "columns": 2 },
                "children": [
                  { "component": "TextInput", "bind": "patient.firstName" },
                  { "component": "TextInput", "bind": "patient.lastName" },
                  { "component": "DatePicker", "bind": "patient.dob" },
                  { "component": "NumberInput", "bind": "patient.age" },
                  { "component": "Select", "bind": "patient.sex" }
                ]
              }
            ]
          },
          {
            "component": "Card",
            "style": { "title": "Contact & Insurance" },
            "children": [
              { "component": "TextInput", "bind": "patient.phone" },
              { "component": "TextInput", "bind": "patient.email" },
              { "component": "TextInput", "bind": "patient.insuranceMemberId" },
              { "component": "FileUpload", "bind": "patient.insuranceCard" }
            ]
          }
        ]
      },
      {
        "component": "Page",
        "style": { "title": "Current Visit" },
        "children": [
          { "component": "CheckboxGroup", "bind": "currentVisit.symptoms" },
          {
            "component": "TextInput",
            "bind": "currentVisit.otherSymptoms",
            "when": "selected($currentVisit.symptoms, 'other')"
          },
          {
            "component": "Grid",
            "style": { "columns": 2 },
            "children": [
              { "component": "DatePicker", "bind": "currentVisit.onsetDate" },
              { "component": "TextInput", "bind": "currentVisit.onsetTime" }
            ]
          },
          { "component": "DatePicker", "bind": "currentVisit.appointmentDateTime" }
        ]
      },
      {
        "component": "Page",
        "style": { "title": "Medical History" },
        "children": [
          {
            "component": "Stack",
            "children": [
              { "component": "Toggle", "bind": "medicalHistory.hasAllergies" },
              {
                "component": "TextInput",
                "bind": "medicalHistory.allergies",
                "when": "$medicalHistory.hasAllergies = true"
              }
            ]
          },
          {
            "component": "Heading",
            "style": { "text": "Active Medical Conditions", "level": 3 }
          },
          {
            "component": "DataTable",
            "bind": "medicalHistory.conditions",
            "style": {
              "addLabel": "Add Condition",
              "removeLabel": "Remove",
              "expandable": true,
              "columns": [
                { "bind": "name", "header": "Condition" },
                { "bind": "diagnosedDate", "header": "Diagnosed" },
                { "bind": "severity", "header": "Severity" }
              ]
            },
            "children": [
              {
                "component": "Card",
                "style": { "title": "Medications for this condition" },
                "children": [
                  {
                    "component": "DataTable",
                    "bind": "medications",
                    "style": {
                      "addLabel": "Add Medication",
                      "columns": [
                        { "bind": "drugName", "header": "Medication" },
                        { "bind": "dosage", "header": "Dosage" },
                        { "bind": "frequency", "header": "Frequency" },
                        { "bind": "startDate", "header": "Started" }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "component": "Page",
        "style": { "title": "Summary & Assessment" },
        "children": [
          {
            "component": "Card",
            "style": { "title": "Patient Summary" },
            "children": [
              {
                "component": "Grid",
                "style": { "columns": 3 },
                "children": [
                  { "component": "NumberInput", "bind": "assessment.totalConditions" },
                  { "component": "NumberInput", "bind": "assessment.severeConditionCount" },
                  { "component": "NumberInput", "bind": "assessment.totalMedications" }
                ]
              },
              { "component": "NumberInput", "bind": "assessment.symptomDuration" },
              { "component": "TextInput", "bind": "assessment.maskedInsuranceId" }
            ]
          }
        ]
      }
    ]
  }
}
```

> [!NOTE]
> **Nested DataTable** — the conditions DataTable contains an expandable detail area with a nested medications DataTable. The inner `bind: "medications"` resolves relative to the current condition repeat instance. This is the most complex component rendering pattern in the spec.

---

## Phase 3: Theme Document (`intake.theme.json`)

```json
{
  "$formspecTheme": "1.0",
  "version": "1.0.0",
  "targetDefinition": {
    "url": "https://formspec.org/examples/clinical-intake",
    "compatibleVersions": ">=1.0.0 <2.0.0"
  },
  "tokens": {
    "color.primary": "#0369A1",
    "color.primaryLight": "#E0F2FE",
    "color.error": "#DC2626",
    "color.warning": "#EA580C",
    "color.success": "#16A34A",
    "color.info": "#0284C7",
    "color.background": "#F8FAFC",
    "color.surface": "#FFFFFF",
    "color.muted": "#94A3B8",
    "spacing.sm": 8,
    "spacing.md": 16,
    "spacing.lg": 24,
    "typography.fontFamily": "'Inter', -apple-system, sans-serif"
  },
  "defaults": {
    "labelPosition": "top"
  },
  "selectors": [
    {
      "match": { "type": "display" },
      "apply": {
        "style": { "color": "$token.color.muted" }
      }
    }
  ],
  "items": {
    "patient.firstName": {
      "style": { "opacity": "0.7" },
      "cssClass": "readonly-field"
    },
    "patient.lastName": {
      "style": { "opacity": "0.7" },
      "cssClass": "readonly-field"
    }
  }
}
```

---

## Phase 4: Test Fixtures

### 4.1 Screener — Emergency Route

```json
{
  "screenerData": {
    "chiefComplaint": "emergency",
    "painLevel": 9
  },
  "expectedRoute": {
    "target": "https://formspec.org/examples/emergency-intake",
    "label": "Route to Emergency Intake"
  }
}
```

### 4.2 Complete Intake with Nested Repeats

```json
{
  "definitionUrl": "https://formspec.org/examples/clinical-intake",
  "definitionVersion": "1.0.0",
  "status": "completed",
  "authored": "2026-03-04T14:30:00Z",
  "data": {
    "patient": {
      "firstName": "Maria",
      "lastName": "Garcia",
      "dob": "1958-07-22",
      "age": 67,
      "sex": "female",
      "phone": "+14155551234",
      "email": "mgarcia@email.com",
      "insuranceMemberId": "BC-1234567890",
      "insuranceCard": {
        "contentType": "image/jpeg",
        "url": "https://storage.example.com/cards/bc-front.jpg",
        "size": 245000
      }
    },
    "currentVisit": {
      "symptoms": ["fatigue", "dizziness"],
      "onsetDate": "2026-02-28",
      "onsetTime": "08:30:00",
      "appointmentDateTime": "2026-03-04T14:00:00Z"
    },
    "medicalHistory": {
      "hasAllergies": true,
      "allergies": "Penicillin, sulfa drugs",
      "conditions": [
        {
          "name": "Hypertension",
          "diagnosedDate": "2018-03-15",
          "severity": "moderate",
          "medications": [
            {
              "drugName": "Lisinopril",
              "dosage": "20mg",
              "frequency": "daily",
              "startDate": "2018-04-01"
            },
            {
              "drugName": "Amlodipine",
              "dosage": "5mg",
              "frequency": "daily",
              "startDate": "2020-06-15"
            }
          ]
        },
        {
          "name": "Type 2 Diabetes",
          "diagnosedDate": "2020-11-01",
          "severity": "moderate",
          "medications": [
            {
              "drugName": "Metformin",
              "dosage": "1000mg",
              "frequency": "bid",
              "startDate": "2020-11-15"
            }
          ]
        },
        {
          "name": "Hyperlipidemia",
          "diagnosedDate": "2019-06-10",
          "severity": "mild",
          "medications": [
            {
              "drugName": "Atorvastatin",
              "dosage": "40mg",
              "frequency": "daily",
              "startDate": "2019-07-01"
            }
          ]
        }
      ]
    },
    "assessment": {
      "totalConditions": 3,
      "severeConditionCount": 0,
      "totalMedications": 4,
      "symptomDuration": 4,
      "maskedInsuranceId": "********7890"
    }
  }
}
```

### 4.3 Edge Case: prev()/next() for Medication Comparison

FEL expression to use in variables or custom display:

```
let prevDosage = prev().dosage in
  if present(prevDosage) and prevDosage != $dosage
  then "Dosage changed from " & prevDosage
  else null
```

This shows `prev()` returning the adjacent medication row within the same condition's medications repeat.

---

## Key Patterns to Validate

| Pattern | What to test |
|---|---|
| `evaluateScreener()` | Returns correct route for emergency vs routine |
| Screener items not in response | `chiefComplaint` and `painLevel` absent from `data` |
| `prePopulate` with `editable: false` | Field has value, readonly signal is true |
| `disabledDisplay: "protected"` | Field rendered but grayed out |
| `getInstanceData("patient", "firstName")` | Returns pre-pop value |
| `@instance('drugDatabase')` in FEL | Resolves secondary instance data |
| Nested repeat add/remove | Add medication to condition[1], remove condition[0] |
| `$conditions[*].medications[*].drugName` | Multi-level wildcard resolution |
| `@current` at inner level | Resolves to medication row, not condition row |
| `@index` at inner level | 1-based position within medications, not conditions |
| `countWhere(...)` | Counts conditions matching severity predicate |
| `x-formspec-age($dob)` | Extension function returns integer age |
| `x-formspec-mask($id, 4)` | Extension function returns masked string |
| Shape `activeWhen` | Shape only evaluates when condition is true |
| Shape `timing: "demand"` | Not evaluated until `evaluateShape()` called |
| Shape `or` composition | `highRiskPatient` fires if either sub-shape is true |
| `nonRelevantBehavior: "keep"` | Non-relevant allergies field preserved in response |
| Relevance AND-inheritance | Hide `medicalHistory` → hides all conditions + medications |

---

## Implementation Checklist

- [ ] Create `intake.definition.json` with screener, instances, all items
- [ ] Implement screener routes with FEL conditions
- [ ] Set up secondary instances (patient pre-pop, drug database)
- [ ] Implement all pre-populate configurations
- [ ] Implement relevance binds (symptom "other", allergy detail)
- [ ] Implement calculate binds with FEL advanced features
- [ ] Implement required/constraint binds with date validation
- [ ] Implement shapes: continuous, submit, demand, composed
- [ ] Implement variables with `x-formspec-age()` extension
- [ ] Create `intake.component.json` with nested DataTable
- [ ] Create `intake.theme.json` with healthcare styling
- [ ] Create all test fixtures (screener, empty, partial, complete, nested)
- [ ] Validate all JSON against schemas
- [ ] Run Python linter on definition
- [ ] Test screener routing with `evaluateScreener()`
- [ ] Test pre-population from instance data
- [ ] Test `disabledDisplay: "protected"` rendering
- [ ] Test nested repeat lifecycle (add/remove at both levels)
- [ ] Test multi-level wildcard path resolution
- [ ] Test `countWhere` with predicate
- [ ] Test `x-formspec-age()` and `x-formspec-mask()` extensions
- [ ] Test demand-timing shape with `evaluateShape()`
- [ ] Test shape composition (`or` with sub-shapes)
- [ ] Test `nonRelevantBehavior: "keep"` in response serialization
- [ ] Test `prev()`/`next()` at inner repeat level
- [ ] Test `@current`/`@index`/`@count` at both repeat levels
