import { BaseAdapter } from "../shared/base-adapter";
import { CLAUDE_SELECTORS } from "./selectors";

export class ClaudeAdapter extends BaseAdapter {
  readonly platform = "claude" as const;
  protected readonly host = "claude.ai";
  protected readonly selectors = CLAUDE_SELECTORS;
}
