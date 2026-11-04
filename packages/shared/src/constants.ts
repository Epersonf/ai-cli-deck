export const API_PREFIX = '/api';
export const WS_PATH = '/ws/sessions';
export const MCP_PATH = '/mcp';
export const TOKEN_HEADER = 'x-deck-token';
export const TOKEN_QUERY = 'token';
export const TMUX_PREFIX = 'deck-';
export const DEFAULT_SERVER_PORT = 7842;
export const DEFAULT_PORT_RANGE = { min: 4100, max: 4199 } as const;
export const AGENT_PATH = '/agent';
export const BROWSER_VIEWPORT = { width: 1000, height: 720 } as const;
/** The deck terminal's own colours: the web theme uses them, and tmux answers a program asking for them. */
export const TERMINAL_COLORS = { background: '#120d08', foreground: '#ecdcb8' } as const;
