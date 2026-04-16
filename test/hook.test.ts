/**
 * hook.test.ts
 * Tests: before_prompt_build hook logic (unit — mocks fs reads)
 */

import { join } from "node:path";

// We test the hook logic directly by calling the inner function logic.
// The hook reads pluginConfig then resolveBmadPath. We mock at the module level.

jest.mock("../src/config/writer.js", () => ({
  readPluginConfig: jest.fn(),
}));

jest.mock("../src/lib/bmad-paths.js", () => ({
  resolveBmadPath: jest.fn(),
  openclawHome: () => "/fake/home/.openclaw",
  agentWorkspaceDir: (id: string) => `/fake/home/.openclaw/workspace-${id}`,
  agentDir: (id: string) => `/fake/home/.openclaw/agents/${id}/agent`,
  bmadIdentityDir: () => "/fake/home/.openclaw/identity/bmad",
  agentIdentityDir: (id: string) => `/fake/home/.openclaw/identity/bmad/${id}`,
  bmadConfigPaths: jest.fn(),
}));

jest.mock("../src/discovery/manifest-reader.js", () => ({
  readModuleVersions: jest.fn(),
  formatModuleBanner: jest.fn(),
}));

import { readPluginConfig } from "../src/config/writer.js";
import { resolveBmadPath } from "../src/lib/bmad-paths.js";
import { readModuleVersions, formatModuleBanner } from "../src/discovery/manifest-reader.js";

// Import the actual hook registration function but mock OpenClawPluginApi
import { registerBeforePromptBuildHook } from "../src/hooks/before-prompt-build.js";

const mockReadPluginConfig = readPluginConfig as jest.Mock;
const mockResolveBmadPath = resolveBmadPath as jest.Mock;
const mockReadModuleVersions = readModuleVersions as jest.Mock;
const mockFormatModuleBanner = formatModuleBanner as jest.Mock;

// Capture the registered hook callback
let capturedHook: ((ctx: { agentId?: string; cwd?: string }) => Promise<Record<string, unknown>>) | null = null;

const mockApi = {
  registerHook: (event: string, cb: typeof capturedHook) => {
    if (event === "before_prompt_build") capturedHook = cb;
  },
};

beforeEach(() => {
  capturedHook = null;
  jest.clearAllMocks();
  registerBeforePromptBuildHook(mockApi as never);
});

describe("before_prompt_build hook", () => {
  it("returns {} when agentId not in boundAgents", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["some-other-agent"] });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/fake/cwd" });
    expect(result).toEqual({});
  });

  it("returns {} when agentId is undefined", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["bmad-agent-analyst"] });
    const result = await capturedHook!({ cwd: "/fake/cwd" });
    expect(result).toEqual({});
  });

  it("returns {} when BMAD not found in cwd", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      bmadHome: null,
    });
    mockResolveBmadPath.mockReturnValue(null);

    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/no/bmad/here" });
    expect(result).toEqual({});
  });

  it("injects prependSystemContext banner when bound agent + BMAD found", async () => {
    mockReadPluginConfig.mockReturnValue({
      boundAgents: ["bmad-agent-analyst"],
      bmadHome: "/fake/_bmad",
    });
    mockResolveBmadPath.mockReturnValue({
      path: "/fake/_bmad",
      source: "config",
      configDir: "/fake/_bmad/_config",
    });
    mockReadModuleVersions.mockReturnValue({ bmm: "6.3.0", _bmad: "6.3.0" });
    mockFormatModuleBanner.mockReturnValue("BMAD active (bmad-method 6.3.0): bmm@6.3.0");

    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/some/project" });
    expect(result).toHaveProperty("prependSystemContext");
    expect(result["prependSystemContext"]).toContain("BMAD");
  });

  it("returns {} without throwing when readPluginConfig throws", async () => {
    mockReadPluginConfig.mockImplementation(() => { throw new Error("disk error"); });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/any" });
    expect(result).toEqual({});
  });

  it("returns {} without throwing when resolveBmadPath throws", async () => {
    mockReadPluginConfig.mockReturnValue({ boundAgents: ["bmad-agent-analyst"], bmadHome: null });
    mockResolveBmadPath.mockImplementation(() => { throw new Error("path error"); });
    const result = await capturedHook!({ agentId: "bmad-agent-analyst", cwd: "/any" });
    expect(result).toEqual({});
  });
});
