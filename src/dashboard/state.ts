import { LABELS } from "../shared/constants";
import type { ConversationRecord, Filters } from "../shared/types";
import {
  displayStatus,
  EMPTY_FILTERS,
  filterConversations as filterShared,
  sortConversations
} from "../../packages/status-engine/src/index";

export { displayStatus, EMPTY_FILTERS, sortConversations };

export function filterConversations(
  records: ConversationRecord[],
  filters: Filters,
  previewsEnabled = false
): ConversationRecord[] {
  return filterShared(records, filters, LABELS, previewsEnabled);
}
