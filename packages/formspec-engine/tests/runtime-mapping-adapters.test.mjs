/** @filedesc CSV and XML adapter serialization tests for RuntimeMappingEngine (Phases 4.2 and 4.3). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeMappingEngine } from '../dist/index.js';

// ---------------------------------------------------------------------------
// CSV adapter (Phase 4.2)
// ---------------------------------------------------------------------------

test('CSV: basic CSV with header row', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: {} },
    rules: [
      { sourcePath: 'first', targetPath: 'firstName', transform: 'preserve' },
      { sourcePath: 'last', targetPath: 'lastName', transform: 'preserve' },
      { sourcePath: 'age', targetPath: 'age', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ first: 'Alice', last: 'Smith', age: 30 });

  assert.equal(typeof result.output, 'string');
  const lines = result.output.split('\r\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'firstName,lastName,age');
  assert.equal(lines[1], 'Alice,Smith,30');
  assert.equal(result.diagnostics.length, 0);
});

test('CSV: custom delimiter (;) and quote char', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: { delimiter: ';', quote: "'" } },
    rules: [
      { sourcePath: 'a', targetPath: 'colA', transform: 'preserve' },
      { sourcePath: 'b', targetPath: 'colB', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ a: 'hello', b: 'world' });
  const lines = result.output.split('\r\n');
  assert.equal(lines[0], 'colA;colB');
  assert.equal(lines[1], 'hello;world');
});

test('CSV: values containing the delimiter are quoted', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: {} },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'has,comma' });
  const lines = result.output.split('\r\n');
  assert.equal(lines[1], '"has,comma"');
});

test('CSV: values containing the quote char are escaped', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: {} },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'say "hello"' });
  const lines = result.output.split('\r\n');
  assert.equal(lines[1], '"say ""hello"""');
});

test('CSV: header: false omits the header row', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: { header: false } },
    rules: [
      { sourcePath: 'a', targetPath: 'colA', transform: 'preserve' },
      { sourcePath: 'b', targetPath: 'colB', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ a: 'x', b: 'y' });
  const lines = result.output.split('\r\n');
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'x,y');
});

test('CSV: lineEnding lf uses \\n', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: { lineEnding: 'lf' } },
    rules: [
      { sourcePath: 'a', targetPath: 'colA', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ a: 'val' });
  assert.ok(!result.output.includes('\r\n'));
  const lines = result.output.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'colA');
  assert.equal(lines[1], 'val');
});

test('CSV: targetPath with dot emits ADAPTER_FAILURE diagnostic and halts', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: {} },
    rules: [
      { sourcePath: 'x', targetPath: 'nested.path', transform: 'preserve' },
      { sourcePath: 'y', targetPath: 'flat', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'a', y: 'b' });
  // Diagnostics are structured objects with errorCode
  assert.ok(result.diagnostics.some(d =>
    typeof d === 'object' && d.errorCode === 'ADAPTER_FAILURE' && d.message.includes('nested.path')
  ));
  // Spec: adapter errors MUST halt with no partial output
  assert.equal(result.output, '');
});

test('CSV: null values render as empty string', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { csv: {} },
    rules: [
      { sourcePath: 'a', targetPath: 'colA', transform: 'preserve' },
      { sourcePath: 'b', targetPath: 'colB', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ a: null, b: 'ok' });
  const lines = result.output.split('\r\n');
  assert.equal(lines[1], ',ok');
});

test('CSV: targetSchema format csv triggers CSV adapter', () => {
  const mapper = new RuntimeMappingEngine({
    targetSchema: { format: 'csv' },
    rules: [
      { sourcePath: 'x', targetPath: 'col', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'val' });
  assert.equal(typeof result.output, 'string');
  assert.ok(result.output.includes('col'));
});

// ---------------------------------------------------------------------------
// XML adapter (Phase 4.3)
// ---------------------------------------------------------------------------

test('XML: basic XML wraps in rootElement', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { rootElement: 'data' } },
    rules: [
      { sourcePath: 'name', targetPath: 'name', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ name: 'Alice' });
  assert.equal(typeof result.output, 'string');
  assert.ok(result.output.includes('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(result.output.includes('<data>'));
  assert.ok(result.output.includes('<name>Alice</name>'));
  assert.ok(result.output.includes('</data>'));
});

test('XML: nested dot-paths produce nested elements', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: {} },
    rules: [
      { sourcePath: 'street', targetPath: 'addr.street', transform: 'preserve' },
      { sourcePath: 'city', targetPath: 'addr.city', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ street: '123 Main', city: 'Springfield' });
  assert.ok(result.output.includes('<addr>'));
  assert.ok(result.output.includes('<street>123 Main</street>'));
  assert.ok(result.output.includes('<city>Springfield</city>'));
  assert.ok(result.output.includes('</addr>'));
});

test('XML: @attr becomes an XML attribute', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: {} },
    rules: [
      { sourcePath: 'id', targetPath: 'person.@id', transform: 'preserve' },
      { sourcePath: 'name', targetPath: 'person.name', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ id: '42', name: 'Bob' });
  assert.ok(result.output.includes('<person id="42">'));
  assert.ok(result.output.includes('<name>Bob</name>'));
  assert.ok(result.output.includes('</person>'));
});

test('XML: declaration: false omits the XML declaration', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { declaration: false } },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'test' });
  assert.ok(!result.output.includes('<?xml'));
  assert.ok(result.output.includes('<root>'));
  assert.ok(result.output.includes('<val>test</val>'));
});

test('XML: cdata paths wrap content in CDATA', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { cdata: ['body'] } },
    rules: [
      { sourcePath: 'html', targetPath: 'body', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ html: '<p>Hello</p>' });
  assert.ok(result.output.includes('<![CDATA[<p>Hello</p>]]>'));
  assert.ok(result.output.includes('<body>'));
});

test('XML: indent 0 produces no indentation or newlines', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { indent: 0, declaration: false } },
    rules: [
      { sourcePath: 'x', targetPath: 'a.b', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'val' });
  assert.ok(!result.output.includes('\n'));
  assert.ok(result.output.includes('<root><a><b>val</b></a></root>'));
});

test('XML: special XML characters in text are escaped', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { declaration: false } },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'a < b & c > d' });
  assert.ok(result.output.includes('a &lt; b &amp; c &gt; d'));
});

test('XML: special characters in attributes are escaped', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { declaration: false } },
    rules: [
      { sourcePath: 'x', targetPath: 'item.@label', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'say "hello"' });
  assert.ok(result.output.includes('label="say &quot;hello&quot;"'));
});

test('XML: targetSchema format xml triggers XML adapter', () => {
  const mapper = new RuntimeMappingEngine({
    targetSchema: { format: 'xml' },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'test' });
  assert.equal(typeof result.output, 'string');
  assert.ok(result.output.includes('<val>test</val>'));
});

test('XML: default rootElement is "root"', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { declaration: false } },
    rules: [
      { sourcePath: 'x', targetPath: 'val', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ x: 'v' });
  assert.ok(result.output.startsWith('<root>'));
  assert.ok(result.output.includes('</root>'));
});

test('XML: nested cdata paths work correctly', () => {
  const mapper = new RuntimeMappingEngine({
    adapters: { xml: { cdata: ['content.body'], declaration: false } },
    rules: [
      { sourcePath: 'html', targetPath: 'content.body', transform: 'preserve' },
    ]
  });

  const result = mapper.forward({ html: '<b>bold</b>' });
  assert.ok(result.output.includes('<body><![CDATA[<b>bold</b>]]></body>'));
});
