/**
 * hook.test.ts
 * Tests: before_prompt_build hook logic (unit — mocks fs reads)
 *
 * Hook now uses discoverBmadCandidates + selectActiveBmadCandidate.
 * Mock replaces the whole lib/bmad-paths module.
 */

// Mock at module level before any imports
jest.mock("../src/config/writer.js", () => ({
  readPluginConfig: jest.fn(),
}));

jest.mock("../src/lib/bmad-paths.js", () => ({
  discoverBmadCandidates: jest.fn(),
  selectActiveBmadCandidate: jest.fn(),
  openclawHome: () => "/fake/home/.openclaw",
  agentWorkspaceDir: (id: string) => `/fake/home/.openclaw/workspace-${id}`,
  agentDir: (id: string) => `/fake/home/.openclaw/agents/${id}/agent`,
  bmadIdentityDir: () => "/fake/home/.openclaw/identity/bmad",
  agentIdentityDir: (id: string) => `/fake/home/.openclaw/identity/bmad/${id}`,
  bmadConfigPaths: jest.fn(),
  defaultSharedBmadHome: () => "/fake/home/.openclaw/_bmad",
}));

jest.mock("../src/discovery/manifest-reader.js", () => ({
  readModuleVersions: jest.fn(),
  formatModuleBanner: jest.fn(),
}));

import { readPluginConfig } from "../src/config/writer.js";
import { discoverBmadCandidates, selectActiveBmadCandidate } from "../src/lib/bmad-paths.js";
import { readModuleVersions, formatModuleBanner } from "../src/discovery/manifest-reader.js";
import { registerBeforePromptBuildHook } from "../src/hooks/before-prompt-build.js";

const mockReadPluginConfig = readPluginConfig as jest.Mock;
const mockDiscoverCandidates = discoverBmadCandidates as jest.Mock;
const mockSelectActive = selectActiveBmadCandidate as jest.Mock;
const mockReadModuleVersions = readModuleVersions as jest.Mock;
const mockFormatModuleBanner = formatModuleBanner as jest.Mock;

type HookFn = (ctx: { agentId?: string; cwd?: string }) => Promise<Record<string, unknown>>;

let capturedHook: HookFn | null = null;

const mockApi = {
  registerHook: (event: string, cb: HookFn) => {
    if (event === "before_prompt_build") capturedHook = cb;
  },
};

const FAKE_ACTIVE_CANDIDATE = {
  path: "/fake/_bmad",
  source: "shared-config" as const,
  configDir: "/fake/_bmad/_config",
  valid: true,
};

const FAKE_PROJECT_CANDIDATE = {
  path: "/some/project/_bmad",
  source: "project" as const,
  configDir: "/some/project/_bmad/_config",
  valid: true,
};

beforeEach(() => {
  capturedHook = null;
  jest.clearAllMocks();
  registerBeforePromptBuildHook(mockApi as never);
});

describe("before_prompt_build hook", () => {
  it("returns {} when agentId not in boundAgents", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["some-other-agent"], sharedBmadHome: null });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/fake/cwd" });
    expect(result).toEqual({});
  });

  it("returns {} when agentId is undefined", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["bmad-agent-analyst"], sharedBmadHome: null });
    const result = await capturedHook!({ cwd: "/fake/cwd" });
    expect(result).toEqual({});
  });

  it("returns {} when no valid BMAD candidate found", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      sharedBmadHome: null,
    });
    mockDiscoverCandidates.mockReturnValue([]);
    mockSelectActive.mockReturnValue(null);

    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/no/bmad/here" });
    expect(result).toEqual({});
  });

  it("injects prependSystemContext banner when bound agent + BMAD found", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      sharedBmadHome: "/fake/_bmad",
    });
    mockDiscoverCandidates.mockReturnValue([FAKE_ACTIVE_CANDIDATE]);
    mockSelectActive.mockReturnValue(FAKE_ACTIVE_CANDIDATE);
    mockReadModuleVersions.mockReturnValue({ bmm: "6.3.0", _bmad: "6.3.0" });
    mockFormatModuleBanner.mockReturnValue("BMAD active (bmad-method 6.3.0): bmm@6.3.0");

    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/some/project" });
    expect(result).toHaveProperty("prependSystemContext");
    expect(result["prependSystemContext"]).toContain("BMAD");
  });

  it("uses project-local candidate when both project and shared are valid", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      sharedBmadHome: "/fake/_bmad",
    });
    // Discovery returns both; selectActive returns project (higher priority)
    mockDiscoverCandidates.mockReturnValue([FAKE_PROJECT_CANDIDATE, FAKE_ACTIVE_CANDIDATE]);
    mockSelectActive.mockReturnValue(FAKE_PROJECT_CANDIDATE);
    mockReadModuleVersions.mockReturnValue({ bmm: "6.3.0" });
    mockFormatModuleBanner.mockReturnValue("BMAD active (project-local)");

    await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/some/project" });

    // Verify readModuleVersions was called with the project-local path
    expect(mockReadModuleVersions).toHaveBeenCalledWith(FAKE_PROJECT_CANDIDATE.path);
  });

  it("passes cwd to discoverBmadCandidates", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      sharedBmadHome: null,
    });
    mockDiscoverCandidates.mockReturnValue([]);
    mockSelectActive.mockReturnValue(null);

    await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/custom/cwd" });

    expect(mockDiscoverCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/custom/cwd" }),
    );
  });

  it("returns {} without throwing when readPluginConfig throws", async () => {
    mockReadPluginConfig.mockImplementation(() => { throw new Error("disk error"); });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/any" });
    expect(result).toEqual({});
  });

  it("returns {} without throwing when discoverBmadCandidates throws", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["bmad-agent-analyst"], sharedBmadHome: null });
    mockDiscoverCandidates.mockImplementation(() => { throw new Error("path error"); });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/any" });
    expect(result).toEqual({});
  });
});
