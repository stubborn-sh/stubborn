import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface AppNodeData {
  label: string;
  owner: string;
  healthy: boolean;
  dimmed: boolean;
}

function CustomNode({ data }: NodeProps) {
  const { label, owner, healthy, dimmed } = data as unknown as AppNodeData;
  const borderColor = healthy ? "border-emerald-500" : "border-red-500";

  return (
    <div
      className={`rounded-lg border-2 bg-card px-4 py-3 shadow-sm transition-opacity ${borderColor} ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{owner}</div>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

export default memo(CustomNode);
