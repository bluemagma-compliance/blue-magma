import { Button } from "@/components/ui/button";
import { SCFControl } from "../actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

function formatTable(
  allControls: SCFControl[],
  selectedControlIds: Set<string>,
  priorityControlIds: Set<string>
) {
  const headers = [
    "Object ID",
    "Title",
    "Weight",
    "Covers",
    "Control Description",
    "Notes",
    "Status",
  ];

  // Filter and sort selected controls
  const selectedControls = allControls
    .filter((c) => selectedControlIds.has(c.object_id))
    .sort((a, b) => {
      // First sort by domain
      const domainCompare = (a.domain || "").localeCompare(b.domain || "");
      if (domainCompare !== 0) return domainCompare;

      // Then by weight descending (highest first) within each domain
      const weightA = a.weight ?? 0;
      const weightB = b.weight ?? 0;
      return weightB - weightA;
    });

  // Group by domain
  const domainGroups = new Map<string, SCFControl[]>();
  for (const control of selectedControls) {
    const domain = control.domain || "Unknown";
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(control);
  }

  return { headers, domainGroups };
}

function downloadSelectedControlsCsv(
  allControls: SCFControl[],
  selectedControlIds: Set<string>,
  priorityControlIds: Set<string>
) {
  const { headers, domainGroups } = formatTable(
    allControls,
    selectedControlIds,
    priorityControlIds
  );

  // Add metadata header rows
  const now = new Date().toLocaleString();
  const allRows: string[][] = [
    ["SCF Selected Controls Export"],
    [`Generated: ${now}`],
    [`Total Controls: ${selectedControlIds.size}`],
    [], // Empty row for spacing
  ];

  // Add each domain section
  for (const [domain, controls] of domainGroups) {
    // Domain title row
    allRows.push([`DOMAIN: ${domain}`]);
    allRows.push([]); // Empty row

    // Column headers
    allRows.push(headers);

    // Control rows for this domain
    for (const c of controls) {
      const covers: string[] = [];
      if (c.covers_soc2) covers.push("SOC 2");
      if (c.covers_gdpr) covers.push("GDPR");
      if (c.covers_hipaa) covers.push("HIPAA");
      if (c.covers_iso27001) covers.push("ISO 27001");
      if (c.covers_iso42001) covers.push("ISO 42001");
      if (c.covers_nist_csf) covers.push("NIST CSF");
      if (c.covers_nist_ai_rmf) covers.push("NIST AI RMF");

      allRows.push([
        c.object_id,
        c.title,
        c.weight != null ? c.weight.toString() : "",
        covers.join(", "),
        c.control_description || "",
        "", // Notes - empty
        "", // Status - empty
      ]);
    }

    // Empty rows between domains
    allRows.push([]);
    allRows.push([]);
  }

  const csvContent =
    allRows
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\n") + "\n";

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scf_selected_controls.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadSelectedControlPdf(
  allControls: SCFControl[],
  selectedControlIds: Set<string>,
  priorityControlIds: Set<string>
) {
  const doc = new jsPDF({
    orientation: "landscape",
  });

  // Add title and metadata
  const now = new Date().toLocaleString();
  doc.setFontSize(16);
  doc.text("SCF Selected Controls Export", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated: ${now}`, 14, 22);
  doc.text(`Total Controls: ${selectedControlIds.size}`, 14, 28);

  // Add instructional text
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Start with controls that have a weight of 10, then move down", 14, 34);
  doc.setTextColor(0, 0, 0); // Reset to black

  const { headers, domainGroups } = formatTable(
    allControls,
    selectedControlIds,
    priorityControlIds
  );

  let currentY = 42;

  // Add each domain section
  for (const [domain, controls] of domainGroups) {
    // Add domain title
    doc.setFontSize(12);
    // Explicitly pass a font name to satisfy TypeScript types; "helvetica" is available by default.
    doc.setFont("helvetica", "bold");
    doc.text(`DOMAIN: ${domain}`, 14, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 7;

    // Build rows for this domain
    const domainRows = controls.map((c) => {
      const covers: string[] = [];
      if (c.covers_soc2) covers.push("SOC 2");
      if (c.covers_gdpr) covers.push("GDPR");
      if (c.covers_hipaa) covers.push("HIPAA");
      if (c.covers_iso27001) covers.push("ISO 27001");
      if (c.covers_iso42001) covers.push("ISO 42001");
      if (c.covers_nist_csf) covers.push("NIST CSF");
      if (c.covers_nist_ai_rmf) covers.push("NIST AI RMF");

      return [
        c.object_id,
        c.title,
        c.weight != null ? c.weight.toString() : "",
        covers.join(", "),
        c.control_description || "",
        "", // Notes - empty
        "", // Status - empty
      ];
    });

    // Add table for this domain
    autoTable(doc, {
      head: [headers],
      body: domainRows,
      startY: currentY,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [66, 139, 202], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 20 }, // Object ID
        1: { cellWidth: 40 }, // Title
        2: { cellWidth: 15 }, // Weight
        3: { cellWidth: 35 }, // Covers
        4: { cellWidth: 60 }, // Control Description
        5: { cellWidth: 60 }, // Notes (made bigger)
        6: { cellWidth: 25 }, // Status
      },
    });

    // Update Y position for next domain (get the final Y from the last table)
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Check if we need a new page
    if (currentY > 180) {
      doc.addPage();
      currentY = 20;
    }
  }

  doc.save("scf_selected_controls.pdf");
}

function downloadSelectedControls(
  format: "csv" | "pdf",
  allControls: SCFControl[],
  selectedControlIds: Set<string>,
  priorityControlIds: Set<string>
) {
  switch (format) {
    case "csv": {
      downloadSelectedControlsCsv(
        allControls,
        selectedControlIds,
        priorityControlIds
      );
      break;
    }
    case "pdf": {
      downloadSelectedControlPdf(
        allControls,
        selectedControlIds,
        priorityControlIds
      );
      break;
    }
  }
}

export const ExportButton = ({
  allControls,
  selectedControlIds,
  priorityControlIds,
}: {
  allControls: SCFControl[];
  selectedControlIds: Set<string>;
  priorityControlIds: Set<string>;
}) => {
  const handleExport = (format: "csv" | "pdf") => {
    downloadSelectedControls(
      format,
      allControls,
      selectedControlIds,
      priorityControlIds
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="default"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
        >
          <Download className="mr-2 h-5 w-5" />
          Download Selected Controls
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          Download as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
