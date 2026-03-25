/** @filedesc Vitest configuration for the formspec-adapters package (happy-dom environment). */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts'],
    },
});
