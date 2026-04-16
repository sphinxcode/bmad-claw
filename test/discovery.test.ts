/**
 * discovery.test.ts
 * Tests: discoverBmadCandidates, selectActiveBmadCandidate, resolveBmadPath (compat),
 *        readAgentManifest, readModuleVersions
 * Uses test/fixtures/_bmad/_config/ as a real BMAD install fixture.
 */

import { join } from "node:path";
import {
  resolveBmadPath,
  discoverBmadCandidates,
  selectActiveBmadCandidate,
} from "../src/lib/bmad-paths.js";
import { readAgentManifest, readModuleVersions } from "../src/discovery/manifest-reader.js";

const FIXTURES_DIR = join(__dirname, "fixtures");
const FIXTURE_BMAD = join(FIXTURES_DIR, "_bmad");
const BOGUS_DIR = join(FIXTURES_DIR, "nonexistent-xyz");

// ─── discoverBmadCandidates ───────────────────────────────────────────────────

describe("discoverBmadCandidates", () => {
  it("returns project candidate first", () => {
    const candidates = discoverBmadCandidates({ cwd: FIXTURES_DIR });
    expect(candidates[0].source).toBe("project");
  });

  it("project candidate path is cwd/_bmad", () => {
    const candidates = discoverBmadCandidates({ cwd: FIXTURES_DIR });
    expect(candidates[0].path).toBe(join(FIXTURES_DIR, "_bmad"));
  });

  it("marks project candidate valid when manifest.yaml present in fixture", () => {
    const candidates = discoverBmadCandidates({ cwd: FIXTURES_DIR });
    const proj = candidates.find((c) => c.source === "project")!;
    expect(proj.valid).toBe(true);
  });

  it("includes shared-config candidate when sharedBmadHome provided", () => {
    const candidates = discoverBmadCandidates({
      sharedBmadHome: FIXTURE_BMAD,
      cwd: BOGUS_DIR,
    });
    const shared = candidates.find((c) => c.source === "shared-config");
    expect(shared).toBeDefined();
    expect(shared!.path).toBe(FIXTURE_BMAD);
  });

  it("marks shared-config candidate valid when it points to fixture", () => {
    const candidates = discoverBmadCandidates({
      sharedBmadHome: FIXTURE_BMAD,
      cwd: BOGUS_DIR,
    });
    const shared = candidates.find((c) => c.source === "shared-config")!;
    expect(shared.valid).toBe(true);
  });

  it("always includes shared-default candidate", () => {
    const candidates = discoverBmadCandidates({ cwd: BOGUS_DIR });
    const def = candidates.find((c) => c.source === "shared-default");
    expect(def).toBeDefined();
  });

  it("does not duplicate shared-default when sharedBmadHome matches default path", () => {
    const { homedir } = require("node:os");
    const defaultPath = join(homedir(), ".openclaw", "_bmad");
    const candidates = discoverBmadCandidates({
      sharedBmadHome: defaultPath,
      cwd: BOGUS_DIR,
    });
    const defaults = candidates.filter((c) => c.source === "shared-default");
    const configs = candidates.filter((c) => c.source === "shared-config");
    // When sharedBmadHome equals defaultShared, only shared-config is added
    expect(defaults.length).toBe(0);
    expect(configs.length).toBe(1);
  });

  it("marks invalid candidates as valid:false", () => {
    const candidates = discoverBmadCandidates({
      sharedBmadHome: "/completely/fake/path/_bmad",
      cwd: BOGUS_DIR,
    });
    const invalid = candidates.filter((c) => !c.valid);
    expect(invalid.length).toBeGreaterThan(0);
  });

  it("all candidates include configDir pointing to _config", () => {
    const candidates = discoverBmadCandidates({ cwd: FIXTURES_DIR, sharedBmadHome: FIXTURE_BMAD });
    for (const c of candidates) {
      expect(c.configDir).toContain("_config");
    }
  });
});

// ─── selectActiveBmadCandidate ────────────────────────────────────────────────

describe("selectActiveBmadCandidate", () => {
  it("returns null when no valid candidates", () => {
    // Force all invalid
    const allInvalid = [
      { path: "/fake/a", source: "project" as const, configDir: "/fake/a/_config", valid: false },
      { path: "/fake/b", source: "shared-config" as const, configDir: "/fake/b/_config", valid: false },
      { path: "/fake/c", source: "shared-default" as const, configDir: "/fake/c/_config", valid: false },
    ];
    expect(selectActiveBmadCandidate(allInvalid)).toBeNull();
  });

  it("returns first valid candidate", () => {
    const candidates = discoverBmadCandidates({ cwd: FIXTURES_DIR });
    const active = selectActiveBmadCandidate(candidates);
    expect(active).not.toBeNull();
    expect(active!.valid).toBe(true);
  });

  it("project wins over shared-config when both valid", () => {
    // Both project (fixture dir) and shared-config point to valid installs
    const candidates = discoverBmadCandidates({
      sharedBmadHome: FIXTURE_BMAD,
      cwd: FIXTURES_DIR,
    });
    const active = selectActiveBmadCandidate(candidates);
    expect(active!.source).toBe("project");
  });

  it("shared-config wins when project is absent", () => {
    const candidates = discoverBmadCandidates({
      sharedBmadHome: FIXTURE_BMAD,
      cwd: BOGUS_DIR, // no project _bmad
    });
    const active = selectActiveBmadCandidate(candidates);
    expect(active).not.toBeNull();
    expect(active!.source).toBe("shared-config");
    expect(active!.path).toBe(FIXTURE_BMAD);
  });

  it("returns the only valid candidate regardless of position", () => {
    const mixed = [
      { path: "/fake/a", source: "project" as const, configDir: "/fake/a/_config", valid: false },
      { path: FIXTURE_BMAD, source: "shared-config" as const, configDir: join(FIXTURE_BMAD, "_config"), valid: true },
    ];
    const active = selectActiveBmadCandidate(mixed);
    expect(active!.source).toBe("shared-config");
  });
});

// ─── resolveBmadPath (backward compat wrapper) ───────────────────────────────

describe("resolveBmadPath", () => {
  it("detects via explicit bmadHome (maps shared-config → legacy 'config' source)", () => {
    const result = resolveBmadPath({ bmadHome: FIXTURE_BMAD });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("config");
    expect(result!.path).toBe(FIXTURE_BMAD);
  });

  it("detects via cwd/_bmad when manifest.yaml present", () => {
    const result = resolveBmadPath({ cwd: FIXTURES_DIR });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("cwd");
  });

  it("accepts sharedBmadHome (new field) alongside deprecated bmadHome", () => {
    const result = resolveBmadPath({ sharedBmadHome: FIXTURE_BMAD, cwd: BOGUS_DIR });
    expect(result).not.toBeNull();
    expect(result!.path).toBe(FIXTURE_BMAD);
  });

  it("returns null for bogus explicit bmadHome when cwd also absent", () => {
    const result = resolveBmadPath({
      bmadHome: "/absolutely/does/not/exist",
      cwd: BOGUS_DIR,
    });
    // shared-default (home) may succeed if user has a real install
    if (result) {
      expect(result.source).toBe("home");
    } else {
      expect(result).toBeNull();
    }
  });
});

// ─── readAgentManifest ────────────────────────────────────────────────────────

describe("readAgentManifest", () => {
  it("parses fixture CSV and returns BmadPersona objects", () => {
    const agents = readAgentManifest(FIXTURE_BMAD);
    expect(agents.length).toBeGreaterThanOrEqual(2);
  });

  it("returns Mary and John from fixture", () => {
    const agents = readAgentManifest(FIXTURE_BMAD);
    const names = agents.map((a) => a.displayName);
    expect(names).toContain("Mary");
    expect(names).toContain("John");
  });

  it("populates all BmadPersona fields", () => {
    const agents = readAgentManifest(FIXTURE_BMAD);
    const mary = agents.find((a) => a.displayName === "Mary")!;
    expect(mary.name).toBe("bmad-agent-analyst");
    expect(mary.title).toBe("Business Analyst");
    expect(mary.icon).toBe("📊");
    expect(mary.module).toBe("bmm");
  });

  it("returns empty array when csv not found", () => {
    const result = readAgentManifest("/not/a/real/path");
    expect(result).toEqual([]);
  });
});

// ─── readModuleVersions ───────────────────────────────────────────────────────

describe("readModuleVersions", () => {
  it("parses fixture manifest.yaml versions", () => {
    const versions = readModuleVersions(FIXTURE_BMAD);
    expect(versions["bmm"]).toBe("6.3.0");
    expect(versions["tea"]).toBe("6.3.0");
    expect(versions["_bmad"]).toBe("6.3.0");
  });

  it("returns empty object when manifest.yaml missing", () => {
    const result = readModuleVersions("/not/real");
    expect(result).toEqual({});
  });
});
