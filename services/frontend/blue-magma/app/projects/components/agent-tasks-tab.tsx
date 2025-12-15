"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Zap,
} from "lucide-react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes, getNodeType } from './flow-nodes';
import type { Project, AgentTask } from "../types";

interface AgentTasksTabProps {
  project: Project;
}

export function AgentTasksTab({ project }: AgentTasksTabProps) {
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(
    project.agentTasks.length > 0 ? project.agentTasks[0] : null
  );
  // Convert agent task nodes to React Flow nodes and edges
  const createFlowElements = useCallback((task: AgentTask | null) => {
    if (!task || !task.nodes) {
      return { nodes: [], edges: [] };
    }

    // Create nodes with custom types and positioning
    const nodes: Node[] = task.nodes.map((node) => {
      const nodeData = {
        label: node.name,
        status: node.status,
        type: node.type,
        optional: node.optional,
        condition: node.condition,
      };

      return {
        id: node.id,
        type: getNodeType(nodeData),
        data: nodeData,
        position: node.position || { x: 250, y: 0 }, // Use custom position or default
        draggable: false, // Prevent dragging to maintain layout
      };
    });

    // Create edges from task edges or generate simple sequential edges
    let edges: Edge[] = [];

    if (task.edges && task.edges.length > 0) {
      // Use custom edges if defined
      edges = task.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type === 'conditional' ? 'smoothstep' : 'default',
        label: edge.label,
        animated: task.nodes?.find(n => n.id === edge.target)?.status === 'running',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: edge.type === 'conditional' ? { strokeDasharray: '5,5' } : undefined,
        labelStyle: { fontSize: '12px', fontWeight: 500 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
      }));
    } else {
      // Generate simple sequential edges as fallback
      edges = task.nodes.slice(0, -1).map((node, index) => ({
        id: `${node.id}-${task.nodes![index + 1].id}`,
        source: node.id,
        target: task.nodes![index + 1].id,
        type: 'smoothstep',
        animated: task.nodes![index + 1].status === 'running',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }));
    }

    return { nodes, edges };
  }, []);

  const { nodes, edges } = createFlowElements(selectedTask);

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTriggerIcon = (trigger?: AgentTask['trigger']) => {
    switch (trigger) {
      case 'scheduled':
        return <Calendar className="h-3 w-3" />;
      case 'manual':
        return <Play className="h-3 w-3" />;
      case 'event':
        return <Zap className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (project.agentTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h4 className="font-medium mb-2">No agent tasks yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Create automated tasks for compliance scanning, analysis, and reporting.
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create First Agent Task
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Left Sidebar - Task List */}
      <div className="md:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Agent Tasks</h3>
          <Button size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {project.agentTasks.map((task) => (
            <Card
              key={task.id}
              className={`cursor-pointer transition-all ${
                selectedTask?.id === task.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedTask(task)}
            >
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(task.status)}
                      <h4 className="font-medium text-sm truncate">{task.title}</h4>
                    </div>
                    {getTriggerIcon(task.trigger)}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {task.lastRunAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Last run: {new Date(task.lastRunAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {task.status === 'running' && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Play className="h-3 w-3 animate-pulse" />
                        <span>Running now ({task.progress}%)</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Side - Workflow Diagram and Run History */}
      <div className="md:col-span-8 space-y-6">
        {selectedTask && (
          <>
            {/* Task Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(selectedTask.status)}
                      {selectedTask.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTask.description}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Play className="mr-2 h-3 w-3" />
                    Run Now
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Workflow Diagram */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workflow</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: '500px' }}>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-left"
                    connectionLineType={ConnectionLineType.SmoothStep}
                    defaultEdgeOptions={{
                      type: 'smoothstep',
                      markerEnd: { type: MarkerType.ArrowClosed },
                    }}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#f1f5f9" gap={20} />
                    <Controls />
                  </ReactFlow>
                </div>
              </CardContent>
            </Card>

            {/* Run History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run History</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedTask.runHistory && selectedTask.runHistory.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTask.runHistory.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {run.status === 'completed' && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                            {run.status === 'failed' && (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            {run.status === 'running' && (
                              <Play className="h-4 w-4 text-blue-600 animate-pulse" />
                            )}
                            <span className="text-sm font-medium">
                              {new Date(run.startedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {run.duration && (
                              <span>Duration: {Math.floor(run.duration / 60)}m {run.duration % 60}s</span>
                            )}
                            {run.findings && (
                              <div className="flex items-center gap-2">
                                {run.findings.critical > 0 && (
                                  <span className="text-red-600">{run.findings.critical} Critical</span>
                                )}
                                {run.findings.high > 0 && (
                                  <span className="text-orange-600">{run.findings.high} High</span>
                                )}
                                {run.findings.medium > 0 && (
                                  <span className="text-yellow-600">{run.findings.medium} Medium</span>
                                )}
                                {run.findings.low > 0 && (
                                  <span className="text-gray-600">{run.findings.low} Low</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No run history available
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

