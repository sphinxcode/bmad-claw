/**
 * install.test.ts
 * Tests: installCommand with --auto flag using mocked config writer.
 * Verifies: agents added, boundAgents updated, idempotent on second run.
 */

import { join } from "node:path";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import * as os from "node:os";

// We mock config/writer so install writes to a temp fixture instead of real ~/.openclaw
const FIXTURE_OPENCLAW = join(__dirname, "fixtures", "openclaw.json");
const FIXTURE_BMAD = join(__dirname, "fixtures", "_bmad");

// In-memory state for the mocked openclaw.json
let mockConfig: Record<string, unknown> = {};

function resetMockConfig(): void {
  mockConfig = JSON.parse(readFileSync(FIXTURE_OPENCLAW, "utf-8"));
}

jest.mock("../src/config/writer.js", () => ({
  readPluginConfig: jest.fn(() => {
    const conf = mockConfig as {
      plugins?: { entries?: { "bmad-claw"?: { config?: Record<string, unknown> } } };
    };
    return conf.plugins?.entries?.["bmad-claw"]?.config ?? {};
  }),
  writePluginConfig: jest.fn((updates: Record<string, unknown>) => {
    const conf = mockConfig as {
      plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> };
    };
    if (!conf.plugins) conf.plugins = {};
    if (!conf.plugins.entries) conf.plugins.entries = {};
    if (!conf.plugins.entries["bmad-claw"]) {
      conf.plugins.entries["bmad-claw"] = { config: {} };
    }
    Object.assign(conf.plugins.entries["bmad-claw"]!.config!, updates);
  }),
  addAgent: jest.fn((agentId: string, displayName: string): boolean => {
    const conf = mockConfig as {
      agents?: { list?: Array<{ id: string; name: string; workspace: string; agentDir: string }> };
    };
    if (!conf.agents) conf.agents = {};
    if (!conf.agents.list) conf.agents.list = [];
    const exists = conf.agents.list.some((a) => a.id === agentId);
    if (exists) return false;
    conf.agents.list.push({ id: agentId, name: displayName, workspace: `/fake/${agentId}`, agentDir: `/fake/${agentId}/agent` });
    return true;
  }),
  addBoundAgent: jest.fn((agentId: string) => {
    const conf = mockConfig as {
      plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> };
    };
    const pluginConf = conf.plugins?.entries?.["bmad-claw"]?.config ?? {};
    const bound = (pluginConf["boundAgents"] as string[] | undefined) ?? [];
    if (!bound.includes(agentId)) {
      bound.push(agentId);
      pluginConf["boundAgents"] = bound;
    }
  }),
  agentExists: jest.fn((agentId: string): boolean => {
    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    return (conf.agents?.list ?? []).some((a) => a.id === agentId);
  }),
}));

// Mock syncer to avoid writing real filesystem identity files
jest.mock("../src/identity/syncer.js", () => ({
  syncIdentity: jest.fn(() => ({ created: true, path: "/fake/path" })),
}));

// Mock detectBmad to use fixture BMAD path — we want controlled persona data
jest.mock("../src/discovery/bmad-detect.js", () => {
  const FIXTURE_BMAD_PATH = join(__dirname, "fixtures", "_bmad");
  return {
    detectBmad: jest.fn(() => ({
      mode: "full" as const,
      detection: { path: FIXTURE_BMAD_PATH, source: "config", configDir: `${FIXTURE_BMAD_PATH}/_config` },
      agents: [
        {
          name: "bmad-agent-analyst",
          displayName: "Mary",
          title: "Business Analyst",
          icon: "📊",
          capabilities: "market research",
          role: "Strategic Business Analyst",
          identity: "Senior analyst with expertise.",
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
      ],
      workflows: [],
      versions: { bmm: "6.3.0", _bmad: "6.3.0" },
    })),
  };
});

import { installCommand } from "../src/commands/install.js";
import { addAgent, addBoundAgent, readPluginConfig } from "../src/config/writer.js";

const mockAddAgent = addAgent as jest.Mock;
const mockAddBoundAgent = addBoundAgent as jest.Mock;

beforeEach(() => {
  resetMockConfig();
  jest.clearAllMocks();
  // Restore mocks from initial mockConfig after clear
  (readPluginConfig as jest.Mock).mockImplementation(() => {
    const conf = mockConfig as {
      plugins?: { entries?: { "bmad-claw"?: { config?: Record<string, unknown> } } };
    };
    return conf.plugins?.entries?.["bmad-claw"]?.config ?? {};
  });
  (addAgent as jest.Mock).mockImplementation((agentId: string, displayName: string): boolean => {
    const conf = mockConfig as {
      agents?: { list?: Array<{ id: string; name: string; workspace: string; agentDir: string }> };
    };
    if (!conf.agents) conf.agents = {};
    if (!conf.agents.list) conf.agents.list = [];
    const exists = conf.agents.list.some((a) => a.id === agentId);
    if (exists) return false;
    conf.agents.list.push({ id: agentId, name: displayName, workspace: `/fake/${agentId}`, agentDir: `/fake/${agentId}/agent` });
    return true;
  });
  (addBoundAgent as jest.Mock).mockImplementation((agentId: string) => {
    const conf = mockConfig as {
      plugins?: { entries?: Record<string, { config?: Record<string, unknown> }> };
    };
    if (!conf.plugins) conf.plugins = {};
    if (!conf.plugins.entries) conf.plugins.entries = {};
    if (!conf.plugins.entries["bmad-claw"]) conf.plugins.entries["bmad-claw"] = { config: {} };
    const pluginConf = conf.plugins.entries["bmad-claw"]!.config!;
    const bound = (pluginConf["boundAgents"] as string[] | undefined) ?? [];
    if (!bound.includes(agentId)) {
      bound.push(agentId);
      pluginConf["boundAgents"] = bound;
    }
  });
});

describe("installCommand --auto", () => {
  it("adds agents to openclaw.json for default-selected modules", async () => {
    await installCommand(["--auto"]);

    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    const agentIds = (conf.agents?.list ?? []).map((a) => a.id);

    // Mary and John are both bmm module — default selected
    expect(agentIds).toContain("bmad-agent-analyst");
    expect(agentIds).toContain("bmad-agent-pm");
  });

  it("calls addAgent for each selected agent", async () => {
    await installCommand(["--auto"]);
    expect(mockAddAgent).toHaveBeenCalledWith("bmad-agent-analyst", "Mary");
    expect(mockAddAgent).toHaveBeenCalledWith("bmad-agent-pm", "John");
  });

  it("calls addBoundAgent for each selected agent", async () => {
    await installCommand(["--auto"]);
    expect(mockAddBoundAgent).toHaveBeenCalledWith("bmad-agent-analyst");
    expect(mockAddBoundAgent).toHaveBeenCalledWith("bmad-agent-pm");
  });

  it("is idempotent on second run — addAgent returns false, no duplicates", async () => {
    await installCommand(["--auto"]);
    const firstCallCount = mockAddAgent.mock.calls.length;

    await installCommand(["--auto"]);

    const conf = mockConfig as { agents?: { list?: Array<{ id: string }> } };
    const agentIds = (conf.agents?.list ?? []).map((a) => a.id);

    // No duplicate entries
    const uniqueIds = new Set(agentIds);
    expect(uniqueIds.size).toBe(agentIds.length);

    // addAgent called both times but returned false second time
    expect(mockAddAgent.mock.calls.length).toBe(firstCallCount * 2);
    const secondRunReturnValues = mockAddAgent.mock.results.slice(firstCallCount);
    for (const result of secondRunReturnValues) {
      expect(result.value).toBe(false); // idempotent — already exists
    }
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
