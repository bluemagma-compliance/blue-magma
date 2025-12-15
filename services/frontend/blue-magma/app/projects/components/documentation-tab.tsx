"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  FolderPlus,
  MoreVertical,
  Check,
  X,
  Code,
  Eye,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ReactMarkdown from 'react-markdown';
import type { Components } from "react-markdown";
import { toast } from "sonner";
		import { DocsTree } from "./_doc-tree";
		import { EvidencePanel } from "./evidence-panel";
		import type { Project, DocumentPage, FrameworkMapping, PageKind } from "../types";
		import type { AuditorDetail } from "../actions";
		// NOTE: API_BASE previously used here to call SCF /public/frameworks/scf/assessment-objectives.
		// That logic has been removed in favor of document-scoped auditors endpoint.

/**
 * Component to display framework information for control pages
 */
	function ControlFrameworkInfo({
	  // NOTE: We intentionally accept scf_id but no longer render it here to
	  // avoid duplicating SCF identifiers in the doc view. Users can still see
	  // control IDs on the main SCF page; this section focuses on frameworks.
	  scf_id: _scf_id,
	  frameworks,
	  framework_mappings
	}: {
	  scf_id?: string;
	  frameworks?: string[];
	  framework_mappings?: FrameworkMapping[];
	}) {
	  // If there are no frameworks or mappings, don't render anything.
	  if ((!frameworks || frameworks.length === 0) && (!framework_mappings || framework_mappings.length === 0)) {
	    return null;
	  }

  // Framework display names and colors (matching SCF page styling)
  const frameworkStyles: Record<string, { label: string; className: string }> = {
    soc2: {
      label: "SOC 2",
      className: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-800"
    },
    gdpr: {
      label: "GDPR",
      className: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800"
    },
    hipaa: {
      label: "HIPAA",
      className: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900 dark:text-sky-200 dark:border-sky-800"
    },
    iso27001: {
      label: "ISO 27001",
      className: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800"
    },
    iso42001: {
      label: "ISO 42001",
      className: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800"
    },
    nist_csf: {
      label: "NIST CSF",
      className: "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800"
    },
    nist_ai_rmf: {
      label: "NIST AI RMF",
      className: "bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900 dark:text-fuchsia-200 dark:border-fuchsia-800"
    },
  };

	  return (
	    <div className="mb-2 space-y-1 text-xs text-muted-foreground">
	      {frameworks && frameworks.length > 0 && (
	        <div className="space-y-1.5">
	          <span className="text-[11px] font-medium">Covers Frameworks:</span>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((fw) => {
              const normalized = fw.toLowerCase().replace(/\s+/g, '_');
              const style = frameworkStyles[normalized] || {
                label: fw,
                className: "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-800"
              };
              return (
                <Badge key={fw} className={style.className}>
                  {style.label}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

	      {framework_mappings && framework_mappings.length > 0 && (
	        <div className="space-y-1.5">
	          <span className="text-[11px] font-medium">Framework Mappings:</span>
	          <div className="space-y-1">
            {framework_mappings.map((mapping, idx) => (
	              <div key={idx} className="flex items-start gap-2 text-xs">
	                <span className="font-medium min-w-[80px] text-[11px]">
	                  {mapping.framework}:
	                </span>
                <div className="flex flex-wrap gap-1">
                  {mapping.external_ids.map((id) => (
                    <Badge key={id} variant="secondary" className="text-xs font-mono">
                      {id}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component to display relevance score for a document in the project context
 */
function RelevanceScoreDisplay({ score }: { score?: number }) {
  if (score === undefined || score === null) {
    return null;
  }

  // Determine category based on score
  let category: string;
  let label: string;
  let className: string;

  if (score >= 0 && score <= 14) {
    category = "not_immediately_relevant";
    label = "Not Immediately Relevant";
    className = "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  } else if (score >= 15 && score <= 49) {
    category = "low";
    label = "Low Relevance";
    className = "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700";
  } else if (score >= 50 && score <= 79) {
    category = "medium";
    label = "Medium Relevance";
    className = "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700";
  } else {
    // 80-100
    category = "high";
    label = "High Relevance";
    className = "bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700";
  }

	  return (
	    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
	      <span className="font-medium">Project Relevance:</span>
	      <div className="flex items-center gap-1">
	        <Badge className={`${className} px-1.5 py-0 text-[11px]`}>
	          {label}
	        </Badge>
	        <span className="font-mono text-[11px]">
	          {score}/100
	        </span>
	      </div>
	    </div>
	  );
}

		import { getDocumentationTemplate, saveDocumentationTemplate, type DocPage, getDocumentationTemplateFull, rpcGenerateDocs, getFullDocument, getDocumentAuditors } from "../actions";

interface DocumentationTabProps {
  project: Project;
  projectStatus?: string;
  documentation?: DocumentPage[];
  templateId?: string | null;
  isLoadingTemplate?: boolean;
  onRefreshDocumentation?: () => void;
  onUpdateDocumentation?: (docs: DocumentPage[]) => void;
  navigateToPageId?: string | null;
  openEvidenceRequestId?: string | null;
  // Notify parent whenever the effectively viewed document page (template or docs) changes
  onCurrentDocumentChange?: (doc: { id: string; title: string; is_control?: boolean } | null) => void;
}

const markdownComponents: Components = {
  code(props) {
    const { className, children } = props as { className?: string; children?: ReactNode };
    const inline = (props as { inline?: boolean }).inline;
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match && match[1] === "mermaid") {
      const raw = String(children || "").trim();
      return (
        <div
          className="rounded-md border border-muted-foreground/20 bg-muted p-3 text-sm text-muted-foreground"
        >
          <div className="font-medium mb-1">Diagram (mermaid)</div>
          <div>
            This diagram will be generated by AI. Describe the flows, nodes, and
            relationships below:
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{raw}</pre>
        </div>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};


type ProjectStatus = 'initializing' | 'active' | 'up-to-date' | 'out-of-date' | 'audit-ready' | 'completed' | 'on-hold';

export function DocumentationTab({
  project,
  projectStatus,
  documentation: externalDocumentation,
  templateId: externalTemplateId,
  isLoadingTemplate: externalIsLoadingTemplate,
  onRefreshDocumentation,
  onUpdateDocumentation,
  navigateToPageId,
  openEvidenceRequestId,
  onCurrentDocumentChange,
}: DocumentationTabProps) {
  // Use external state if provided, otherwise use internal state (for backward compatibility)
  const [internalDocumentation, setInternalDocumentation] = useState<DocumentPage[]>(project.documentation || []);
  const [internalTemplateId, setInternalTemplateId] = useState<string | null>(null);
  const [internalIsLoadingTemplate, setInternalIsLoadingTemplate] = useState<boolean>(false);

  const documentation = externalDocumentation !== undefined ? externalDocumentation : internalDocumentation;
  const templateId = externalTemplateId !== undefined ? externalTemplateId : internalTemplateId;
  const isLoadingTemplate = externalIsLoadingTemplate !== undefined ? externalIsLoadingTemplate : internalIsLoadingTemplate;

  const [selectedPage, setSelectedPage] = useState<DocumentPage | null>(
    (documentation && documentation.length > 0) ? documentation[0] : null
  );
  const [selectedEvidenceRequestId, setSelectedEvidenceRequestId] = useState<string | null>(null);
	  // Track related pages for the currently selected document page as returned
	  // from getFullDocument. We also mirror this onto the selectedPage object so
	  // the right-hand sidebar can render it alongside evidence and objectives.
	  const [relatedPages, setRelatedPages] = useState<import("../types").RelatedPageSummary[]>([]);

  // Handle navigation to a specific page and evidence request from tasks
  useEffect(() => {
    if (navigateToPageId && documentation && documentation.length > 0) {
      // Find the page by ID (could be nested, so we need to search recursively)
      const findPageById = (pages: DocumentPage[], id: string): DocumentPage | null => {
        for (const page of pages) {
          if (page.id === id) return page;
          if (page.children) {
            const found = findPageById(page.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const targetPage = findPageById(documentation, navigateToPageId);
      if (targetPage) {
        setSelectedPage(targetPage);
        if (openEvidenceRequestId) {
          setSelectedEvidenceRequestId(openEvidenceRequestId);
        }
      }
    }
  }, [navigateToPageId, openEvidenceRequestId, documentation]);

  // Update selected page when documentation changes
  useEffect(() => {
    if (!documentation || documentation.length === 0) {
      setSelectedPage(null);
      return;
    }

    setSelectedPage((prev) => {
      if (prev) {
        const updatedPage = documentation.find((page) => page.id === prev.id);
        if (updatedPage) {
          console.log("🔄 [DocumentationTab] Updating selected page content after refresh");
          return updatedPage;
        }
        console.log("ℹ️ [DocumentationTab] Selected page was deleted, selecting first page");
        return documentation[0];
      }
      // No page selected, select first page
      return documentation[0];
    });
  }, [documentation]);

		  // Load full document data (with evidence/requests) when a document is selected in non-on-hold mode.
		  // NOTE: This effect previously also derived SCF assessment objectives via
		  // `/public/frameworks/scf/assessment-objectives` using `template_page_id`.
		  // That logic has been retired in favor of document-scoped auditors
		  // (`/document/:document_id/auditor`) as the source of truth for
		  // assessment objectives in the Documentation sidebar.
		  useEffect(() => {
		    const selectedPageId = selectedPage?.id;
		    let cancelled = false;
		
		    if (projectStatus === "on-hold" || !selectedPageId) {
		      return;
		    }
		
		    const loadFullDocumentData = async () => {
		      setIsLoadingFullDocument(true);
		      try {
		        console.log("📄 [DocumentationTab] Fetching full document data for:", selectedPageId);
			        const fullDoc = await getFullDocument(project.id, selectedPageId);
		
		        if (fullDoc) {
			          console.log("📄 [DocumentationTab] Full document summary:", {
		            object_id: fullDoc.document?.object_id,
		            title: fullDoc.document?.title,
		            status: fullDoc.document?.status,
		            version: fullDoc.document?.version,
		            evidence_count: fullDoc.evidence?.length || 0,
		            evidence_requests_count: fullDoc.evidence_requests?.length || 0,
			            children_count: fullDoc.children?.length || 0,
			            related_pages_count: fullDoc.related_pages?.length || 0,
		            scf_id: fullDoc.document?.scf_id,
		            frameworks: fullDoc.document?.frameworks,
		            framework_mappings_count: Array.isArray(fullDoc.document?.framework_mappings)
		              ? fullDoc.document.framework_mappings.length
		              : 0,
		          });
		
			          // Update the selected page with evidence, requests, and related pages,
		          // but only if the selection has not changed while we were fetching.
		          setSelectedPage((prev) => {
		            if (!prev || prev.id !== selectedPageId) {
		              return prev;
		            }

		            return {
		              ...prev,
		              evidence: fullDoc.evidence || [],
		              evidenceRequests: fullDoc.evidence_requests || [],
			              relatedPages: fullDoc.related_pages || [],
		              // Extract SCF control metadata from the document object
		              scf_id: fullDoc.document?.scf_id as string | undefined,
		              frameworks: Array.isArray(fullDoc.document?.frameworks)
		                ? (fullDoc.document.frameworks as string[])
		                : undefined,
		              framework_mappings: Array.isArray(fullDoc.document?.framework_mappings)
		                ? (fullDoc.document.framework_mappings as Array<{ framework: string; external_ids: string[] }>)
		                : undefined,
		              // Also extract page_kind and is_control from the document
		              page_kind: fullDoc.document?.page_kind as PageKind | undefined,
		              is_control: fullDoc.document?.is_control as boolean | undefined,
		              // Extract relevance score
		              relevance_score: typeof fullDoc.document?.relevance_score === 'number'
		                ? fullDoc.document.relevance_score
		                : undefined,
		            };
		          });
			          setRelatedPages(fullDoc.related_pages || []);
		        } else {
		          console.warn("⚠️ [DocumentationTab] No data returned from getFullDocument");
		        }
		      } catch (err) {
		        console.error("❌ [DocumentationTab] Error loading full document:", {
		          projectId: project.id,
		          pageId: selectedPageId,
		        }, err);
		      } finally {
		        if (!cancelled) {
		          setIsLoadingFullDocument(false);
		        }
		      }
		    };
		
		    loadFullDocumentData();
		    return () => {
		      cancelled = true;
		    };
		  }, [selectedPage?.id, projectStatus, project.id]);

	  // Load document-scoped auditors (AI assessment objectives) for the selected page.
	  useEffect(() => {
	    const selectedPageId = selectedPage?.id;
	    let cancelled = false;

	    if (projectStatus === "on-hold" || !selectedPageId) {
	      if (!cancelled) {
	        setDocumentAuditors([]);
	        setDocumentAuditorsError(null);
	        setIsDocumentAuditorsLoading(false);
	      }
	      return;
	    }

	    const loadDocumentAuditors = async () => {
	      setIsDocumentAuditorsLoading(true);
	      setDocumentAuditorsError(null);

	      try {
	        const auditors = await getDocumentAuditors(project.id, selectedPageId);
	        if (!cancelled) {
	          setDocumentAuditors(auditors || []);
	        }
	      } catch (err) {
	        console.error("[DocumentationTab] Error loading document auditors", {
	          projectId: project.id,
	          pageId: selectedPageId,
	        }, err);
	        if (!cancelled) {
	          setDocumentAuditors([]);
	          setDocumentAuditorsError("Failed to load assessment objectives for this document.");
	        }
	      } finally {
	        if (!cancelled) {
	          setIsDocumentAuditorsLoading(false);
	        }
	      }
	    };

	    loadDocumentAuditors();
	    return () => {
	      cancelled = true;
	    };
	  }, [selectedPage?.id, projectStatus, project.id]);

	  // Only load internally if external state is not provided
  useEffect(() => {
    if (externalDocumentation !== undefined) {
      // External state is being used, skip internal loading
      return;
    }

    let mounted = true;
    async function load() {
      setInternalIsLoadingTemplate(true);
      const full = await getDocumentationTemplateFull(project.id);
      if (!mounted) return;
      if (full && Array.isArray(full.pages) && full.pages.length > 0) {
        const templ = full.pages as unknown as DocumentPage[];
        setInternalDocumentation(templ);
        setSelectedPage(templ[0]);
        setInternalTemplateId(full.object_id);
        // If project is on-hold, show template edit view; otherwise show docs
        setViewMode(projectStatus === 'on-hold' ? "template" : "docs");
      } else {
        setInternalDocumentation([]);
        setSelectedPage(null);
        setInternalTemplateId(null);
        setViewMode("template");
      }
      setInternalIsLoadingTemplate(false);
    }
    load();
    return () => { mounted = false; };
  }, [project.id, projectStatus, externalDocumentation]);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // Sidebar inline create/rename state
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [newRootTitle, setNewRootTitle] = useState("");
  const [addingChildForId, setAddingChildForId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Main content edit/preview state
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("preview");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

		  // Docs viewing state
		  const [viewMode, setViewMode] = useState<"docs" | "template">("template");
		  const [docs, setDocs] = useState<DocumentPage[]>([]);
		  const [selectedDocPage, setSelectedDocPage] = useState<DocumentPage | null>(null);
		  const [isLoadingFullDocument, setIsLoadingFullDocument] = useState(false);
		  // NOTE: Previously this component also derived SCF assessment objectives via
		  // `/public/frameworks/scf/assessment-objectives` using `template_page_id`.
		  // That SCF-specific state has been removed in favor of document-scoped
		  // auditors (/document/:document_id/auditor) as the source of truth for
		  // assessment objectives in the Documentation sidebar.
		  const [documentAuditors, setDocumentAuditors] = useState<AuditorDetail[]>([]);
		  const [isDocumentAuditorsLoading, setIsDocumentAuditorsLoading] = useState(false);
		  const [documentAuditorsError, setDocumentAuditorsError] = useState<string | null>(null);

	  // Let the parent (ProjectDetailPage) know which document page the user is
	  // currently looking at, so the AI chat can receive project_view_state
	  // frontend_event messages with { current_tab, current_document }.
	  useEffect(() => {
	    if (!onCurrentDocumentChange) {
	      return;
	    }

	    // Prefer the generated docs view when active; otherwise fall back to the
	    // template/structure view. If nothing is selected, send null to clear the
	    // chat's notion of the current document.
	    let currentDoc: { id: string; title: string; is_control?: boolean } | null = null;

	    if (viewMode === "docs" && projectStatus !== "on-hold" && selectedDocPage) {
	      const isControl =
	        typeof selectedDocPage.is_control === "boolean"
	          ? selectedDocPage.is_control
	          : selectedDocPage.page_kind === "control"
	            ? true
	            : undefined;

	      currentDoc = {
	        id: selectedDocPage.id,
	        title: selectedDocPage.title,
	        ...(typeof isControl === "boolean" ? { is_control: isControl } : {}),
	      };
	    } else if (selectedPage) {
	      const isControl =
	        typeof selectedPage.is_control === "boolean"
	          ? selectedPage.is_control
	          : selectedPage.page_kind === "control"
	            ? true
	            : undefined;

	      currentDoc = {
	        id: selectedPage.id,
	        title: selectedPage.title,
	        ...(typeof isControl === "boolean" ? { is_control: isControl } : {}),
	      };
	    }

	    onCurrentDocumentChange(currentDoc);
	  }, [onCurrentDocumentChange, viewMode, projectStatus, selectedDocPage, selectedPage]);

  // Delete confirmation state
  // Helpers: create root, add child, rename, update content
  const createRootPage = (title: string) => {
    const safeTitle = title.trim() || "Untitled Page";
    const isFirst = documentation.length === 0;
    const firstPageContent =
      "# " + safeTitle + "\n\n" +
      "This is a template. Use placeholders like {field} that our AI agents will fill.\n\n" +
      "## Overview\n" +
      "{Brief overview of this section}\n\n" +
      "## Key Requirements\n" +
      "- {Requirement 1}\n- {Requirement 2}\n- {Requirement 3}\n\n" +
      "## Architecture Diagram\n" +
      "```mermaid\n" +
      "flowchart TD\n" +
      "  A[Start] --> B{Decision}\n" +
      "  B -->|yes| C[Proceed]\n" +
      "  B -->|no| D[Stop]\n" +
      "```\n\n" +
      "## Data Table\n" +
      "| Column | Description | Example |\n" +
      "|--------|-------------|---------|\n" +
      "| {Name} | {What is it} | {Example} |\n\n" +
      "## Steps\n" +
      "1. {Step 1}\n" +
      "2. {Step 2}\n";

    const basicContent =
      "# " + safeTitle + "\n\n" +
      "## Overview\n" +
      "{Brief overview of this section}\n";

    const newPage: DocumentPage = {
      id: `page-${Date.now()}`,
      title: safeTitle,
      content: isFirst ? firstPageContent : basicContent,
      order: documentation.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
    };
    const next = [...documentation, newPage];
    if (externalDocumentation === undefined) {
      setInternalDocumentation(next);
    } else if (onUpdateDocumentation) {
      onUpdateDocumentation(next);
    }
    setSelectedPage(newPage);
    setCreatingRoot(false);
    setNewRootTitle("");
  };

  const addChildPage = (parentId: string, title: string) => {
    const safeTitle = title.trim() || "Untitled Page";
    const basicContent =
      "# " + safeTitle + "\n\n" +
      "## Overview\n" +
      "{Brief overview of this section}\n";

    const newPage: DocumentPage = {
      id: `page-${Date.now()}`,
      title: safeTitle,
      content: basicContent,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
    };
    const updatePageChildren = (pages: DocumentPage[]): DocumentPage[] => {
      return pages.map(p => {
        if (p.id === parentId) {
          const children = [...(p.children || []), newPage];
          return { ...p, children };
        }
        if (p.children) return { ...p, children: updatePageChildren(p.children) };
        return p;
      });
    };
    const updated = updatePageChildren(documentation);
    if (externalDocumentation === undefined) {
      setInternalDocumentation(updated);
    } else if (onUpdateDocumentation) {
      onUpdateDocumentation(updated);
    }
    setAddingChildForId(null);
    setNewChildTitle("");
    setSelectedPage(newPage);
    const newExpanded = new Set(expandedPages);
    newExpanded.add(parentId);
    setExpandedPages(newExpanded);
  };

  const renamePage = (pageId: string, title: string) => {
    const updateTitles = (pages: DocumentPage[]): DocumentPage[] => {
      return pages.map(p => {
        if (p.id === pageId) {
          const updated = { ...p, title: title.trim() || p.title, updatedAt: new Date().toISOString() };
          if (selectedPage?.id === pageId) setSelectedPage(updated);
          return updated;
        }
        if (p.children) return { ...p, children: updateTitles(p.children) };
        return p;
      });
    };
    const updated = updateTitles(documentation);
    if (externalDocumentation === undefined) {
      setInternalDocumentation(updated);
    } else if (onUpdateDocumentation) {
      onUpdateDocumentation(updated);
    }
    setRenamingPageId(null);
    setRenameTitle("");
  };

  const updatePageContent = (pageId: string, content: string) => {
    const updateContent = (pages: DocumentPage[]): DocumentPage[] => {
      return pages.map(p => {
        if (p.id === pageId) {
          const updated = { ...p, content, updatedAt: new Date().toISOString() };
          if (selectedPage?.id === pageId) setSelectedPage(updated);
          return updated;
        }
        if (p.children) return { ...p, children: updateContent(p.children) };
        return p;
      });
    };
    const updated = updateContent(documentation);
    // Use internal state setter if external state is not provided
    if (externalDocumentation === undefined) {
      setInternalDocumentation(updated);
    } else if (onUpdateDocumentation) {
      onUpdateDocumentation(updated);
    }
  };

  const [pageToDelete, setPageToDelete] = useState<DocumentPage | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const toggleExpanded = (pageId: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(pageId)) {
      newExpanded.delete(pageId);
    } else {
      newExpanded.add(pageId);
    }
    setExpandedPages(newExpanded);
  };

  const handleDeletePage = (page: DocumentPage) => {
    setPageToDelete(page);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!pageToDelete) return;

    const deletePage = (pages: DocumentPage[]): DocumentPage[] => {
      return pages
        .filter(page => page.id !== pageToDelete.id)
        .map(page => ({
          ...page,
          children: page.children ? deletePage(page.children) : undefined,
        }));
    };

    const updated = deletePage(documentation);
    if (externalDocumentation === undefined) {
      setInternalDocumentation(updated);
    } else if (onUpdateDocumentation) {
      onUpdateDocumentation(updated);
    }

    if (selectedPage?.id === pageToDelete.id) {
      setSelectedPage(documentation.length > 1 ? documentation[0] : null);
    }

    setPageToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  // Generate docs from template (RPC call only, show toast)
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const handleGenerateDocs = async () => {
    // Call backend RPC placeholder with org, templateId, projectId
    if (templateId) {
      setIsGenerating(true);
      const res = await rpcGenerateDocs(project.id, templateId);
      setIsGenerating(false);
      if (res.success) {
        setJobId(res.job_id || null);
        toast.success("Agents are building the docs! This may take a few minutes.", {
          duration: 5000,
        });
      } else {
        toast.error(res.error || "Failed to initiate docs generation");
      }
    }
  };

  const renderPageTree = (page: DocumentPage, level: number = 0) => {
    const hasChildren = page.children && page.children.length > 0;
    const isExpanded = expandedPages.has(page.id);
    const isSelected = selectedPage?.id === page.id;

    return (
      <div key={page.id}>
        <div
          className={`flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group ${
            isSelected ? 'bg-muted' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <div
            className="flex items-center flex-1 cursor-pointer"
            onClick={() => setSelectedPage(page)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(page.id);
                }}
                className="mr-1"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}
            <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
            {renamingPageId === page.id ? (
              <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                <Input
                  autoFocus
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renamePage(page.id, renameTitle);
                    if (e.key === 'Escape') { setRenamingPageId(null); setRenameTitle(''); }
                  }}
                />
                <Button size="icon" variant="ghost" onClick={() => renamePage(page.id, renameTitle)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setRenamingPageId(null); setRenameTitle(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span className="text-sm font-medium">{page.title}</span>
            )}
          </div>

          {/* Action Menu - Only show for on-hold projects */}
          {projectStatus === "on-hold" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setRenamingPageId(page.id); setRenameTitle(page.title); }}>
                  <Edit className="mr-2 h-3 w-3" />
                  Rename Page
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setAddingChildForId(page.id); setNewChildTitle(""); setExpandedPages(new Set(expandedPages).add(page.id)); }}>
                  <FolderPlus className="mr-2 h-3 w-3" />
                  Add Child Page
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeletePage(page)
                  }
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Delete Page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Inline child creation input */}
        {addingChildForId === page.id && (
          <div className="flex items-center gap-2 p-2" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
            <Input
              autoFocus
              placeholder="Child page name"
              value={newChildTitle}
              onChange={(e) => setNewChildTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addChildPage(page.id, newChildTitle);
                if (e.key === 'Escape') { setAddingChildForId(null); setNewChildTitle(''); }
              }}
            />
            <Button size="icon" variant="ghost" onClick={() => addChildPage(page.id, newChildTitle)}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setAddingChildForId(null); setNewChildTitle(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {hasChildren && isExpanded && (
          <div>
            {page.children!.map((child) => renderPageTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

	// NOTE: Previously, active projects short-circuited here to render the
	// DocumentationViewerMockup (SOC2 demo docs). That showed hard-coded
	// dummy documentation instead of real project data.
	//
	// To ensure active projects only ever display real backend documentation
	// (or honest empty states), the mock viewer has been disabled and we
	// always render the main documentation UI below for all statuses.
	    return (
	    <>
	      <div className="grid gap-6 md:grid-cols-12 h-[calc(100vh-200px)]">
	        {/* Sidebar - Document navigation */}
	        <div className="md:col-span-3 flex flex-col overflow-hidden">
	          <Card className="overflow-hidden flex flex-col h-full">
	            <CardHeader className="py-2.5 px-3 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
	              <div className="flex items-center justify-between">
	                <div>
	                  <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
	                    Document navigation
	                  </CardTitle>
	                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
	                    Browse your project documentation structure
	                  </p>
	                </div>
	                {viewMode === 'template' && projectStatus === 'on-hold' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreatingRoot(true)}
                    className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    <Plus className="h-4 w-4 text-blue-900 dark:text-blue-100" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-3 flex-1 overflow-y-auto">
              {documentation.length === 0 ? (
                viewMode === 'template' ? (
                  creatingRoot ? (
                    <div className="flex items-center gap-2 p-2">
                      <Input
                        autoFocus
                        placeholder="Template page name"
                        value={newRootTitle}
                        onChange={(e) => setNewRootTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') createRootPage(newRootTitle);
                          if (e.key === 'Escape') { setCreatingRoot(false); setNewRootTitle(''); }
                        }}
                      />
                      <Button size="icon" variant="ghost" onClick={() => createRootPage(newRootTitle)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setCreatingRoot(false); setNewRootTitle(''); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-2">
                      <Button className="w-full" onClick={() => setCreatingRoot(true)}>set documentation template</Button>
                    </div>
                  )
                ) : (
                  <div className="p-2 text-xs text-muted-foreground">No template yet. Switch to &quot;Edit Template&quot; to define one.</div>
                )
              ) : (
                <>
                  {viewMode === 'template' ? (
                    <>
                      {creatingRoot && (
                        <div className="flex items-center gap-2 p-2">
                          <Input
                            autoFocus
                            placeholder="Template page name"
                            value={newRootTitle}
                            onChange={(e) => setNewRootTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') createRootPage(newRootTitle);
                              if (e.key === 'Escape') { setCreatingRoot(false); setNewRootTitle(''); }
                            }}
                          />
                          <Button size="icon" variant="ghost" onClick={() => createRootPage(newRootTitle)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setCreatingRoot(false); setNewRootTitle(''); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {documentation.map((page) => renderPageTree(page))}
                    </>
                  ) : (
                    docs.length > 0 ? (
                      <DocsTree pages={docs} expanded={expandedPages} toggle={toggleExpanded} selectedId={selectedDocPage?.id || null} onSelect={(p) => setSelectedDocPage(p)} />
                    ) : (
                      <div className="opacity-60 pointer-events-none">
                        {documentation.map((page) => renderPageTree(page))}
                      </div>
                    )
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Docs or Template */}
        <div
          className={`flex flex-col h-full overflow-hidden ${
            projectStatus === 'on-hold' ? 'md:col-span-9' : 'md:col-span-5'
          }`}
        >
          {viewMode === 'docs' ? (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold">{selectedDocPage?.title || "Documentation"}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode('template')}
                    disabled={project.status === 'initializing'}
                  >
                    Edit Template
                  </Button>
	        </div>

	      </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {docs.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-900 dark:text-amber-100">
                    A template exists but documentation has not been generated yet. Use the button above to create docs according to the template.
                  </div>
                ) : (
                  selectedDocPage ? (
                    <>
                      {/* Show relevance score */}
                      <RelevanceScoreDisplay score={selectedDocPage.relevance_score} />

                      {/* Show framework info for control pages */}
                      {selectedDocPage.is_control && (
                        <ControlFrameworkInfo
                          scf_id={selectedDocPage.scf_id}
                          frameworks={selectedDocPage.frameworks}
                          framework_mappings={selectedDocPage.framework_mappings}
                        />
                      )}
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{selectedDocPage.content}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">Select a page from the left to view its content.</div>
                  )
                )}
              </div>

	            </div>
          ) : (
            selectedPage ? (
              <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedPage.title}</h3>
                    {selectedPage.status && (
                      <p className="text-xs text-muted-foreground mt-1">Status: {selectedPage.status}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {projectStatus === 'on-hold' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          disabled={isSaving}
                          onClick={async () => {
                            setIsSaving(true);
                            const res = await saveDocumentationTemplate(project.id, documentation as unknown as DocPage[]);
                            setIsSaving(false);
                            if (res.success) {
                              setSaveStatus("saved");
                              setTimeout(() => setSaveStatus("idle"), 1200);
                            }
                          }}
                        >
                          {isSaving ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving...
                            </span>
                          ) : (
                            "Save Template"
                          )}
                        </Button>
                        {saveStatus === "saved" && (
                          <span className="text-xs text-green-600">Saved</span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePage(selectedPage)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

	                {/* Tabs / content area - Different for on-hold vs active */}
	                {projectStatus === 'on-hold' ? (
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="flex flex-col flex-1 overflow-hidden">
                    <TabsList className="grid w-fit grid-cols-2 gap-1 bg-transparent p-0 border-b flex-shrink-0">
                      <TabsTrigger value="edit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2">
                        <Code className="h-4 w-4 mr-2" />
                        Edit
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit" className="flex-1 overflow-hidden mt-0 min-h-0">
                      <Textarea
                        value={selectedPage.content}
                        onChange={(e) => updatePageContent(selectedPage.id, e.target.value)}
                        className="font-mono text-sm h-full w-full resize-none border-0"
                      />
                    </TabsContent>
                    <TabsContent value="preview" className="flex-1 overflow-y-auto mt-0 min-h-0">
                      {/* Show relevance score */}
                      <RelevanceScoreDisplay score={selectedPage.relevance_score} />

                      {/* Show framework info for control pages in preview */}
                      {selectedPage.is_control && (
                        <ControlFrameworkInfo
                          scf_id={selectedPage.scf_id}
                          frameworks={selectedPage.frameworks}
                          framework_mappings={selectedPage.framework_mappings}
                        />
                      )}
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            code({ node, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || "");
                              if (match && match[1] === "mermaid") {
                                const raw = String(children || "").trim();
                                return (
                                  <div
                                    className="rounded-md border border-muted-foreground/20 bg-muted p-3 text-sm text-muted-foreground"
                                  >
                                    <div className="font-medium mb-1">Diagram (mermaid)</div>
                                    <div>
                                      This diagram will be generated by AI. Describe the flows, nodes, and
                                      relationships below:
                                    </div>
                                    <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{raw}</pre>
                                  </div>
                                );
                              }
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {selectedPage.content}
                        </ReactMarkdown>
                      </div>
                    </TabsContent>
	                  </Tabs>
	                ) : (
	                  // Active project - show content; evidence & requests are rendered in right-hand sidebar
	                  <div className="flex-1 overflow-y-auto mt-0 min-h-0">
	                    {/* Show relevance score */}
	                    <RelevanceScoreDisplay score={selectedPage.relevance_score} />

	                    {/* Show framework info for control pages */}
	                    {selectedPage.is_control && (
	                      <ControlFrameworkInfo
	                        scf_id={selectedPage.scf_id}
	                        frameworks={selectedPage.frameworks}
	                        framework_mappings={selectedPage.framework_mappings}
	                      />
	                    )}
	                    <div className="prose prose-sm max-w-none dark:prose-invert">
	                      <ReactMarkdown>{selectedPage.content}</ReactMarkdown>
	                    </div>
	                  </div>
	                )}
              </div>
            ) : (
              documentation.length > 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Select a template page from the sidebar to edit its structure
                    </p>
                  </CardContent>
                </Card>
              ) : null
	            )
	          )}
	        </div>

        {/* Right-hand sidebar: Evidence, evidence requests, and assessment objectives for active projects */}
        {projectStatus !== 'on-hold' && (
          <div className="md:col-span-4 flex flex-col h-full overflow-hidden">
	            <Card className="overflow-hidden flex flex-col h-full">
	              <CardHeader className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
	                <div>
	                  <CardTitle className="text-sm font-medium text-slate-900 dark:text-slate-50">
	                    Evidence &amp; Requests
	                  </CardTitle>
	                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
	                    Linked evidence, requests, and assessment objectives for this page
	                  </p>
	                </div>
	              </CardHeader>
			              <CardContent className="flex-1 overflow-y-auto pt-3">
        {isLoadingFullDocument ? (
			                  <div className="flex items-center justify-center py-8">
			                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			                  </div>
			                ) : selectedPage ? (
			                  <EvidencePanel
			                    evidence={selectedPage.evidence}
			                    evidenceRequests={selectedPage.evidenceRequests}
			                    selectedEvidenceRequestId={selectedEvidenceRequestId}
			                    documentAuditors={documentAuditors}
			                    isDocumentAuditorsLoading={isDocumentAuditorsLoading}
			                    documentAuditorsError={documentAuditorsError}
            relatedPages={selectedPage.relatedPages || relatedPages}
            pageId={selectedPage.id}
            onSelectRelatedPage={(pageId) => {
              // When a related page is selected from the sidebar, attempt to
              // find the corresponding node in the documentation tree and
              // navigate to it. If we cannot find it, we simply ignore the
              // request rather than throwing.
              const stack: DocumentPage[] = [...documentation];
              let found: DocumentPage | null = null;
              while (stack.length && !found) {
                const current = stack.pop()!;
                if (current.id === pageId) {
                  found = current;
                  break;
                }
                if (current.children && current.children.length) {
                  stack.push(...current.children);
                }
              }
              if (found) {
                setSelectedPage(found);
                setSelectedEvidenceRequestId(null);
              }
            }}
			                  />
			                ) : (
			                  <div className="text-xs text-muted-foreground">
			                    Select a page to view its evidence and requests.
			                  </div>
			                )}
			              </CardContent>
	            </Card>
	          </div>
	        )}
	      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.title}&quot;?
              {pageToDelete?.children && pageToDelete.children.length > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  This will also delete {pageToDelete.children.length} child page(s).
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

