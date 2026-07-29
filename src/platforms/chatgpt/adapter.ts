import { BaseAdapter } from "../shared/base-adapter";
import { CHATGPT_SELECTORS } from "./selectors";

export class ChatGptAdapter extends BaseAdapter {
  readonly platform = "chatgpt" as const;
  protected readonly host = "chatgpt.com";
  protected readonly selectors = CHATGPT_SELECTORS;
}
