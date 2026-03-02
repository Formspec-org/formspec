# Form Intelligence Dashboard — Design

**Date:** 2026-03-02
**Status:** Approved

## Goal

A separate `tools.html` page for the grant-application reference site that showcases all 5 server backend endpoints in a non-technical, visually appealing dashboard.

## Layout

Tabbed single-page app. Same USWDS-style header. Vanilla JS + d3-force for the dependency graph.

## Tabs

| Tab | Endpoint | Description |
|-----|----------|-------------|
| Expression Tester | POST /evaluate | Test FEL formulas with sample data |
| Download & Export | POST /export/{format} | Download application data as JSON/CSV/XML |
| Version Comparison | POST /changelog | Diff two form definition versions |
| Extensions | GET /registry | Browse registered form extensions |
| Field Relationships | GET /dependencies | Interactive force-directed dependency graph |

## Files

- Create: `examples/grant-application/tools.html`
- Create: `examples/grant-application/tools.js`
- Modify: `examples/grant-application/index.html` (add header link)

## External Dependency

- d3 v7 from CDN (ESM import) for the force-directed graph
