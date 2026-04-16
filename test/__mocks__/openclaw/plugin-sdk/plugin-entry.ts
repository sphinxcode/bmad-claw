/**
 * Stub for openclaw/plugin-sdk/plugin-entry.
 * The real SDK is a peer dep not available in dev/test.
 */

export interface OpenClawPluginApi {
  registerTool: (name: string, descriptor: unknown, handler: unknown) => void;
  registerHook: (event: string, handler: unknown) => void;
  registerCli: (descriptor: unknown) => void;
}

export function definePluginEntry(entry: {
  id: string;
  name: string;
  description: string;
  register: (api: OpenClawPluginApi) => void;
}): typeof entry {
  return entry;
}
