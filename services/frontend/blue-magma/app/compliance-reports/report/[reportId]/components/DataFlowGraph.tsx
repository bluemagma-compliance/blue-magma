import { useMemo, useEffect } from "react";
import { ReactFlow, Node, Edge, Position, useReactFlow } from "@xyflow/react";
import cytoscape from "cytoscape";
import euler, { EulerLayoutOptions } from "cytoscape-euler";
import "@xyflow/react/dist/style.css";
import { DataFlowGraph } from "@/types/api";
import { ReactFlowProvider } from "@xyflow/react";

cytoscape.use(euler);

const NODE_WIDTH = 150;
const BORDER_RADIUS = 12;

function hierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[]; size: cytoscape.BoundingBox } {
  const cy = cytoscape({
    elements: [
      ...nodes.map((node, index) => ({
        group: "nodes" as cytoscape.ElementGroup,
        data: { id: node.id },
        position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 200 }, // Deterministic initial positions
      })),
      ...edges.map((edge) => ({
        group: "edges" as cytoscape.ElementGroup,
        data: { source: edge.source, target: edge.target },
      })),
    ],
  });

  const layout = cy.layout({
    name: "euler",
    springLength: (edge: cytoscape.EdgeSingular) => 80, // Length of the spring for edges
    mass: (node: cytoscape.NodeSingular) => 75, // Mass of the nodes
    gravity: -2.2, // Gravity force to pull nodes together
    pull: 0.001, // Pull force between nodes
    theta: 0.666, // Barnes-Hut approximation parameter
    dragCoeff: 0.02, // Drag coefficient for damping
    animate: false,
    randomize: false,
    fit: true,
  } as EulerLayoutOptions);
  layout.run();

  // Resize the graph to fit the actual extent of the nodes
  cy.fit();

  // Center and zoom the graph to fit the viewport
  cy.center();
  cy.zoom({
    level: 1,
    renderedPosition: { x: cy.extent().x1, y: cy.extent().y1 },
  });

  const minY = Math.min(...cy.nodes().map((n) => n.position("y")));
  const maxY = Math.max(...cy.nodes().map((n) => n.position("y")));
  const yThreshold = (minY + maxY) / 2;

  const finalNodes = nodes.map((node) => {
    const cyNode = cy.getElementById(node.id);
    const position = cyNode.position();
    const isBottomHalf = position.y > yThreshold;

    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - 25, // Assuming height of 50
      },
      sourcePosition: isBottomHalf ? Position.Top : Position.Bottom,
      targetPosition: isBottomHalf ? Position.Top : Position.Bottom,
    };
  });

  return { nodes: finalNodes, edges, size: cy.extent() };
}

function DataFlowGraphRenderer(props: { graph: DataFlowGraph }) {
  const reactFlowInstance = useReactFlow();

  const baseNodes = useMemo<Node[]>(
    () =>
      props.graph.services.map(
        (service) =>
          ({
            id: service.object_id,
            position: { x: 0, y: 0 }, // Will be overridden by layout
            data: {
              label: service.title,
            },
            style: {
              border: "2px solid #007acc",
              borderRadius: `${BORDER_RADIUS}px`,
              backgroundColor: "#e6f7ff",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            },
            sourcePosition: Position.Top,
            targetPosition: Position.Top,
            selectable: false,
            draggable: false,
            connectable: false,
            focusable: false,
          }) satisfies Node
      ),
    [props.graph.services]
  );

  const baseEdges = useMemo<Edge[]>(
    () =>
      props.graph.edges.map(
        (edge) =>
          ({
            id: `${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            label: edge.title.trim(),
            labelBgStyle: {
              fill: "#e6f7ff",
              fillOpacity: 0.85,
              stroke: "#007acc",
              strokeOpacity: 0.8,
              strokeWidth: 0.5,
              zIndex: 11,
            },
            labelBgBorderRadius: BORDER_RADIUS,
            labelBgPadding: [8, 8],
            labelShowBg: true,
            zIndex: 11,
            style: {
              stroke: "#007acc",
              strokeWidth: 2,
            },
          }) satisfies Edge
      ),
    [props.graph.edges]
  );

  const layout = useMemo(
    () => hierarchicalLayout(baseNodes, baseEdges),
    [baseNodes, baseEdges]
  );

  useEffect(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.1 }); // Dynamically fit the graph within the viewport
    }
  }, [reactFlowInstance, layout.nodes, layout.edges]);

  return (
    <div style={{ width: "100%", height: "50vh" }}>
      <ReactFlow nodes={layout.nodes} edges={layout.edges} fitView />
    </div>
  );
}

export const DataFlowGraphComponent = (props: { graph: DataFlowGraph }) => {
  return (
    <ReactFlowProvider>
      <DataFlowGraphRenderer graph={props.graph} />
    </ReactFlowProvider>
  );
};
