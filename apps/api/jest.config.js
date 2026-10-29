/** @type {import('jest').Config} */
const common = {
  rootDir: __dirname,
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  // En pruebas, el paquete compartido se usa desde su código fuente (no hace falta compilarlo).
  moduleNameMapper: { '^@picanteria/shared$': '<rootDir>/../../packages/shared/src/index.ts' },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...common,
      displayName: 'acceptance',
      testMatch: ['<rootDir>/test/**/*.acceptance.spec.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
  ],
};
