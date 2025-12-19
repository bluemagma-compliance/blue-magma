import { DataFlowGraph } from "@/types/api";

export const mockGraph: DataFlowGraph = {
  services: [
    {
      object_id: "service-1",
      codebase: "auth-service",
      inferred: false,
      title: "Authentication Service",
      type: "backend",
    },
    {
      object_id: "service-2",
      codebase: "payment-service",
      inferred: true,
      title: "Payment Service",
      type: "backend",
    },
    {
      object_id: "service-3",
      codebase: "frontend",
      inferred: false,
      title: "Web App",
      type: "frontend",
    },
    {
      object_id: "service-4",
      codebase: "db",
      inferred: false,
      title: "Database",
      type: "database",
    },
  ],
  edges: [
    {
      from: "service-1",
      to: "service-2",
      title: "User Credentials, Payment Info",
      transport: "https",
    },
    {
      from: "service-3",
      to: "service-1",
      title: "Login Data",
      transport: "https",
    },
    {
      from: "service-3",
      to: "service-2",
      title: "Purchase Info",
      transport: "https",
    },
    {
      from: "service-2",
      to: "service-4",
      title: "Transaction Records",
      transport: "sql",
    },
    {
      from: "service-1",
      to: "service-4",
      title: "User Data",
      transport: "sql",
    },
  ],
};
