export interface ErrorObject {
  instancePath: string;
  message?: string;
}

type ValidateFn = ((payload: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

export default class Ajv {
  public constructor(_options?: Record<string, unknown>) {}

  public compile(schema: Record<string, unknown>): ValidateFn {
    const validate = ((payload: unknown) => {
      const errors: ErrorObject[] = [];
      validateSchema(schema, payload, '', errors, schema);
      validate.errors = errors.length ? errors : null;
      return errors.length === 0;
    }) as ValidateFn;

    validate.errors = null;
    return validate;
  }
}

function validateSchema(
  schema: Record<string, unknown>,
  payload: unknown,
  instancePath: string,
  errors: ErrorObject[],
  rootSchema: Record<string, unknown>
): void {
  const resolved = resolveRef(schema, rootSchema);

  if (Array.isArray(resolved.oneOf)) {
    const hasMatch = resolved.oneOf.some((branch) => {
      const branchErrors: ErrorObject[] = [];
      validateSchema(branch as Record<string, unknown>, payload, instancePath, branchErrors, rootSchema);
      return branchErrors.length === 0;
    });
    if (!hasMatch) {
      errors.push({ instancePath, message: 'must match one schema in oneOf' });
      return;
    }
  }

  if (Array.isArray(resolved.anyOf)) {
    const matched = resolved.anyOf.some((branch) => {
      const branchErrors: ErrorObject[] = [];
      validateSchema(branch as Record<string, unknown>, payload, instancePath, branchErrors, rootSchema);
      return branchErrors.length === 0;
    });
    if (!matched) {
      errors.push({ instancePath, message: 'must match at least one schema in anyOf' });
      return;
    }
  }

  if (Array.isArray(resolved.allOf)) {
    for (const branch of resolved.allOf) {
      validateSchema(branch as Record<string, unknown>, payload, instancePath, errors, rootSchema);
    }
  }

  if (resolved.const !== undefined && payload !== resolved.const) {
    errors.push({ instancePath, message: `must be ${String(resolved.const)}` });
    return;
  }

  if (Array.isArray(resolved.enum) && !resolved.enum.includes(payload)) {
    errors.push({ instancePath, message: 'must be equal to one of enum values' });
    return;
  }

  const declaredType = resolved.type;
  if (declaredType === 'object') {
    validateObject(resolved, payload, instancePath, errors, rootSchema);
    return;
  }

  if (declaredType === 'array') {
    validateArray(resolved, payload, instancePath, errors, rootSchema);
    return;
  }

  if (declaredType === 'string') {
    if (typeof payload !== 'string') {
      errors.push({ instancePath, message: 'must be string' });
      return;
    }
    if (typeof resolved.minLength === 'number' && payload.length < resolved.minLength) {
      errors.push({ instancePath, message: `must NOT have fewer than ${resolved.minLength} characters` });
      return;
    }
  }

  if (declaredType === 'integer' || declaredType === 'number') {
    if (typeof payload !== 'number' || (declaredType === 'integer' && !Number.isInteger(payload))) {
      errors.push({ instancePath, message: `must be ${declaredType}` });
      return;
    }
    if (typeof resolved.minimum === 'number' && payload < resolved.minimum) {
      errors.push({ instancePath, message: `must be >= ${resolved.minimum}` });
      return;
    }
    if (typeof resolved.maximum === 'number' && payload > resolved.maximum) {
      errors.push({ instancePath, message: `must be <= ${resolved.maximum}` });
      return;
    }
  }

  if (declaredType === 'boolean' && typeof payload !== 'boolean') {
    errors.push({ instancePath, message: 'must be boolean' });
  }
}

function validateObject(
  schema: Record<string, unknown>,
  payload: unknown,
  instancePath: string,
  errors: ErrorObject[],
  rootSchema: Record<string, unknown>
): void {
  if (!isPlainObject(payload)) {
    errors.push({ instancePath, message: 'must be object' });
    return;
  }

  const objectPayload = payload as Record<string, unknown>;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  for (const field of required) {
    if (!(field in objectPayload)) {
      errors.push({ instancePath, message: `must have required property '${field}'` });
    }
  }

  const properties = isPlainObject(schema.properties) ? (schema.properties as Record<string, unknown>) : {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in objectPayload && isPlainObject(propertySchema)) {
      validateSchema(
        propertySchema,
        objectPayload[key],
        `${instancePath}/${escapePointer(key)}`,
        errors,
        rootSchema
      );
    }
  }

  if (schema.additionalProperties === false) {
    const allowedKeys = new Set(Object.keys(properties));
    const patterns = isPlainObject(schema.patternProperties)
      ? Object.entries(schema.patternProperties as Record<string, unknown>)
      : [];

    for (const key of Object.keys(objectPayload)) {
      if (allowedKeys.has(key)) {
        continue;
      }

      const patternMatch = patterns.some(([pattern, patternSchema]) => {
        if (!new RegExp(pattern).test(key)) {
          return false;
        }
        if (isPlainObject(patternSchema)) {
          validateSchema(
            patternSchema,
            objectPayload[key],
            `${instancePath}/${escapePointer(key)}`,
            errors,
            rootSchema
          );
        }
        return true;
      });

      if (!patternMatch) {
        errors.push({ instancePath: `${instancePath}/${escapePointer(key)}`, message: 'must NOT have additional properties' });
      }
    }
  }
}

function validateArray(
  schema: Record<string, unknown>,
  payload: unknown,
  instancePath: string,
  errors: ErrorObject[],
  rootSchema: Record<string, unknown>
): void {
  if (!Array.isArray(payload)) {
    errors.push({ instancePath, message: 'must be array' });
    return;
  }

  const itemSchema = isPlainObject(schema.items) ? (schema.items as Record<string, unknown>) : null;
  if (!itemSchema) {
    return;
  }

  payload.forEach((value, index) => {
    validateSchema(itemSchema, value, `${instancePath}/${index}`, errors, rootSchema);
  });
}

function resolveRef(
  schema: Record<string, unknown>,
  rootSchema: Record<string, unknown>
): Record<string, unknown> {
  if (typeof schema.$ref !== 'string') {
    return schema;
  }

  if (!schema.$ref.startsWith('#/')) {
    return schema;
  }

  const pointer = schema.$ref.slice(2).split('/').map(unescapePointer);
  let target: unknown = rootSchema;

  for (const segment of pointer) {
    if (!isPlainObject(target) || !(segment in target)) {
      return schema;
    }
    target = (target as Record<string, unknown>)[segment];
  }

  if (!isPlainObject(target)) {
    return schema;
  }

  const { $ref: _ignored, ...inlineSchema } = schema;
  return {
    ...target,
    ...inlineSchema
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapePointer(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointer(value: string): string {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}
