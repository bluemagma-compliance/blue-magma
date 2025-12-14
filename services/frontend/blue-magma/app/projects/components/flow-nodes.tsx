import React from 'react';
import { Handle, Position } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  GitBranch,
  Zap,
  Brain,
  Settings,
  Flag,
  Shuffle,
} from 'lucide-react';

interface NodeData {
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  type: 'start' | 'analysis' | 'decision' | 'action' | 'end' | 'condition' | 'parallel';
  optional?: boolean;
  condition?: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return {
        bg: '#dcfce7',
        border: '#86efac',
        text: '#166534',
      };
    case 'running':
      return {
        bg: '#dbeafe',
        border: '#93c5fd',
        text: '#1e40af',
      };
    case 'failed':
      return {
        bg: '#fee2e2',
        border: '#fca5a5',
        text: '#dc2626',
      };
    case 'skipped':
      return {
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#64748b',
      };
    default: // pending
      return {
        bg: '#f9fafb',
        border: '#d1d5db',
        text: '#6b7280',
      };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'running':
      return <Play className="h-4 w-4 animate-pulse" />;
    case 'failed':
      return <XCircle className="h-4 w-4" />;
    case 'skipped':
      return <AlertTriangle className="h-4 w-4" />;
    default: // pending
      return <Clock className="h-4 w-4" />;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'start':
      return <Flag className="h-4 w-4" />;
    case 'analysis':
      return <Brain className="h-4 w-4" />;
    case 'decision':
    case 'condition':
      return <GitBranch className="h-4 w-4" />;
    case 'action':
      return <Zap className="h-4 w-4" />;
    case 'parallel':
      return <Shuffle className="h-4 w-4" />;
    case 'end':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

// Standard rectangular node
export function StandardNode({ data }: { data: NodeData }) {
  const colors = getStatusColor(data.status);
  
  return (
    <div
      className="px-4 py-3 shadow-md rounded-lg border-2 min-w-[150px] max-w-[200px]"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-center gap-2 mb-2">
        {getTypeIcon(data.type)}
        <span className="font-medium text-sm">{data.label}</span>
        {data.optional && (
          <Badge variant="outline" className="text-xs px-1 py-0">
            Optional
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        {getStatusIcon(data.status)}
        <span className="text-xs capitalize">{data.status}</span>
      </div>
      
      {data.condition && (
        <div className="text-xs mt-1 opacity-75">
          {data.condition}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Diamond-shaped decision node
export function DecisionNode({ data }: { data: NodeData }) {
  const colors = getStatusColor(data.status);
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div
        className="w-32 h-32 transform rotate-45 border-2 shadow-md flex items-center justify-center"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        <div className="transform -rotate-45 text-center">
          <div className="flex items-center justify-center mb-1" style={{ color: colors.text }}>
            {getTypeIcon(data.type)}
          </div>
          <div className="text-xs font-medium" style={{ color: colors.text }}>
            {data.label}
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            {getStatusIcon(data.status)}
          </div>
        </div>
      </div>
      
      {/* Multiple handles for branching */}
      <Handle type="source" position={Position.Right} className="w-3 h-3" />
      <Handle type="source" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Circular start/end node
export function CircularNode({ data }: { data: NodeData }) {
  const colors = getStatusColor(data.status);
  const isStart = data.type === 'start';
  
  return (
    <div className="relative">
      {!isStart && <Handle type="target" position={Position.Top} className="w-3 h-3" />}
      
      <div
        className="w-20 h-20 rounded-full border-2 shadow-md flex flex-col items-center justify-center"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          color: colors.text,
        }}
      >
        <div className="flex items-center justify-center mb-1">
          {getTypeIcon(data.type)}
        </div>
        <div className="text-xs font-medium text-center">
          {data.label}
        </div>
        <div className="flex items-center justify-center mt-1">
          {getStatusIcon(data.status)}
        </div>
      </div>
      
      {isStart && <Handle type="source" position={Position.Bottom} className="w-3 h-3" />}
    </div>
  );
}

// Parallel processing node (hexagon-like)
export function ParallelNode({ data }: { data: NodeData }) {
  const colors = getStatusColor(data.status);
  
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div
        className="px-6 py-4 shadow-md border-2 min-w-[160px]"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
          color: colors.text,
          clipPath: 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          {getTypeIcon(data.type)}
          <span className="font-medium text-sm">{data.label}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {getStatusIcon(data.status)}
          <span className="text-xs capitalize">{data.status}</span>
        </div>
      </div>
      
      {/* Multiple output handles for parallel execution */}
      <Handle type="source" position={Position.Bottom} id="main" className="w-3 h-3" />
      <Handle type="source" position={Position.Right} id="branch1" className="w-3 h-3" />
      <Handle type="source" position={Position.Left} id="branch2" className="w-3 h-3" />
    </div>
  );
}

// Node type mapping
export const nodeTypes = {
  standard: StandardNode,
  decision: DecisionNode,
  circular: CircularNode,
  parallel: ParallelNode,
};

// Helper function to determine node type based on data
export function getNodeType(nodeData: NodeData): string {
  switch (nodeData.type) {
    case 'start':
    case 'end':
      return 'circular';
    case 'decision':
    case 'condition':
      return 'decision';
    case 'parallel':
      return 'parallel';
    default:
      return 'standard';
  }
}
