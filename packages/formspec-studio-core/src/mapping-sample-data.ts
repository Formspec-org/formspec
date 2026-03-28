/** @filedesc Generates sample response data from a Formspec definition for mapping previews. */
import { faker } from '@faker-js/faker';
import { createFormEngine } from '@formspec-org/engine';
import type { FormDefinition, FormItem } from '@formspec-org/types';

export interface MappingSampleOptions {
  seed?: number;
}

export function generateDefinitionSampleData(
  definition: FormDefinition,
  options: MappingSampleOptions = {},
): Record<string, unknown> {
  if (typeof options.seed === 'number') {
    faker.seed(options.seed);
  }

  const engine = createFormEngine({ ...definition });
  walkItems(engine, definition.items ?? []);
  return engine.getResponse().data as Record<string, unknown>;
}

function walkItems(engine: ReturnType<typeof createFormEngine>, items: FormItem[], prefix = ''): void {
  for (const item of items) {
    const path = prefix ? `${prefix}.${item.key}` : item.key;

    if (item.type === 'field') {
      engine.setValue(path, sampleValueForField(item));
    }

    if (item.type === 'group') {
      if (item.repeatable) {
        const count = faker.number.int({ min: 1, max: 2 });
        for (let index = 0; index < count; index += 1) {
          engine.addRepeatInstance(path);
          if (item.children) {
            walkItems(engine, item.children as FormItem[], `${path}[${index}]`);
          }
        }
      } else if (item.children) {
        walkItems(engine, item.children as FormItem[], path);
      }
    }
  }
}

function sampleValueForField(item: FormItem): unknown {
  const dataType = item.dataType;
  const keyLower = item.key.toLowerCase();

  if (dataType === 'integer' || dataType === 'decimal' || dataType === 'number') {
    if (keyLower.includes('year')) return faker.date.past().getFullYear();
    if (keyLower.includes('price') || keyLower.includes('amount')) return Number(faker.commerce.price());
    if (keyLower.includes('age')) return faker.number.int({ min: 18, max: 90 });
    return dataType === 'integer'
      ? faker.number.int({ min: 1, max: 1000 })
      : faker.number.float({ min: 1, max: 1000, fractionDigits: 2 });
  }

  if (dataType === 'boolean') {
    return faker.datatype.boolean();
  }

  if (dataType === 'date') {
    return faker.date.past().toISOString().split('T')[0];
  }

  if (dataType === 'money') {
    return {
      amount: Number(faker.commerce.price()),
      currency: faker.finance.currencyCode(),
    };
  }

  if (keyLower.includes('first')) return faker.person.firstName();
  if (keyLower.includes('last')) return faker.person.lastName();
  if (keyLower.includes('full') && keyLower.includes('name')) return faker.person.fullName();
  if (keyLower.includes('name')) return faker.person.fullName();
  if (keyLower.includes('email')) return faker.internet.email();
  if (keyLower.includes('phone')) return faker.phone.number();
  if (keyLower.includes('street')) return faker.location.streetAddress();
  if (keyLower.includes('city')) return faker.location.city();
  if (keyLower.includes('zip') || keyLower.includes('postal')) return faker.location.zipCode();
  if (keyLower.includes('company')) return faker.company.name();
  if (keyLower.includes('description') || keyLower.includes('bio')) return faker.lorem.paragraph();
  return faker.lorem.words(3);
}
