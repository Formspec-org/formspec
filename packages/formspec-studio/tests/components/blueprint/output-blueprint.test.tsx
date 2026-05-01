/** @filedesc Tests for OutputBlueprint — calculated field editability and repeating group validation. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject, type Project } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { OutputBlueprint } from '../../../src/components/blueprint/OutputBlueprint';
import { exampleDefinition } from '../../../src/fixtures/example-definition';

function Providers({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <ProjectProvider project={project}>
      <SelectionProvider>{children}</SelectionProvider>
    </ProjectProvider>
  );
}

function renderWithFixture() {
  const project = createProject({ seed: { definition: exampleDefinition as any } });
  return render(
    <Providers project={project}>
      <OutputBlueprint />
    </Providers>,
  );
}

// ---------------------------------------------------------------------------
// Bug 1: Calculated / readonly fields should not be editable
// ---------------------------------------------------------------------------
// adjInc has binds: { calculate: "money(…)", readonly: 'true' }.
// The current DataNode always renders an editable <input> regardless of
// calculate/readonly status. The correct behaviour is that calculated or
// readonly fields should be disabled (or rendered as static text).
// ---------------------------------------------------------------------------

describe('OutputBlueprint — calculated field editability', () => {
  it('renders the adjInc field', () => {
    renderWithFixture();
    // Sanity: the key "adjInc" appears somewhere in the document
    const adjIncKeys = screen.getAllByText((content, el) =>
      el?.tagName !== 'SCRIPT' && content.includes('adjInc'),
    );
    expect(adjIncKeys.length).toBeGreaterThan(0);
  });

  it('does not render an editable input for the calculated adjInc field', () => {
    renderWithFixture();
    // Find the text node showing the "adjInc" key, then locate its parent row
    const adjIncKey = screen.getAllByText((content, el) =>
      el?.textContent === '"adjInc"' && el?.tagName === 'SPAN',
    );
    expect(adjIncKey.length).toBeGreaterThan(0);

    // Walk up to the row container (the div with onClick / cursor-pointer)
    const row = adjIncKey[0].closest('.group');
    expect(row).toBeTruthy();

    // BUG: The row currently contains an editable <input type="text">.
    // A calculated/readonly field must NOT have an editable input.
    const input = row!.querySelector('input[type="text"]');

    // The correct assertion: there should be no editable input, OR it should be disabled.
    const isAbsent = input === null;
    const isDisabled = input?.hasAttribute('disabled') || input?.hasAttribute('readonly');
    expect(isAbsent || isDisabled).toBe(true);
  });

  it('displays the calculated value as non-interactive text when readonly', () => {
    renderWithFixture();
    const adjIncKey = screen.getAllByText((content, el) =>
      el?.textContent === '"adjInc"' && el?.tagName === 'SPAN',
    );
    const row = adjIncKey[0].closest('.group');
    expect(row).toBeTruthy();

    // A readonly/calculated field should show its value but not accept input.
    // If rendered as an input, it must be disabled.
    const inputs = row!.querySelectorAll('input:not([disabled]):not([readonly])');
    expect(inputs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Bug 2: Repeating group fields produce non-indexed paths and no validation
// ---------------------------------------------------------------------------
// The `members` group is repeatable (minRepeat: 0, maxRepeat: 12).
// initialValues() generates paths without array indices (hh.members.mName)
// and runValidation() never calls addRepeatInstance(), so:
//   (a) member field paths lack [0] index notation
//   (b) validation results for repeating group fields are completely missing
// ---------------------------------------------------------------------------

describe('OutputBlueprint — repeating group paths and validation', () => {
  it('renders member fields with indexed array paths', () => {
    renderWithFixture();
    // The rendered DOM should show the members group contents. Because
    // minRepeat is 0 but initialValues populates the fields, there should
    // be at least one instance with indexed paths like members[0].mName.

    // Look for a text node containing "mName" (the member name key)
    const mNameKeys = screen.getAllByText((content, el) =>
      el?.textContent === '"mName"' && el?.tagName === 'SPAN',
    );
    expect(mNameKeys.length).toBeGreaterThan(0);

    // Find the closest DataNode container for this field
    const row = mNameKeys[0].closest('.group');
    expect(row).toBeTruthy();

    // Walk up to find the font-mono container that wraps the DataNode
    const nodeContainer = mNameKeys[0].closest('.font-mono');
    expect(nodeContainer).toBeTruthy();

    // The input for this field should exist, and the value it holds should
    // come from a path that includes an array index (e.g. hh.members[0].mName).
    // We verify this indirectly: the validation map key for members children
    // must use indexed paths. We can check by inspecting what the component
    // rendered for the "data" section.
    //
    // Since we can't directly inspect React state, we verify that when there
    // ARE required fields inside the repeating group (hh.members[*].mName has
    // required: 'true' in binds), validation errors should appear for them.
    // If paths are non-indexed, the engine won't match binds and no errors show.

    // This is a structural precondition: the members group should render
    // its children at all (it does, but with wrong paths).
    const inputs = nodeContainer!.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('includes validation errors for required fields inside repeating groups', () => {
    renderWithFixture();

    // The binds specify: hh.members[*].mName required: 'true', hh.members[*].mInc required: 'true'.
    // With at least one repeat instance and empty/sample values, the engine
    // should produce validation results referencing members[0].mName or members[0].mInc.

    // Gather ALL validation result text from the document.
    // ValidationResultNode renders paths inside <span> with class text-green-*
    // via StaticField. We look for any validation result whose path contains "members[".
    const allText = document.body.textContent ?? '';

    // The validationResults section should mention at least one members[N] path.
    // BUG: Currently it does NOT because initialValues produces non-indexed paths
    // and runValidation never calls addRepeatInstance.
    const hasMemberValidation = allText.includes('members[');
    expect(hasMemberValidation).toBe(true);
  });

  it('validation error count includes repeating group field errors', () => {
    renderWithFixture();

    // The header shows error count like "5 errors". Required fields inside
    // members (mName, mInc) should contribute to the error count when their
    // values are invalid/missing.
    //
    // Currently the error count ignores repeating groups entirely because
    // the engine never gets addRepeatInstance called, so no repeat-path binds fire.

    // Find the error count in the header (e.g. "6 errors" — single span, case-insensitive plural)
    const headerEl = screen.getByText(/^\d+\s+errors?$/i);
    expect(headerEl).toBeInTheDocument();

    // Extract the count
    const countMatch = headerEl.textContent?.match(/(\d+)\s*errors?/i);
    expect(countMatch).toBeTruthy();
    const errorCount = parseInt(countMatch![1], 10);

    // Verify the validationResults section renders member-path results.
    // If repeating groups work, validation results should include paths
    // like members[0].mName, members[0].mInc, etc.
    const validationSection = screen.getByText('"validationResults"');
    expect(validationSection).toBeInTheDocument();

    // Look for any rendered validation result node that targets a members path
    const resultNodes = document.querySelectorAll('.font-mono');
    const memberResults = Array.from(resultNodes).filter((node) =>
      node.textContent?.includes('members['),
    );
    expect(memberResults.length).toBeGreaterThan(0);
  });

  it('shows inline validation under a repeat instance field after editing (report paths are 0-based aligned)', async () => {
    renderWithFixture();
    const mNameKeys = screen.getAllByText((content, el) =>
      el?.textContent === '"mName"' && el?.tagName === 'SPAN',
    );
    const node = mNameKeys[0].closest('.font-mono');
    expect(node).toBeTruthy();
    const input = node!.querySelector('input[type="text"]:not([disabled])');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: '' } });
    await waitFor(() => {
      expect(within(node! as HTMLElement).getByText(/^✕ /)).toBeInTheDocument();
    });
  });
});
