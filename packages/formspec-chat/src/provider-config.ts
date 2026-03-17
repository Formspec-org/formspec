/** @filedesc Validates AI provider configuration (provider type and API key). */
import type { ProviderConfig, ProviderType } from './types.js';

export interface ProviderValidationError {
  field: string;
  message: string;
}

const VALID_PROVIDERS: ProviderType[] = ['anthropic', 'google', 'openai'];

export function validateProviderConfig(config: ProviderConfig): ProviderValidationError[] {
  const errors: ProviderValidationError[] = [];

  if (!VALID_PROVIDERS.includes(config.provider)) {
    errors.push({
      field: 'provider',
      message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
    });
  }

  if (!config.apiKey || !config.apiKey.trim()) {
    errors.push({
      field: 'apiKey',
      message: 'API key is required',
    });
  }

  return errors;
}
