/**
 * status.test.ts
 * Tests: statusCommand resolution chain display and diagnostics.
 * Unit — mocks detectBmad, readPluginConfig, and fs to avoid real I/O.
 */

jest.mock("../src/discovery/bmad-detect.js", () => ({
  detectBmad: jest.fn(),
}));

jest.mock("../src/config/writer.js", () => ({
  readPluginConfig: jest.fn(),
}));

jest.mock("node:fs", () => ({
  ...jest.requireActual("node:fs"),
  existsSync: jest.fn(() => false),
  readdirSync: jest.fn(() => []),
}));

jest.mock("../src/lib/bmad-paths.js", () => ({
  openclawHome: () => "/fake/.openclaw",
  defaultSharedBmadHome: () => "/fake/.openclaw/_bmad",
}));

import { detectBmad } from "../src/discovery/bmad-detect.js";
import { readPluginConfig } from "../src/config/writer.js";
import { statusCommand } from "../src/commands/status.js";
import type { BmadCandidate } from "../src/lib/bmad-paths.js";

const mockDetectBmad = detectBmad as jest.Mock;
const mockReadPluginConfig = readPluginConfig as jest.Mock;

const PROJECT_CANDIDATE: BmadCandidate = {
  path: "/my/project/_bmad",
  source: "project",
  configDir: "/my/project/_bmad/_config",
  valid: true,
};

const SHARED_CANDIDATE: BmadCandidate = {
  path: "/fake/.openclaw/_bmad",
  source: "shared-default",
  configDir: "/fake/.openclaw/_bmad/_config",
  valid: true,
};

const INVALID_PROJECT: BmadCandidate = {
  path: "/my/project/_bmad",
  source: "project",
  configDir: "/my/project/_bmad/_config",
  valid: false,
};

function captureConsoleOutput(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.join(" "));
  return fn().then(() => {
    console.log = original;
    return lines.join("\n");
  }).catch((err) => {
    console.log = original;
    throw err;
  });
}

describe("statusCommand — full mode (BMAD active)", () => {
  beforeEach(() => {
    mockReadPluginConfig.mockReturnValue({
      sharedBmadHome: null,
      installMode: "shared",
      boundAgents: [],
    });
    mockDetectBmad.mockReturnValue({
      mode: "full",
      detection: SHARED_CANDIDATE,
      candidates: [INVALID_PROJECT, SHARED_CANDIDATE],
      agents: [],
      workflows: [],
      versions: { bmm: "6.3.0", _bmad: "6.3.0" },
    });
  });

  it("prints full mode label", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("full (workflows available)");
  });

  it("prints active BMAD path", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("/fake/.openclaw/_bmad");
  });

  it("prints resolution chain with ACTIVE marker", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("ACTIVE");
  });

  it("prints resolution chain with missing marker for invalid candidate", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("missing");
  });

  it("prints source label for active candidate", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("shared");
  });

  it("prints module versions", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("bmm");
    expect(output).toContain("6.3.0");
  });
});

describe("statusCommand — project-local shadowing shared", () => {
  beforeEach(() => {
    mockReadPluginConfig.mockReturnValue({
      sharedBmadHome: "/fake/.openclaw/_bmad",
      installMode: "shared",
      boundAgents: [],
    });
    mockDetectBmad.mockReturnValue({
      mode: "full",
      detection: PROJECT_CANDIDATE,
      candidates: [PROJECT_CANDIDATE, SHARED_CANDIDATE],
      agents: [],
      workflows: [],
      versions: { bmm: "6.3.0" },
    });
  });

  it("marks project as ACTIVE", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    const lines = output.split("\n");
    // Find the ACTIVE line
    const activeLine = lines.find((l) => l.includes("ACTIVE"));
    expect(activeLine).toBeDefined();
    expect(activeLine).toContain("project-local");
  });

  it("marks shared as shadowed", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("shadowed");
  });
});

describe("statusCommand — persona-only mode (no BMAD)", () => {
  beforeEach(() => {
    mockReadPluginConfig.mockReturnValue({
      sharedBmadHome: null,
      installMode: null,
      boundAgents: [],
    });
    mockDetectBmad.mockReturnValue({
      mode: "persona-only",
      detection: null,
      candidates: [INVALID_PROJECT],
      agents: [],
      workflows: [],
      versions: {},
      fallbackVersion: "6.2.0-snapshot",
    });
  });

  it("prints persona-only mode label", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("persona-only");
  });

  it("prints fallback snapshot version", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("6.2.0-snapshot");
  });

  it("says none detected for active BMAD", async () => {
    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("none");
  });
});

describe("statusCommand — bound agents display", () => {
  it("shows bound agent IDs with workspace check", async () => {
    mockReadPluginConfig.mockReturnValue({
      sharedBmadHome: null,
      installMode: null,
      boundAgents: ["bmad-agent-analyst"],
    });
    mockDetectBmad.mockReturnValue({
      mode: "persona-only",
      detection: null,
      candidates: [],
      agents: [],
      workflows: [],
      versions: {},
    });

    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("bmad-agent-analyst");
  });

  it("shows (none) when no bound agents", async () => {
    mockReadPluginConfig.mockReturnValue({
      sharedBmadHome: null,
      installMode: null,
      boundAgents: [],
    });
    mockDetectBmad.mockReturnValue({
      mode: "persona-only",
      detection: null,
      candidates: [],
      agents: [],
      workflows: [],
      versions: {},
    });

    const output = await captureConsoleOutput(() => statusCommand());
    expect(output).toContain("none");
  });
});
