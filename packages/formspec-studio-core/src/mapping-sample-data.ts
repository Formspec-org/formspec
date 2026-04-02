/** @filedesc Generates sample response data from a Formspec definition for mapping previews. */
import { createFormEngine } from '@formspec-org/engine';
import type { FormDefinition, FormItem } from '@formspec-org/types';

export interface MappingSampleOptions {
  seed?: number;
}

/**
 * Returns a realistic sample value for a field based on its dataType and key name.
 * Deterministic — same inputs always produce the same output.
 * Used by both the mapping preview (actual values) and the output blueprint (display strings).
 */
export function sampleFieldValue(
  key: string,
  dataType: string | undefined,
  options?: { firstOptionValue?: string; secondOptionValue?: string },
): unknown {
  const dt = dataType ?? 'string';
  const k = key.toLowerCase();

  // --- Numeric ---
  if (dt === 'integer' || dt === 'decimal' || dt === 'number') {
    if (k.includes('year')) return 2025;
    if (k.includes('age')) return 34;
    if (k.includes('price') || k.includes('amount') || k.includes('cost') || k.includes('total'))
      return dt === 'integer' ? 1250 : 1250.00;
    if (k.includes('percent') || k.includes('rate')) return dt === 'integer' ? 15 : 15.75;
    if (k.includes('count') || k.includes('quantity') || k.includes('qty')) return 3;
    if (k.includes('score') || k.includes('rating')) return dt === 'integer' ? 8 : 8.5;
    if (k.includes('weight')) return dt === 'integer' ? 72 : 72.5;
    if (k.includes('height')) return dt === 'integer' ? 175 : 175.3;
    return dt === 'integer' ? 42 : 3.14;
  }

  if (dt === 'money') {
    if (k.includes('salary') || k.includes('income')) return 75000.00;
    if (k.includes('tax')) return 4250.00;
    if (k.includes('discount')) return 25.00;
    if (k.includes('total')) return 1499.99;
    return 1250.00;
  }

  // --- Boolean ---
  if (dt === 'boolean') return true;

  // --- Date / time ---
  if (dt === 'date') {
    if (k.includes('birth') || k.includes('dob')) return '1990-06-15';
    if (k.includes('start') || k.includes('begin')) return '2025-01-01';
    if (k.includes('end') || k.includes('expir')) return '2025-12-31';
    return '2025-03-31';
  }

  if (dt === 'dateTime') {
    if (k.includes('created') || k.includes('submitted')) return '2025-03-31T09:15:00Z';
    if (k.includes('updated') || k.includes('modified')) return '2025-03-31T14:30:00Z';
    return '2025-03-31T09:00:00Z';
  }

  if (dt === 'time') {
    if (k.includes('start') || k.includes('begin') || k.includes('open')) return '09:00:00';
    if (k.includes('end') || k.includes('close')) return '17:00:00';
    return '14:30:00';
  }

  // --- Choice ---
  if (dt === 'choice') {
    return options?.firstOptionValue ?? 'option_a';
  }

  if (dt === 'multiChoice') {
    const a = options?.firstOptionValue ?? 'option_a';
    const b = options?.secondOptionValue ?? 'option_b';
    return [a, b];
  }

  // --- URI ---
  if (dt === 'uri') {
    if (k.includes('linkedin')) return 'https://linkedin.com/in/jdoe';
    if (k.includes('github')) return 'https://github.com/jdoe';
    if (k.includes('photo') || k.includes('image') || k.includes('avatar'))
      return 'https://example.com/photo.jpg';
    return 'https://example.com';
  }

  // --- Attachment ---
  if (dt === 'attachment') {
    if (k.includes('photo') || k.includes('image') || k.includes('avatar')) return 'photo.jpg';
    if (k.includes('resume') || k.includes('cv')) return 'resume.pdf';
    return 'file.pdf';
  }

  // --- String / text with key heuristics ---
  if (k.includes('email') || k.includes('e_mail')) return 'jane@example.com';
  if (k.includes('phone') || k.includes('mobile') || k.includes('tel')) return '+1-555-867-5309';
  if (k === 'firstname' || k === 'first_name' || k === 'fname' || (k.includes('first') && k.includes('name')))
    return 'Jane';
  if (k === 'lastname' || k === 'last_name' || k === 'lname' || k === 'surname' || (k.includes('last') && k.includes('name')))
    return 'Doe';
  if (k.includes('name') && !k.includes('file')) return 'Jane Doe';
  if (k.includes('street') || k.includes('address1') || k === 'address') return '123 Main St';
  if (k.includes('city')) return 'Springfield';
  if (k.includes('state') || k.includes('province')) return 'IL';
  if (k.includes('zip') || k.includes('postal')) return '62704';
  if (k.includes('country')) return 'United States';
  if (k.includes('company') || k.includes('organization') || k.includes('org')) return 'Acme Corp';
  if (k.includes('title') || k.includes('jobtitle') || k.includes('position')) return 'Software Engineer';
  if (k.includes('department') || k.includes('dept')) return 'Engineering';
  if (k.includes('description') || k.includes('bio') || k.includes('summary') || k.includes('notes'))
    return dt === 'text'
      ? 'A detailed description of the project goals and expected outcomes.'
      : 'Brief summary of the item.';
  if (k.includes('comment') || k.includes('feedback') || k.includes('message')) return 'Looks good, approved.';
  if (k.includes('ssn') || k.includes('social_security')) return '***-**-1234';
  if (k.includes('ein') || k.includes('tax_id')) return '12-3456789';
  if (k.includes('password') || k.includes('secret')) return '••••••••';
  if (k.includes('url') || k.includes('website') || k.includes('link')) return 'https://example.com';
  if (k.includes('gender') || k.includes('sex')) return 'Female';
  if (k.includes('id') && (k.endsWith('id') || k.endsWith('_id'))) return 'ID-00042';

  if (dt === 'text') return 'A longer form text response with multiple sentences.';
  return `sample_${key}`;
}

// --- Mapping preview data generation ---

export async function generateDefinitionSampleData(
  definition: FormDefinition,
  _options: MappingSampleOptions = {},
): Promise<Record<string, unknown>> {
  const engine = createFormEngine({ ...definition });
  walkItems(engine, definition.items ?? []);
  return engine.getResponse().data as Record<string, unknown>;
}

function walkItems(engine: ReturnType<typeof createFormEngine>, items: FormItem[], prefix = ''): void {
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;

    if (item.type === 'field') {
      const opts = item.options
        ? { firstOptionValue: item.options[0]?.value, secondOptionValue: item.options[1]?.value }
        : undefined;
      engine.setValue(path, sampleFieldValue(item.key, item.dataType, opts));
    }

    if (item.type === 'group') {
      if (item.repeatable) {
        engine.addRepeatInstance(path);
        if (item.children) {
          walkItems(engine, item.children as FormItem[], `${path}[0]`);
        }
      } else if (item.children) {
        walkItems(engine, item.children as FormItem[], path);
      }
    }
  }
}
