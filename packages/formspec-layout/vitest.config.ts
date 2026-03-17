/** @filedesc Vitest configuration for the formspec-layout package. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
    },
});
