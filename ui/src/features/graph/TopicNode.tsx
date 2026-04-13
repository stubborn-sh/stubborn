import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface TopicNodeData {
  label: string;
  dimmed: boolean;
}

function TopicNode({ data }: NodeProps) {
  const { label, dimmed } = data as unknown as TopicNodeData;

  return (
    <div
      className={`rounded-full border-2 border-dashed border-violet-500 bg-card px-4 py-3 shadow-sm transition-opacity ${
        dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-violet-500 !w-2 !h-2"
      />
      <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 text-center">
        {label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-violet-500 !w-2 !h-2"
      />
    </div>
  );
}

export default memo(TopicNode);
