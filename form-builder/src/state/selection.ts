import { signal } from '@preact/signals';
import type { InlineAddState } from '../types';

export const selectedPath = signal<string | null>(null);
export const inlineAddState = signal<InlineAddState | null>(null);
