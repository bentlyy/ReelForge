import { Chip } from "@mui/material";
import type { PipelineStatus } from "@reel-engine/shared";
const color: Record<string, any> = { PENDING:"default", RUNNING:"info", WAITING_APPROVAL:"warning", APPROVED:"success", COMPLETED:"success", FAILED:"error", CANCELLED:"default" };
export function StatusChip({ status }: { status: PipelineStatus }) {
  return <Chip size="small" label={status} color={color[status] || "default"} variant={status==="PENDING"?"outlined":"filled"} />;
}
