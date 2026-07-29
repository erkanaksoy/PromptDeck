import { BaseAdapter } from "../shared/base-adapter";
import { GEMINI_SELECTORS } from "./selectors";

export class GeminiAdapter extends BaseAdapter {
  readonly platform = "gemini" as const;
  protected readonly host = "gemini.google.com";
  protected readonly selectors = GEMINI_SELECTORS;
}
