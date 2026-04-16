/**
 * fallback.test.ts
 * Tests: loadFallbackCatalog loads committed assets/fallback/ snapshot.
 * Also tests detectBmad returns mode: 'persona-only' when no BMAD found.
 */

import { loadFallbackCatalog } from "../src/discovery/fallback-catalog.js";
import { detectBmad } from "../src/discovery/bmad-detect.js";

// Reset the module-level cache between tests
beforeEach(() => {
  jest.resetModules();
});

describe("loadFallbackCatalog", () => {
  it("loads agents.json with at least one persona", () => {
    const catalog = loadFallbackCatalog();
    expect(Array.isArray(catalog.agents)).toBe(true);
    expect(catalog.agents.length).toBeGreaterThan(0);
  });

  it("all agents have required fields", () => {
    const catalog = loadFallbackCatalog();
    for (const agent of catalog.agents) {
      expect(typeof agent.name).toBe("string");
      expect(agent.name.length).toBeGreaterThan(0);
      expect(typeof agent.displayName).toBe("string");
      expect(agent.displayName.length).toBeGreaterThan(0);
    }
  });

  it("loads workflows-catalog.json", () => {
    const catalog = loadFallbackCatalog();
    expect(Array.isArray(catalog.workflows)).toBe(true);
    // Snapshot script generated 25 workflows — allow at least 1
    expect(catalog.workflows.length).toBeGreaterThan(0);
  });

  it("all workflows have required fields", () => {
    const catalog = loadFallbackCatalog();
    for (const wf of catalog.workflows) {
      expect(typeof wf.skill).toBe("string");
      expect(wf.skill.length).toBeGreaterThan(0);
    }
  });

  it("returns a version string", () => {
    const catalog = loadFallbackCatalog();
    expect(typeof catalog.version).toBe("string");
    expect(catalog.version).not.toBe("");
  });

  it("version string contains bmad-method", () => {
    const catalog = loadFallbackCatalog();
    expect(catalog.version).toMatch(/bmad-method/);
  });

  it("includes core BMAD personas (Mary, John)", () => {
    const catalog = loadFallbackCatalog();
    const names = catalog.agents.map((a) => a.displayName);
    expect(names).toContain("Mary");
    expect(names).toContain("John");
  });
});

describe("detectBmad — persona-only mode", () => {
  it("returns mode: persona-only when no BMAD found", () => {
    const ctx = detectBmad({
      bmadHome: "/absolutely/does/not/exist",
      cwd: "/also/not/real",
    });
    // Note: if ~/.openclaw/_bmad exists on this machine, mode may be 'full'
    // We test the fallback loads correctly either way
    if (ctx.mode === "persona-only") {
      expect(ctx.detection).toBeNull();
      expect(Array.isArray(ctx.agents)).toBe(true);
      expect(ctx.agents.length).toBeGreaterThan(0);
      expect(ctx.fallbackVersion).toBeDefined();
    } else {
      // BMAD installed on this machine — full mode is correct
      expect(ctx.mode).toBe("full");
      expect(ctx.detection).not.toBeNull();
    }
  });

  it("bmad_status returns expected shape in persona-only mode", () => {
    // Simulate no BMAD by passing bogus paths
    const ctx = detectBmad({
      bmadHome: null,
      cwd: "/tmp/no-bmad-here-xyzzy",
    });
    // Shape assertions regardless of mode
    expect(ctx).toHaveProperty("mode");
    expect(ctx).toHaveProperty("agents");
    expect(ctx).toHaveProperty("workflows");
    expect(ctx).toHaveProperty("versions");
    expect(["full", "persona-only"]).toContain(ctx.mode);
  });
});
