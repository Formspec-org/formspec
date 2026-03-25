/** @filedesc Tests for widget query methods on Project: listWidgets, compatibleWidgets, fieldTypeCatalog. */
import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';

describe('listWidgets', () => {
  it('returns an array of WidgetInfo objects', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    expect(Array.isArray(widgets)).toBe(true);
    expect(widgets.length).toBeGreaterThan(0);
  });

  it('each entry has name, component, and compatibleDataTypes', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    for (const w of widgets) {
      expect(w).toHaveProperty('name');
      expect(w).toHaveProperty('component');
      expect(w).toHaveProperty('compatibleDataTypes');
      expect(typeof w.name).toBe('string');
      expect(typeof w.component).toBe('string');
      expect(Array.isArray(w.compatibleDataTypes)).toBe(true);
    }
  });

  it('includes TextInput with string in compatible types', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    const textInput = widgets.find(w => w.component === 'TextInput');
    expect(textInput).toBeDefined();
    expect(textInput!.compatibleDataTypes).toContain('string');
  });

  it('includes Select with choice in compatible types', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    const select = widgets.find(w => w.component === 'Select');
    expect(select).toBeDefined();
    expect(select!.compatibleDataTypes).toContain('choice');
  });

  it('includes Slider with decimal in compatible types', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    const slider = widgets.find(w => w.component === 'Slider');
    expect(slider).toBeDefined();
    expect(slider!.compatibleDataTypes).toContain('decimal');
  });

  it('does not duplicate components', () => {
    const project = createProject();
    const widgets = project.listWidgets();
    const components = widgets.map(w => w.component);
    expect(new Set(components).size).toBe(components.length);
  });
});

describe('compatibleWidgets', () => {
  it('returns widget names for a valid data type', () => {
    const project = createProject();
    const widgets = project.compatibleWidgets('string');
    expect(Array.isArray(widgets)).toBe(true);
    expect(widgets.length).toBeGreaterThan(0);
    expect(widgets).toContain('TextInput');
  });

  it('returns Select and RadioGroup for choice type', () => {
    const project = createProject();
    const widgets = project.compatibleWidgets('choice');
    expect(widgets).toContain('Select');
    expect(widgets).toContain('RadioGroup');
  });

  it('returns Toggle and Checkbox for boolean type', () => {
    const project = createProject();
    const widgets = project.compatibleWidgets('boolean');
    expect(widgets).toContain('Toggle');
    expect(widgets).toContain('Checkbox');
  });

  it('returns an empty array for an unknown data type', () => {
    const project = createProject();
    const widgets = project.compatibleWidgets('nonexistent');
    expect(widgets).toEqual([]);
  });
});

describe('fieldTypeCatalog', () => {
  it('returns an array of FieldTypeCatalogEntry objects', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('each entry has alias, dataType, and defaultWidget', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    for (const entry of catalog) {
      expect(entry).toHaveProperty('alias');
      expect(entry).toHaveProperty('dataType');
      expect(entry).toHaveProperty('defaultWidget');
      expect(typeof entry.alias).toBe('string');
      expect(typeof entry.dataType).toBe('string');
      expect(typeof entry.defaultWidget).toBe('string');
    }
  });

  it('includes text alias mapping to text dataType', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    const text = catalog.find(e => e.alias === 'text');
    expect(text).toBeDefined();
    expect(text!.dataType).toBe('text');
    expect(text!.defaultWidget).toBe('TextInput');
  });

  it('includes email alias mapping to string dataType', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    const email = catalog.find(e => e.alias === 'email');
    expect(email).toBeDefined();
    expect(email!.dataType).toBe('string');
  });

  it('includes number alias mapping to decimal dataType', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    const number = catalog.find(e => e.alias === 'number');
    expect(number).toBeDefined();
    expect(number!.dataType).toBe('decimal');
  });

  it('includes rating alias mapping to integer dataType with Rating widget', () => {
    const project = createProject();
    const catalog = project.fieldTypeCatalog();
    const rating = catalog.find(e => e.alias === 'rating');
    expect(rating).toBeDefined();
    expect(rating!.dataType).toBe('integer');
    expect(rating!.defaultWidget).toBe('Rating');
  });
});
