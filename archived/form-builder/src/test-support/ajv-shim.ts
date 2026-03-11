/**
 * Test shim for ajv — provides a minimal stub so that modules importing
 * ajv/dist/2020 can load without the full ajv package being resolvable
 * through Vite's import analysis.
 */

export interface ErrorObject {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, unknown>;
  message?: string;
}

type ValidateFunction = ((data: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

class Ajv2020 {
  compile(_schema: Record<string, unknown>): ValidateFunction {
    const validate: ValidateFunction = (_data: unknown) => true;
    validate.errors = null;
    return validate;
  }
}

export default Ajv2020;
export type { ValidateFunction };
