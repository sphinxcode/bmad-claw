/**
 * Jest config for bmad-claw.
 * Uses ts-jest with ESM transform. Maps `openclaw/*` peer dep to a stub.
 */

export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // Stub out the openclaw peer dep (not installed in dev)
    "^openclaw/(.*)$": "<rootDir>/test/__mocks__/openclaw/$1.ts",
    // Strip .js extensions for ts-jest ESM resolution
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "node",
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  roots: ["<rootDir>/test", "<rootDir>/src"],
};
