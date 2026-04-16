/**
 * install.test.ts
 * Tests: installCommand with --auto flag using mocked config writer.
 * Verifies: agents added, boundAgents updated, idempotent on second run,
 *           sharedBmadHome written (not deprecated bmadHome), config migration.
 */

import { join } from "node:path";
import { readFileSync } from "node:fs";

const FIXTURE_OPENCLAW = join(__dirname, "fixtures", "openclaw.json");
const FIXTURE_BMAD = join(__dirname, "fixtures", "_bmad");

// ─── In-memory mock config ────────────────────────────────────────────────────

let mockConfig: Record<string, unknown> = {};

function resetMockConfig(): void {
  mockConfig = JSON.parse(readFileSync(FIXTURE_OPENCLAW, "utf-8"));
}

function getPluginConf(): Record<string, unknown> {
  const conf = mockConfig as {
    plugins?: { entries?: { "bmad-claw"?: { config?: Record<string, unknown> } } };
  };
  return conf.plugins?.entries?.["bmad-claw"]?.config ?? {};
}

function setPluginConf(updates: Record<string, unknown>): void {
  const conf = mockConfig as {
    plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> };
  };
  if (!conf.plugins) conf.plugins = {};
  if (!conf.plugins.entries) conf.plugins.entries = {};
  if (!conf.plugins.entries["bmad-claw"]) conf.plugins.entries["bmad-claw"] = { config: {} };
  Object.assign(conf.plugins.entries["bmad-claw"]!.config!, updates);
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../src/config/writer.js", () => ({
  readPluginConfig: jest.fn(),
  writePluginConfig: jest.fn((updates: Record<string, unknown>) => setPluginConf(updates)),
  addAgentsBatch: jest.fn((agents: Array<{ agentId: string; displayName: string }>) => {
    const conf = mockConfig as {
      agents?: { list?: Array<{ id: string; name: string; workspace: string; agentDir: string }> };
      plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> };
    };
    if (!conf.agents) conf.agents = {};
    if (!conf.agents.list) conf.agents.list = [];
    if (!conf.plugins) conf.plugins = {};
    if (!conf.plugins.entries) conf.plugins.entries = {};
    if (!conf.plugins.entries["bmad-claw"]) conf.plugins.entries["bmad-claw"] = { config: {} };
    const pluginConf = conf.plugins.entries["bmad-claw"]!.config!;
    const bound = (pluginConf["boundAgents"] as string[] | undefined) ?? [];

    const added: string[] = [];
    const skipped: string[] = [];
    for (const { agentId, displayName } of agents) {
      const exists = conf.agents.list!.some((a) => a.id === agentId);
      if (!exists) {
        conf.agents.list!.push({ id: agentId, name: displayName, workspace: `/fake/${agentId}`, agentDir: `/fake/${agentId}/agent` });
        added.push(agentId);
      } else {
        skipped.push(agentId);
      }
      if (!bound.includes(agentId)) bound.push(agentId);
    }
    pluginConf["boundAgents"] = bound;
    return { added, skipped };
  }),
  agentExists: jest.fn((agentId: string): boolean => {
    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    return (conf.agents?.list ?? []).some((a) => a.id === agentId);
  }),
}));

jest.mock("../src/identity/syncer.js", () => ({
  syncIdentity: jest.fn(() => ({ created: true, path: "/fake/path" })),
}));

const MOCK_AGENTS = [
  {
    name: "bmad-agent-analyst",
    displayName: "Mary",
    title: "Business Analyst",
    icon: "📊",
    capabilities: "market research",
    role: "Strategic Business Analyst",
    identity: "Senior analyst.",
    communicationStyle: "Excited and precise.",
    principles: "Ground findings in evidence.",
    module: "bmm",
    path: "_bmad/bmm/agents/analyst",
    canonicalId: "",
  },
  {
    name: "bmad-agent-pm",
    displayName: "John",
    title: "Product Manager",
    icon: "📋",
    capabilities: "PRD creation",
    role: "Product Manager",
    identity: "Product veteran.",
    communicationStyle: "Asks WHY relentlessly.",
    principles: "PRDs emerge from users.",
    module: "bmm",
    path: "_bmad/bmm/agents/pm",
    canonicalId: "",
  },
];

const FULL_CTX = {
  mode: "full" as const,
  detection: { path: FIXTURE_BMAD, source: "shared-config" as const, configDir: `${FIXTURE_BMAD}/_config`, valid: true },
  candidates: [{ path: FIXTURE_BMAD, source: "shared-config" as const, configDir: `${FIXTURE_BMAD}/_config`, valid: true }],
  agents: MOCK_AGENTS,
  workflows: [],
  versions: { bmm: "6.3.0", _bmad: "6.3.0" },
};

const PERSONA_ONLY_CTX = {
  mode: "persona-only" as const,
  detection: null,
  candidates: [],
  agents: MOCK_AGENTS,
  workflows: [],
  versions: {},
  fallbackVersion: "6.2.0-snapshot",
};

jest.mock("../src/discovery/bmad-detect.js", () => ({
  detectBmad: jest.fn(),
}));

import { installCommand } from "../src/commands/install.js";
import { addAgentsBatch, writePluginConfig, readPluginConfig } from "../src/config/writer.js";
import { detectBmad } from "../src/discovery/bmad-detect.js";

const mockDetectBmad = detectBmad as jest.Mock;
const mockAddAgentsBatch = addAgentsBatch as jest.Mock;
const mockWritePluginConfig = writePluginConfig as jest.Mock;

// ─── Test helpers ─────────────────────────────────────────────────────────────

function setupReadPluginConfig(overrides: Record<string, unknown> = {}): void {
  (readPluginConfig as jest.Mock).mockImplementation(() => ({
    sharedBmadHome: null,
    installMode: null,
    boundAgents: [],
    defaultMode: "persona-only",
    ...overrides,
    ...getPluginConf(), // reflect any writes during test
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockConfig();
  jest.clearAllMocks();
  mockDetectBmad.mockReturnValue(FULL_CTX);
  (readPluginConfig as jest.Mock).mockImplementation(() => ({
    sharedBmadHome: null,
    installMode: null,
    boundAgents: [],
    defaultMode: "persona-only",
  }));
});

describe("installCommand --auto", () => {
  it("adds agents to mockConfig for default-selected modules", async () => {
    await installCommand(["--auto"]);
    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    const ids = (conf.agents?.list ?? []).map((a) => a.id);
    expect(ids).toContain("bmad-agent-analyst");
    expect(ids).toContain("bmad-agent-pm");
  });

  it("calls addAgentsBatch with all selected agents in one call", async () => {
    await installCommand(["--auto"]);
    expect(mockAddAgentsBatch).toHaveBeenCalledTimes(1);
    const callArg = mockAddAgentsBatch.mock.calls[0][0] as Array<{ agentId: string }>;
    const ids = callArg.map((a) => a.agentId);
    expect(ids).toContain("bmad-agent-analyst");
    expect(ids).toContain("bmad-agent-pm");
  });

  it("writes sharedBmadHome (not deprecated bmadHome) when BMAD detected", async () => {
    await installCommand(["--auto"]);
    // At least one call to writePluginConfig with sharedBmadHome
    const sharedCalls = mockWritePluginConfig.mock.calls.filter(
      (args) => "sharedBmadHome" in args[0],
    );
    expect(sharedCalls.length).toBeGreaterThan(0);
    expect(sharedCalls[0][0].sharedBmadHome).toBe(FIXTURE_BMAD);
  });

  it("does NOT write deprecated bmadHome field directly", async () => {
    await installCommand(["--auto"]);
    const bmadHomeCalls = mockWritePluginConfig.mock.calls.filter(
      (args) => "bmadHome" in args[0] && !("sharedBmadHome" in args[0]),
    );
    expect(bmadHomeCalls.length).toBe(0);
  });

  it("is idempotent — second run skips already-registered agents", async () => {
    await installCommand(["--auto"]);
    const firstBatchResult = mockAddAgentsBatch.mock.results[0]?.value;
    expect(firstBatchResult?.added?.length).toBeGreaterThan(0);

    await installCommand(["--auto"]);
    const secondBatchResult = mockAddAgentsBatch.mock.results[1]?.value;
    expect(secondBatchResult?.skipped?.length).toBeGreaterThan(0);
    expect(secondBatchResult?.added?.length ?? 0).toBe(0);
  });

  it("no duplicate agents in list after two runs", async () => {
    await installCommand(["--auto"]);
    await installCommand(["--auto"]);
    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    const ids = (conf.agents?.list ?? []).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("updates boundAgents in plugin config", async () => {
    await installCommand(["--auto"]);
    const conf = mockConfig as {
      plugins?: { entries?: { "bmad-claw"?: { config?: { boundAgents?: string[] } } } };
    };
    const bound = conf.plugins?.entries?.["bmad-claw"]?.config?.boundAgents ?? [];
    expect(bound).toContain("bmad-agent-analyst");
    expect(bound).toContain("bmad-agent-pm");
  });
});

describe("installCommand --auto — persona-only (no BMAD)", () => {
  beforeEach(() => {
    mockDetectBmad.mockReturnValue(PERSONA_ONLY_CTX);
  });

  it("still installs agents in persona-only mode", async () => {
    await installCommand(["--auto"]);
    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    const ids = (conf.agents?.list ?? []).map((a) => a.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("writes defaultMode: persona-only", async () => {
    await installCommand(["--auto"]);
    const modeCalls = mockWritePluginConfig.mock.calls.filter(
      (args) => args[0].defaultMode === "persona-only",
    );
    expect(modeCalls.length).toBeGreaterThan(0);
  });
});

describe("installCommand — config migration (legacy bmadHome)", () => {
  it("reads sharedBmadHome from migrateConfig output (not raw bmadHome)", async () => {
    // Simulate a legacy config where only bmadHome exists
    (readPluginConfig as jest.Mock).mockReturnValue({
      bmadHome: FIXTURE_BMAD,         // legacy field
      sharedBmadHome: FIXTURE_BMAD,   // migrateConfig promotes it
      installMode: null,
      boundAgents: [],
      defaultMode: "full",
    });

    // detectBmad should be called with sharedBmadHome from migrateConfig output
    await installCommand(["--auto"]);

    expect(mockDetectBmad).toHaveBeenCalledWith(
      expect.objectContaining({ sharedBmadHome: expect.anything() }),
    );
  });
});
