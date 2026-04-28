# WOS Kernel Document — Schema Reference Map

> **ADR 0076:** Kernel authoring shape lives in `wos-spec/schemas/wos-workflow.schema.json` (merged envelope). This reference map is retained for navigation; prefer the workflow schema file on disk.

## Overview

A WOS Kernel Document per the Workflow Orchestration Standard (WOS) Kernel Specification v1.0. The kernel is the minimal orchestration substrate: it defines lifecycle topology (states, transitions, events, milestones), case state (typed data with append-only mutation history), actor model (human and system, extensible via actorExtension seam), impact level classification, contract validation interface, provenance Facts tier, durable execution guarantees, and five named extension seams. The kerne

## Top-Level Properties

| Property | Type / shape | Notes |
|----------|--------------|-------|
| `$schema` | JsonSchemaUri | See schema for constraints. |
| `$wosWorkflow` | string | See schema for constraints (envelope version pin, literal `1.0`). |
| `actors` | array | See schema for constraints. |
| `caseFile` | CaseFile | See schema for constraints. |
| `contracts` | object | See schema for constraints. |
| `custodyHook` | object | See schema for constraints. |
| `description` | string | See schema for constraints. |
| `evaluationMode` | enum(event-driven, continuous) | See schema for constraints. |
| `execution` | ExecutionConfig | See schema for constraints. |
| `extensions` | ExtensionsMap | See schema for constraints. |
| `impactLevel` | enum(rights-impacting, safety-impacting, operational, informational) | See schema for constraints. |
| `lifecycle` | Lifecycle | See schema for constraints. |
| `maxRelationshipEventDepth` | integer | See schema for constraints. |
| `provenance` | ProvenanceConfig | See schema for constraints. |
| `status` | enum(draft, active, retired) | See schema for constraints. |
| `title` | string | See schema for constraints. |
| `url` | string | See schema for constraints. |
| `version` | string | See schema for constraints. |

## Key `$defs` (sample)

| Definition |
|------------|
| **Action** |
| **ActorDeclaration** |
| **CaseFile** |
| **CaseRelationship** |
| **ContractReference** |
| **ExecutionConfig** |
| **ExtensionsMap** |
| **FieldDefinition** |
| **JsonSchemaUri** |
| **Lifecycle** |
| **Milestone** |
| **ProvenanceConfig** |
| **Region** |
| **State** |
| **Transition** |
| **TransitionEvent** |
| **TransitionEventCondition** |
| **TransitionEventError** |
| **TransitionEventMessage** |
| **TransitionEventSignal** |
| **TransitionEventTimer** |

## Cross-References

Resolve `$ref` targets inside the schema file for full nested structures. Sidecar schemas typically declare a `targetWorkflow`, `targetGovernance`, or `targetAgent` binding to a parent document.
