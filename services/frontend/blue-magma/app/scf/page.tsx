"use client";

import type React from "react";
import { useEffect, useMemo, useState, useCallback, useRef, useTransition, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAllSCFControls,
  getAllSCFMappingsForFramework,
  getAllSCFRisks,
  getAllSCFThreats,
	  getAllSCFAssessmentObjectives,
	  getAllSCFEvidenceRequests,
  type SCFControl,
  type SCFMapping,
  type SCFRisk,
  type SCFThreat,
	  type SCFAssessmentObjective,
	  type SCFEvidenceRequest,
} from "./actions";
	import type { JsonValue } from "@/app/projects/types";
import { Loader2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
	  Dialog,
	  DialogContent,
	  DialogDescription,
	  DialogFooter,
	  DialogHeader,
	  DialogTitle,
} from "@/components/ui/dialog";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/context/AuthContext";
import { ProjectChatPanel } from "@/app/projects/components/project-chat-panel";
import type { UiAction } from "@/app/chat/services/websocket";
import { createProjectFromSCFConfig } from "@/app/projects/actions";
import { useSearchParams, useRouter } from "next/navigation";
import { ExportButton } from "./components/ExportButton";

// Memoized row component to prevent unnecessary re-renders
type SCFControlRowProps = {
  control: SCFControl;
  isSelected: boolean;
  isPriority: boolean;
  onToggleSelection: (id: string) => void;
  onTogglePriority: (id: string) => void;
};

const SCFControlRow = memo(
  ({ control, isSelected, isPriority, onToggleSelection, onTogglePriority }: SCFControlRowProps) => {
    return (
      <TableRow className={`${isPriority ? "bg-yellow-50/40 dark:bg-yellow-900/40" : ""} ${isSelected ? "bg-blue-50/30 dark:bg-blue-900/30" : ""}`}>
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(control.object_id)}
            aria-label={`Select ${control.object_id}`}
          />
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTogglePriority(control.object_id)}
            aria-label={isPriority ? "Unmark priority" : "Mark as priority"}
            title={isPriority ? "Unmark priority" : "Mark as priority"}
          >
            <Star className={isPriority ? "h-4 w-4 fill-yellow-400 text-yellow-500" : "h-4 w-4"} />
          </Button>
        </TableCell>
        <TableCell className="font-medium">{control.object_id}</TableCell>
        <TableCell className="max-w-[520px]">{control.title}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {control.covers_soc2 && (
              <Badge className="bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-800">
                SOC 2
              </Badge>
            )}
            {control.covers_gdpr && (
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800">
                GDPR
              </Badge>
            )}
            {control.covers_hipaa && (
              <Badge className="bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900 dark:text-sky-200 dark:border-sky-800">
                HIPAA
              </Badge>
            )}
            {control.covers_iso27001 && (
              <Badge className="bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800">
                ISO 27001
              </Badge>
            )}
            {control.covers_iso42001 && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800">
                ISO 42001
              </Badge>
            )}
            {control.covers_nist_csf && (
              <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-800">
                NIST CSF
              </Badge>
            )}
            {control.covers_nist_ai_rmf && (
              <Badge className="bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-900 dark:text-fuchsia-200 dark:border-fuchsia-800">
                NIST AI RMF
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {control.is_core_lvl0 ? (
            <Badge className="bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800">
              Core L0
            </Badge>
          ) : control.is_core_lvl1 ? (
            <Badge className="bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800">
              Core L1
            </Badge>
          ) : control.is_core_lvl2 ? (
            <Badge className="bg-stone-100 text-stone-700 border border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800">
              Core L2
            </Badge>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>{control.cadence || "-"}</TableCell>
        <TableCell>{control.weight ?? "-"}</TableCell>
      </TableRow>
    );
  },
  (prev, next) =>
    prev.control === next.control &&
    prev.isSelected === next.isSelected &&
    prev.isPriority === next.isPriority
);

SCFControlRow.displayName = "SCFControlRow";

	type TimelineGoalBase = {
	  id: string;
	  type: "CORE" | "FRAMEWORK";
	  key: string;
	  label: string;
	  baseControlIds: Set<string>;
	};

	type TimelineGoalComputed = {
	  id: string;
	  type: "CORE" | "FRAMEWORK";
	  key: string;
	  label: string;
	  // Gantt-style window for this goal in months
	  startMonth: number;
	  endMonth: number;
	  totalControls: number;
	  newControls: number;
	};

function buildTimelinePayload(
  timeline: { goals: TimelineGoalComputed[]; totalUniqueControls: number; maxMonths: number },
  timelineRowOrder: string[],
): Record<string, unknown> | undefined {
  if (timeline.goals.length === 0) {
    return undefined;
  }

  const windows = timeline.goals.map((goal) => {
    const token = goal.key || goal.id || goal.label;
    return {
      // "goal" is the primary identifier expected from the agent.
      goal: token,
      // Also include the concrete goal id so the backend can map
      // directly back to internal identifiers if needed.
      goal_id: goal.id,
      type: goal.type,
      label: goal.label,
      start_month: goal.startMonth,
      end_month: goal.endMonth,
    };
  });

  const byId = new Map(timeline.goals.map((g) => [g.id, g] as const));
  const orderTokens: string[] = [];
  const seenIds = new Set<string>();

  const pushFromId = (id: string) => {
    const goal = byId.get(id);
    if (!goal) return;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    const token = goal.key || goal.id || goal.label;
    orderTokens.push(token);
  };

  if (timelineRowOrder.length > 0) {
    for (const id of timelineRowOrder) {
      pushFromId(id);
    }
  }

  // Ensure all goals are represented in the order list, even if they
  // were not explicitly specified in timelineRowOrder.
  for (const goal of timeline.goals) {
    if (!seenIds.has(goal.id)) {
      pushFromId(goal.id);
    }
  }

  return {
    windows,
    order: orderTokens,
    max_months: timeline.maxMonths,
    total_unique_controls: timeline.totalUniqueControls,
  };
}

	export default function SCFPage() {
  // Render instrumentation removed to reduce console noise.
  const [allItems, setAllItems] = useState<SCFControl[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { organizationId } = useAuth();
  const searchParams = useSearchParams();
  const resumeSessionId = searchParams.get("resume_session_id") || undefined;
	  const router = useRouter();

	  // Mapping data for coverage calculation
	  const [mappings, setMappings] = useState<Record<string, SCFMapping[]>>({});
	  const mappingsLoadingRef = useRef(false);
	  const mappingsLoadedRef = useRef(false);

	  // Risk catalog data
	  const [allRisks, setAllRisks] = useState<SCFRisk[]>([]);
	  const [isRisksLoading, setIsRisksLoading] = useState(false);
	  const [riskError, setRiskError] = useState<string | null>(null);
	  const [isRiskDetailsOpen, setIsRiskDetailsOpen] = useState(false);
	  const [riskFilter, setRiskFilter] = useState<"all" | "covered" | "uncovered">("all");

	  // Threat catalog data
	  const [allThreats, setAllThreats] = useState<SCFThreat[]>([]);
	  const [isThreatsLoading, setIsThreatsLoading] = useState(false);
	  const [threatError, setThreatError] = useState<string | null>(null);
	  const [isThreatDetailsOpen, setIsThreatDetailsOpen] = useState(false);
	  const [threatFilter, setThreatFilter] = useState<"all" | "covered" | "uncovered">("all");
	  const [showBaselineOnly, setShowBaselineOnly] = useState(true);

	  // Assessment Objective catalog data
	  const [allAssessmentObjectives, setAllAssessmentObjectives] =
	    useState<SCFAssessmentObjective[]>([]);
	  const [isAssessmentObjectivesLoading, setIsAssessmentObjectivesLoading] = useState(false);
	  const [assessmentObjectivesError, setAssessmentObjectivesError] = useState<string | null>(
	    null,
	  );

	  // Evidence Request catalog data
	  const [allEvidenceRequests, setAllEvidenceRequests] = useState<SCFEvidenceRequest[]>([]);
	  const [isEvidenceRequestsLoading, setIsEvidenceRequestsLoading] = useState(false);
	  const [evidenceRequestsError, setEvidenceRequestsError] = useState<string | null>(null);

	  // Evidence / Assessment detail dialogs (row-click details)
	  const [selectedEvidence, setSelectedEvidence] = useState<SCFEvidenceRequest | null>(null);
	  const [isEvidenceDetailsOpen, setIsEvidenceDetailsOpen] = useState(false);
	  const [selectedAssessmentObjective, setSelectedAssessmentObjective] =
	    useState<SCFAssessmentObjective | null>(null);
	  const [isAssessmentDetailsOpen, setIsAssessmentDetailsOpen] = useState(false);
		
		  // Create-project-from-SCF-config dialog state
		  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
		  const [scfProjectName, setScfProjectName] = useState("");
		  const [scfProjectDescription, setScfProjectDescription] = useState("");
		  const [isCreatingProject, setIsCreatingProject] = useState(false);
		  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  // Simple filters supported by public API
  const [q, setQ] = useState("");

  // Weight filter
  const [weightMin, setWeightMin] = useState<string>("");

  // Coverage filters
  const [coversSoc2, setCoversSoc2] = useState(false);
  const [coversGdpr, setCoversGdpr] = useState(false);
  const [coversHipaa, setCoversHipaa] = useState(false);
  const [coversIso27001, setCoversIso27001] = useState(false);
  const [coversIso42001, setCoversIso42001] = useState(false);
  const [coversNistCsf, setCoversNistCsf] = useState(false);
  const [coversNistAiRmf, setCoversNistAiRmf] = useState(false);
  // Core filters
  const [isCoreLvl0, setIsCoreLvl0] = useState(false);

  const [isCoreLvl1, setIsCoreLvl1] = useState(false);
  const [isCoreLvl2, setIsCoreLvl2] = useState(false);
  const [isCoreAiOps, setIsCoreAiOps] = useState(false);

  // Priority state (local-only)
  const [priorities, setPriorities] = useState<Set<string>>(new Set());

  // Selection state
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const [pendingSelectAllFromChat, setPendingSelectAllFromChat] = useState(false);

	  // Timeline state: per-goal window (start/end in months). This replaces the
	  // older single-month horizon state so we can render a proper Gantt-style
	  // chart with draggable bars.
	  const [timelineWindowsByGoalId, setTimelineWindowsByGoalId] = useState<
	    Record<string, { start: number; end: number }>
	  >({});
	  const [timelineRowOrder, setTimelineRowOrder] = useState<string[]>([]);
	  const dragStateRef = useRef<
	    | {
	        goalId: string;
	        mode: "start" | "end" | "move";
	        trackLeft: number;
	        trackWidth: number;
	        axisMax: number;
	        initialStart: number;
	        initialEnd: number;
	        pointerMonthAtStart?: number;
	      }
	    | null
	  >(null);
	  const rowDragStateRef = useRef<
	    | {
	        draggingId: string;
	        startY: number;
	        startIndex: number;
	        currentIndex: number;
	        orderSnapshot: string[];
	      }
	    | null
	  >(null);
	
	  // Global mouse handlers to support click+drag resizing of timeline bars and
	  // vertical reordering of rows.
	  useEffect(() => {
	    const handleMouseMove = (event: MouseEvent) => {
	      const drag = dragStateRef.current;
	      if (drag && drag.trackWidth > 0) {
	        const {
	          goalId,
	          mode,
	          trackLeft,
	          trackWidth,
	          axisMax,
	          initialStart,
	          initialEnd,
	          pointerMonthAtStart,
	        } = drag;
	        const px = event.clientX;
	        const ratio = (px - trackLeft) / trackWidth;
	        const clampedRatio = Math.min(1, Math.max(0, ratio));
	        const month = Math.round(clampedRatio * axisMax);
	
	        if (mode === "start" || mode === "end") {
	          setTimelineWindowsByGoalId((prev) => {
	            const current =
	              prev[goalId] ?? ({
	                start: initialStart,
	                end: initialEnd,
	              } as {
	                start: number;
	                end: number;
	              });
	
	            if (mode === "start") {
	              let newStart = month;
	              if (newStart < 0) newStart = 0;
	              if (newStart >= current.end) newStart = current.end - 1;
	              if (newStart === current.start) return prev;
	              return { ...prev, [goalId]: { start: newStart, end: current.end } };
	            } else {
	              let newEnd = month;
	              if (newEnd <= current.start) newEnd = current.start + 1;
	              if (newEnd > axisMax) newEnd = axisMax;
	              if (newEnd === current.end) return prev;
	              return { ...prev, [goalId]: { start: current.start, end: newEnd } };
	            }
	          });
		        } else if (mode === "move") {
		          const effectivePointerStart =
		            typeof pointerMonthAtStart === "number" ? pointerMonthAtStart : month;
		          const width = initialEnd - initialStart;
		          const delta = month - effectivePointerStart;
	          let newStart = initialStart + delta;
	          let newEnd = initialEnd + delta;
	
	          if (newStart < 0) {
	            newStart = 0;
	            newEnd = width;
	          }
	          if (newEnd > axisMax) {
	            newEnd = axisMax;
	            newStart = axisMax - width;
	            if (newStart < 0) {
	              newStart = 0;
	            }
	          }
	
	          setTimelineWindowsByGoalId((prev) => {
	            const current =
	              prev[goalId] ?? {
	                start: initialStart,
	                end: initialEnd,
	              };
	            if (current.start === newStart && current.end === newEnd) return prev;
	            return { ...prev, [goalId]: { start: newStart, end: newEnd } };
	          });
	        }
	      }
	
	      const rowDrag = rowDragStateRef.current;
	      if (rowDrag) {
	        const { draggingId, startY, startIndex, currentIndex, orderSnapshot } = rowDrag;
	        if (orderSnapshot.length <= 1) return;
	        const approximateRowHeight = 32;
	        const deltaY = event.clientY - startY;
	        const offset = Math.round(deltaY / approximateRowHeight);
	        let targetIndex = startIndex + offset;
	        if (targetIndex < 0) targetIndex = 0;
	        if (targetIndex >= orderSnapshot.length) {
	          targetIndex = orderSnapshot.length - 1;
	        }
	        if (targetIndex !== currentIndex) {
	          const nextOrder = orderSnapshot.slice();
	          // Remove the dragging id from its original position and reinsert at the
	          // new index.
	          nextOrder.splice(startIndex, 1);
	          nextOrder.splice(targetIndex, 0, draggingId);
	          setTimelineRowOrder(nextOrder);
	          rowDragStateRef.current = {
	            ...rowDrag,
	            currentIndex: targetIndex,
	          };
	        }
	      }
	    };
	
	    const handleMouseUp = () => {
	      dragStateRef.current = null;
	      rowDragStateRef.current = null;
	    };
	
	    window.addEventListener("mousemove", handleMouseMove);
	    window.addEventListener("mouseup", handleMouseUp);
	    return () => {
	      window.removeEventListener("mousemove", handleMouseMove);
	      window.removeEventListener("mouseup", handleMouseUp);
	    };
	  }, []);

  // Selection / filter history (session-local)
  const [selectionHistory, setSelectionHistory] = useState<string[]>([]);


	  // Sender function for frontend_event messages to the AI agent (provided by ProjectChatPanel/ChatInterface)
	  const frontendEventSenderRef =
	    useRef<((eventName: string, payload: Record<string, unknown>) => void) | null>(null);

  // Lightweight UI state for filter feedback
  const [isFiltering, setIsFiltering] = useState(false);
  const filterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startFilteringTransition] = useTransition();


  const markFiltering = useCallback(() => {
    setIsFiltering(true);
    if (filterTimeoutRef.current !== null) {
      clearTimeout(filterTimeoutRef.current);
    }
    filterTimeoutRef.current = setTimeout(() => {
      setIsFiltering(false);
    }, 200);
  }, []);

  const appendHistory = useCallback((entry: string) => {
    setSelectionHistory((prev) => {
      const next = [...prev];
      next.push(entry);
      if (next.length > 10) {
        next.shift();
      }
      return next;
    });
  }, []);

  const applyScfFiltersFromAction = useCallback(
    (params?: Record<string, unknown>) => {
      if (!params) return;

	      // Track which filter groups were actually changed in this call so
	      // that small, focused updates (e.g. just min_weight) don't
	      // accidentally reset other filters via stale state.
	      let anyFilterChanged = false;
	      let coverageChanged = false;
	      let coreChanged = false;
	      let minWeightChanged = false;

	      // Start from current state so filters can be updated independently
	      let nextCoversSoc2 = coversSoc2;
	      let nextCoversGdpr = coversGdpr;
	      let nextCoversHipaa = coversHipaa;
	      let nextCoversIso27001 = coversIso27001;
	      let nextCoversIso42001 = coversIso42001;
	      let nextCoversNistCsf = coversNistCsf;
	      let nextCoversNistAiRmf = coversNistAiRmf;

	      let nextIsCoreLvl0 = isCoreLvl0;
	      let nextIsCoreLvl1 = isCoreLvl1;
	      let nextIsCoreLvl2 = isCoreLvl2;
	      let nextIsCoreAiOps = isCoreAiOps;

	      let nextWeightMin: string | null = null;

	      const historyEntries: string[] = [];

	      // Coverage frameworks (SOC2, GDPR, etc.)
	      const coverageFrameworks = (params as { coverage_frameworks?: unknown }).coverage_frameworks;
	      if (Array.isArray(coverageFrameworks)) {
	        const normalized = new Set(
	          coverageFrameworks
	            .filter((v): v is string => typeof v === "string")
	            .map((v) => v.trim().toLowerCase()),
	        );

	        if (normalized.size > 0) {
	          coverageChanged = true;
	          anyFilterChanged = true;

	          const has = (name: string) => normalized.has(name);

	          nextCoversSoc2 = has("soc2") || has("soc 2");
	          nextCoversGdpr = has("gdpr");
	          nextCoversHipaa = has("hipaa");
	          nextCoversIso27001 = has("iso27001") || has("iso 27001");
	          nextCoversIso42001 = has("iso42001") || has("iso 42001");
	          nextCoversNistCsf = has("nist csf") || has("nist_csf");
	          nextCoversNistAiRmf =
	            has("nist ai rmf") || has("nist_ai_rmf") || has("nist airmf");

	          historyEntries.push(
	            "chat set coverage filters: " +
	              Array.from(normalized)
	                .map((name) => name.toUpperCase())
	                .join(", "),
	          );
	        }
	      }

	      // Core level filters (L0/L1/L2/AI Ops)
	      const coreLevelsRaw =
	        (params as { core_levels?: unknown }).core_levels ??
	        (params as { core_filters?: unknown }).core_filters;

	      if (Array.isArray(coreLevelsRaw)) {
	        const normalizedCore = new Set(
	          coreLevelsRaw
	            .filter((v): v is string => typeof v === "string")
	            .map((v) => v.trim().toLowerCase()),
	        );

	        if (normalizedCore.size > 0) {
	          coreChanged = true;
	          anyFilterChanged = true;

	          const hasCore = (token: string) => normalizedCore.has(token);

	          // Core filters are additive: only levels explicitly mentioned are turned on.
	          if (hasCore("l0") || hasCore("core_l0") || hasCore("core lvl0")) {
	            nextIsCoreLvl0 = true;
	          }
	          if (hasCore("l1") || hasCore("core_l1") || hasCore("core lvl1")) {
	            nextIsCoreLvl1 = true;
	          }
	          if (hasCore("l2") || hasCore("core_l2") || hasCore("core lvl2")) {
	            nextIsCoreLvl2 = true;
	          }
	          if (
	            hasCore("ai_ops") ||
	            hasCore("core_ai_ops") ||
	            hasCore("core ai ops") ||
	            hasCore("ai ops")
	          ) {
	            nextIsCoreAiOps = true;
	          }

	          historyEntries.push(
	            "chat set core filters: " +
	              Array.from(normalizedCore)
	                .map((name) => name.toUpperCase())
	                .join(", "),
	          );
	        }
	      }

	      // Minimum weight filter
	      const rawMinWeight = (params as { min_weight?: unknown }).min_weight;
	      if (rawMinWeight !== undefined) {
	        let parsed: number | null = null;

	        if (typeof rawMinWeight === "number" && Number.isFinite(rawMinWeight)) {
	          parsed = rawMinWeight;
	        } else if (
	          typeof rawMinWeight === "string" &&
	          rawMinWeight.trim() !== "" &&
	          !Number.isNaN(Number(rawMinWeight))
	        ) {
	          parsed = Number(rawMinWeight);
	        }

	        if (parsed !== null) {
	          minWeightChanged = true;
	          anyFilterChanged = true;
	          nextWeightMin = String(parsed);
	          historyEntries.push("chat set min weight >= " + parsed);
	        }
	      }

	      if (!anyFilterChanged) return;

	      markFiltering();
	      startFilteringTransition(() => {
	        if (coverageChanged) {
	          setCoversSoc2(nextCoversSoc2);
	          setCoversGdpr(nextCoversGdpr);
	          setCoversHipaa(nextCoversHipaa);
	          setCoversIso27001(nextCoversIso27001);
	          setCoversIso42001(nextCoversIso42001);
	          setCoversNistCsf(nextCoversNistCsf);
	          setCoversNistAiRmf(nextCoversNistAiRmf);
	        }

	        if (coreChanged) {
	          setIsCoreLvl0(nextIsCoreLvl0);
	          setIsCoreLvl1(nextIsCoreLvl1);
	          setIsCoreLvl2(nextIsCoreLvl2);
	          setIsCoreAiOps(nextIsCoreAiOps);
	        }

	        if (minWeightChanged && nextWeightMin !== null) {
	          setWeightMin(nextWeightMin);
	        }
	      });

	      // For chat-driven filtering, automatically select all filtered controls
	      setPendingSelectAllFromChat(true);

	      for (const entry of historyEntries) {
	        appendHistory(entry);
	      }
    },
    [
      appendHistory,
      coversSoc2,
      coversGdpr,
      coversHipaa,
      coversIso27001,
      coversIso42001,
      coversNistCsf,
      coversNistAiRmf,
      isCoreLvl0,
      isCoreLvl1,
      isCoreLvl2,
      isCoreAiOps,
      markFiltering,
      setCoversSoc2,
      setCoversGdpr,
      setCoversHipaa,
      setCoversIso27001,
      setCoversIso42001,
      setCoversNistCsf,
      setCoversNistAiRmf,
      setIsCoreLvl0,
      setIsCoreLvl1,
      setIsCoreLvl2,
      setIsCoreAiOps,
      setPendingSelectAllFromChat,
      setWeightMin,
      startFilteringTransition,
    ],
  );

  const applyScfSelectionFromAction = useCallback(
    (params?: Record<string, unknown>) => {
      if (!params) return;

      const mode = (params as { mode?: unknown }).mode;
      if (mode === "all_filtered") {
        setPendingSelectAllFromChat(true);
        appendHistory("chat requested selecting all filtered controls");
        return;
      }

      if (mode === "ids") {
        const ids = (params as { ids?: unknown }).ids;
        if (!Array.isArray(ids)) return;

        const idList = ids.filter((v): v is string => typeof v === "string");
        if (idList.length === 0) return;

        appendHistory("chat selected " + idList.length + " specific controls");
        setSelectedControls((prev) => {
          const next = new Set(prev);
          idList.forEach((id) => next.add(id));
          return next;
        });
      }
    },
    [appendHistory, setPendingSelectAllFromChat, setSelectedControls],
  );

  // Debounced selection state for coverage calculation
  const [debouncedSelectedControls, setDebouncedSelectedControls] = useState<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (filterTimeoutRef.current !== null) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, []);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];

    const qv = q.trim();
    if (qv) labels.push('Search: "' + qv + '"');
    const wv = weightMin.trim();
    if (wv) labels.push("Min weight >= " + wv);

    if (coversSoc2) labels.push("SOC 2");
    if (coversGdpr) labels.push("GDPR");
    if (coversHipaa) labels.push("HIPAA");
    if (coversIso27001) labels.push("ISO 27001");
    if (coversIso42001) labels.push("ISO 42001");
    if (coversNistCsf) labels.push("NIST CSF");
    if (coversNistAiRmf) labels.push("NIST AI RMF");

    if (isCoreLvl0) labels.push("Core L0");
    if (isCoreLvl1) labels.push("Core L1");
    if (isCoreLvl2) labels.push("Core L2");
    if (isCoreAiOps) labels.push("Core AI Ops");

    return labels;
  }, [
    q,
    weightMin,
    coversSoc2,
    coversGdpr,
    coversHipaa,
    coversIso27001,
    coversIso42001,
    coversNistCsf,
    coversNistAiRmf,
    isCoreLvl0,


    isCoreLvl1,
    isCoreLvl2,
    isCoreAiOps,
  ]);

	  // NOTE: The effect that sends SCF filter history to the AI chat used to
	  // live here. It was moved down next to the timeline helpers so the same
	  // frontend_event payload can also include implementation timeline data.
  const filteredItems = useMemo(() => {
    const qv = q.trim().toLowerCase();
    const wMinStr = weightMin.trim();
    const wMin = wMinStr !== "" && !Number.isNaN(Number(wMinStr)) ? Number(wMinStr) : undefined;

    const result = allItems.filter((c) => {
      if (qv) {
        const hay = `${c.object_id || ""} ${c.title || ""} ${c.domain || ""} ${c.risk_threat_summary || ""} ${c.control_threat_summary || ""}`.toLowerCase();
        if (!hay.includes(qv)) return false;
      }
      if (wMin !== undefined && (c.weight == null || c.weight < wMin)) return false;

      // Additive filtering across groups: if any coverage or any core filters are selected,
      // match controls that satisfy coverage OR core (OR within each group as well).
      const anyCoverageSelected = (
        coversSoc2 || coversGdpr || coversHipaa || coversIso27001 || coversIso42001 || coversNistCsf || coversNistAiRmf
      );
      const coverageMatch = anyCoverageSelected && (
        (coversSoc2 && !!c.covers_soc2) ||
        (coversGdpr && !!c.covers_gdpr) ||
        (coversHipaa && !!c.covers_hipaa) ||
        (coversIso27001 && !!c.covers_iso27001) ||
        (coversIso42001 && !!c.covers_iso42001) ||
        (coversNistCsf && !!c.covers_nist_csf) ||
        (coversNistAiRmf && !!c.covers_nist_ai_rmf)
      );

      const anyCoreSelected = (isCoreLvl0 || isCoreLvl1 || isCoreLvl2 || isCoreAiOps);
      const coreMatch = anyCoreSelected && (
        (isCoreLvl0 && !!c.is_core_lvl0) ||
        (isCoreLvl1 && !!c.is_core_lvl1) ||
        (isCoreLvl2 && !!c.is_core_lvl2) ||
        (isCoreAiOps && !!c.is_core_ai_ops)
      );

      if ((anyCoverageSelected || anyCoreSelected) && !(coverageMatch || coreMatch)) return false;
      return true;
    });

    return result;
  }, [allItems, q, weightMin, coversSoc2, coversGdpr, coversHipaa, coversIso27001, coversIso42001, coversNistCsf, coversNistAiRmf, isCoreLvl0, isCoreLvl1, isCoreLvl2, isCoreAiOps]);

  const groups = useMemo(() => {
    const map = new Map<string, SCFControl[]>();
    for (const c of filteredItems) {
      const key = (c.domain || "Unknown").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const result = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return result;
  }, [filteredItems]);

  // Debounce selection changes for coverage calculation (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSelectedControls(selectedControls);
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedControls]);

  // Pre-calculate mapping Sets once (Option 1: Memoization)
  const frameworkMappingSets = useMemo(() => {
    const frameworks = [
      { key: "SOC2", name: "SOC 2" },
      { key: "GDPR", name: "GDPR" },
      { key: "HIPAA", name: "HIPAA" },
      { key: "ISO27001", name: "ISO 27001" },
      { key: "ISO42001", name: "ISO 42001" },
      { key: "NIST CSF", name: "NIST CSF" },
      { key: "NIST AI RMF", name: "NIST AI RMF" },
    ];

    const result = frameworks.map(({ key, name }) => {
      const frameworkMappings = mappings[key] || [];
      const mappedSCFControls = new Set(frameworkMappings.map(m => m.scf_object_id));
      return { key, name, mappedSCFControls };
    });

    return result;
  }, [mappings]);

  // Calculate coverage for each framework based on DEBOUNCED selected controls (Option 2: Debouncing)
  const coverageStats = useMemo(() => {
    const stats: Record<string, { mapped: number; selected: number; coverage: number }> = {};

    frameworkMappingSets.forEach(({ name, mappedSCFControls }) => {
      // Count how many of the SELECTED controls have mappings
      let selectedWithMappingsCount = 0;
      for (const id of debouncedSelectedControls) {
        if (mappedSCFControls.has(id)) {
          selectedWithMappingsCount++;
        }
      }

      const coverage = selectedWithMappingsCount / (mappedSCFControls.size || 1);

      stats[name] = {
        mapped: mappedSCFControls.size,
        selected: selectedWithMappingsCount,
        coverage: coverage,
      };
    });

    return stats;
  }, [debouncedSelectedControls, frameworkMappingSets]);

  // Build indexes between controls and risks from the full control list.
  const riskIndex = useMemo(() => {
	    const controlToRisks = new Map<string, string[]>();
	    const riskToControls = new Map<string, Set<string>>();

	    for (const control of allItems) {
	      // NOTE: backend is expected to expose risk IDs on the SCF record.
	      // We look for either the SCF "Risk Threat Summary" array or fall back to
      // `data.risks` / `data.risk_ids`, all containing SCF risk object_ids (e.g., "R-AC-1").
	      const rawRisks =
	        (control.risk_threat_summary
          ? control.risk_threat_summary
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : (control.data &&
              (control.data["Risk Threat Summary"] ||
                control.data.risks ||
                control.data.risk_ids))) || [];
	      if (!Array.isArray(rawRisks)) continue;

	      const riskIds = rawRisks.filter(
	        (r: unknown): r is string => typeof r === "string" && r.length > 0,
	      );
	      if (riskIds.length === 0) continue;

	      controlToRisks.set(control.object_id, riskIds);

	      for (const riskId of riskIds) {
	        if (!riskToControls.has(riskId)) {
	          riskToControls.set(riskId, new Set<string>());
	        }
	        riskToControls.get(riskId)!.add(control.object_id);
	      }
	    }


	    return { controlToRisks, riskToControls };
	  }, [allItems]);

		  const controlsById = useMemo(() => {
		    const map = new Map<string, SCFControl>();
		    for (const control of allItems) {
		      map.set(control.object_id, control);
		    }
		    return map;
		  }, [allItems]);

			  // Implementation timeline: derive base goals (per selected core level / framework)
			  // from the currently selected SCF controls. Rows are **only** created for
			  // coverage/core filters that are currently active.
			  const timelineBaseGoals = useMemo<TimelineGoalBase[]>(() => {
			    const goals: TimelineGoalBase[] = [];
			    if (debouncedSelectedControls.size === 0) return goals;
			
			    const selectedIds = Array.from(debouncedSelectedControls);
			
			    const pushGoalFromPredicate = (
			      id: string,
			      type: "CORE" | "FRAMEWORK",
			      key: string,
			      label: string,
			      predicate: (control: SCFControl) => boolean,
			    ) => {
			      const ids: string[] = [];
			      for (const controlId of selectedIds) {
			        const control = controlsById.get(controlId);
			        if (!control) continue;
			        if (predicate(control)) {
			          ids.push(controlId);
			        }
			      }
			      if (ids.length > 0) {
			        goals.push({
			          id,
			          type,
			          key,
			          label,
			          baseControlIds: new Set(ids),
			        });
			      }
			    };
			
			    // Core-level goals – only if the corresponding core filter is active.
			    if (isCoreLvl0) {
			      pushGoalFromPredicate(
			        "CORE_L0",
			        "CORE",
			        "L0",
			        "Core L0",
			        (c) => !!c.is_core_lvl0,
			      );
			    }
			    if (isCoreLvl1) {
			      pushGoalFromPredicate(
			        "CORE_L1",
			        "CORE",
			        "L1",
			        "Core L1",
			        (c) => !!c.is_core_lvl1,
			      );
			    }
			    if (isCoreLvl2) {
			      pushGoalFromPredicate(
			        "CORE_L2",
			        "CORE",
			        "L2",
			        "Core L2",
			        (c) => !!c.is_core_lvl2,
			      );
			    }
			    if (isCoreAiOps) {
			      pushGoalFromPredicate(
			        "CORE_AI_OPS",
			        "CORE",
			        "AI_OPS",
			        "Core AI Ops",
			        (c) => !!c.is_core_ai_ops,
			      );
			    }
			
			    // Framework goals – only for coverage filters that are currently active.
			    if (coversSoc2) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_SOC2",
			        "FRAMEWORK",
			        "SOC2",
			        "SOC 2",
			        (c) => !!c.covers_soc2,
			      );
			    }
			    if (coversGdpr) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_GDPR",
			        "FRAMEWORK",
			        "GDPR",
			        "GDPR",
			        (c) => !!c.covers_gdpr,
			      );
			    }
			    if (coversHipaa) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_HIPAA",
			        "FRAMEWORK",
			        "HIPAA",
			        "HIPAA",
			        (c) => !!c.covers_hipaa,
			      );
			    }
			    if (coversIso27001) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_ISO27001",
			        "FRAMEWORK",
			        "ISO27001",
			        "ISO 27001",
			        (c) => !!c.covers_iso27001,
			      );
			    }
			    if (coversIso42001) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_ISO42001",
			        "FRAMEWORK",
			        "ISO42001",
			        "ISO 42001",
			        (c) => !!c.covers_iso42001,
			      );
			    }
			    if (coversNistCsf) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_NIST_CSF",
			        "FRAMEWORK",
			        "NIST_CSF",
			        "NIST CSF",
			        (c) => !!c.covers_nist_csf,
			      );
			    }
			    if (coversNistAiRmf) {
			      pushGoalFromPredicate(
			        "FRAMEWORK_NIST_AI_RMF",
			        "FRAMEWORK",
			        "NIST_AI_RMF",
			        "NIST AI RMF",
			        (c) => !!c.covers_nist_ai_rmf,
			      );
			    }
			
			    return goals;
			  }, [
			    controlsById,
			    debouncedSelectedControls,
			    coversSoc2,
			    coversGdpr,
			    coversHipaa,
			    coversIso27001,
			    coversIso42001,
			    coversNistCsf,
			    coversNistAiRmf,
			    isCoreLvl0,
			    isCoreLvl1,
			    isCoreLvl2,
			    isCoreAiOps,
			  ]);

			  // Ensure each base goal has an initial window when it appears. New goals are
			  // placed sequentially in 4-month blocks (0–4, 4–8, 8–12, ...) so the default
			  // view uses a 12 month scale but items start with a 4 month width.
			  useEffect(() => {
			    if (timelineBaseGoals.length === 0) return;
				    setTimelineWindowsByGoalId((prev) => {
				      const next = { ...prev };
			      // Find the furthest end among existing windows for currently active goals
			      let maxExistingEnd = 0;
			      for (const goal of timelineBaseGoals) {
			        const win = prev[goal.id];
			        if (win && typeof win.end === "number" && win.end > maxExistingEnd) {
			          maxExistingEnd = win.end;
			        }
			      }
			      let offset = maxExistingEnd;
			      let changed = false;
			      for (const goal of timelineBaseGoals) {
			        if (!prev[goal.id]) {
			          const start = offset;
			          const end = start + 4; // default 4-month width
			          offset = end;
			          next[goal.id] = { start, end };
			          changed = true;
			        }
			      }
			      return changed ? next : prev;
			    });
			  }, [timelineBaseGoals]);

			  // Combine base goals with their windows and compute incremental
			  // (deduplicated) control counts per milestone. We treat the endMonth
			  // as the "target" for ordering milestones.
				  const timeline = useMemo(() => {
				    if (timelineBaseGoals.length === 0) {
				      return {
				        goals: [] as TimelineGoalComputed[],
				        totalUniqueControls: 0,
				        maxMonths: 12,
				      };
				    }
				
				    const withWindow = timelineBaseGoals.map((goal) => {
				      const win = timelineWindowsByGoalId[goal.id];
				      let start = 0;
				      let end = 4;
				      if (win) {
				        const rawStart = Number.isFinite(win.start) ? win.start : 0;
				        const rawEnd = Number.isFinite(win.end) ? win.end : rawStart + 1;
				        start = Math.max(0, Math.round(rawStart));
				        end = Math.max(start + 1, Math.round(rawEnd));
				      }
				      return { ...goal, startMonth: start, endMonth: end };
				    });
				
				    // Sort by target (end month), then label for stability
				    withWindow.sort((a, b) => {
				      if (a.endMonth !== b.endMonth) {
				        return a.endMonth - b.endMonth;
				      }
				      return a.label.localeCompare(b.label);
				    });
				
				    const cumulative = new Set<string>();
				    const computed: TimelineGoalComputed[] = [];
				
				    for (const goal of withWindow) {
				      let newCount = 0;
				      for (const id of goal.baseControlIds) {
				        if (!cumulative.has(id)) {
				          newCount++;
				        }
				      }
				      for (const id of goal.baseControlIds) {
				        cumulative.add(id);
				      }
				      computed.push({
				        id: goal.id,
				        type: goal.type,
				        key: goal.key,
				        label: goal.label,
				        startMonth: goal.startMonth,
				        endMonth: goal.endMonth,
				        totalControls: goal.baseControlIds.size,
				        newControls: newCount,
				      });
				    }
				
				    const totalUniqueControls = cumulative.size;
				    const maxEnd = computed.reduce(
				      (max, goal) => (goal.endMonth > max ? goal.endMonth : max),
				      0,
				    );
				    const maxMonths = Math.max(12, maxEnd || 0);
				
				    return { goals: computed, totalUniqueControls, maxMonths };
				  }, [timelineBaseGoals, timelineWindowsByGoalId]);

				  // Maintain a stable, user-adjustable display order for timeline rows.
				  useEffect(() => {
				    if (timeline.goals.length === 0) {
				      setTimelineRowOrder([]);
				      return;
				    }
				    setTimelineRowOrder((prev) => {
				      const existing = prev.filter((id) =>
				        timeline.goals.some((goal) => goal.id === id),
				      );
				      const missing = timeline.goals
				        .map((goal) => goal.id)
				        .filter((id) => !existing.includes(id));
				      return [...existing, ...missing];
				    });
				  }, [timeline.goals]);

					  // Helper for mapping chat-specified timeline identifiers (e.g. "SOC2",
					  // "iso27001", "core_l0") to concrete timeline goal ids. We accept the
					  // same identifiers that filters use so the agent can reuse the same
					  // vocabulary for "select SOC2" and "set timeline for SOC2".
					  //
					  // IMPORTANT: This resolver must work even when timelineBaseGoals has not
					  // yet caught up to newly selected controls/filters within the same
					  // websocket update. To support that, we first consult the dynamic goals
					  // and then fall back to a static mapping of known framework/core tokens
					  // to their canonical goal ids.
					  const resolveTimelineGoalId = useCallback(
					    (identifier: unknown): string | null => {
					      if (typeof identifier !== "string") return null;
					      const token = identifier.trim().toLowerCase();
					      if (!token) return null;
					
					      // 1) Dynamic lookup based on currently active goals.
					      const lookup = new Map<string, string>();
					      for (const goal of timelineBaseGoals) {
					        // Key (e.g. "SOC2", "ISO27001", "L0")
					        if (goal.key) {
					          lookup.set(goal.key.toLowerCase(), goal.id);
					        }
					        // Id (e.g. "FRAMEWORK_SOC2", "CORE_L0")
					        lookup.set(goal.id.toLowerCase(), goal.id);
					        // Human label (e.g. "SOC 2", "ISO 27001", "Core L0")
					        lookup.set(goal.label.toLowerCase(), goal.id);
					      }
					
					      const dynamic = lookup.get(token);
					      if (dynamic) return dynamic;
					
					      // 2) Static mapping for known framework/core identifiers so that
					      // timeline window updates can be applied even before the goals are
					      // visible in timelineBaseGoals. These ids must match the ones used
					      // when constructing timelineBaseGoals above.
					      switch (token) {
					        // Core levels
					        case "l0":
					        case "core_l0":
					        case "core l0":
					        case "core lvl0":
					          return "CORE_L0";
					        case "l1":
					        case "core_l1":
					        case "core l1":
					        case "core lvl1":
					          return "CORE_L1";
					        case "l2":
					        case "core_l2":
					        case "core l2":
					        case "core lvl2":
					          return "CORE_L2";
					        case "ai_ops":
					        case "core_ai_ops":
					        case "core ai ops":
					        case "ai ops":
					          return "CORE_AI_OPS";
					
					        // Frameworks
					        case "soc2":
					        case "soc 2":
					        case "framework_soc2":
					          return "FRAMEWORK_SOC2";
					        case "gdpr":
					        case "framework_gdpr":
					          return "FRAMEWORK_GDPR";
					        case "hipaa":
					        case "framework_hipaa":
					          return "FRAMEWORK_HIPAA";
					        case "iso27001":
					        case "iso 27001":
					        case "framework_iso27001":
					          return "FRAMEWORK_ISO27001";
					        case "iso42001":
					        case "iso 42001":
					        case "framework_iso42001":
					          return "FRAMEWORK_ISO42001";
					        case "nist csf":
					        case "nist_csf":
					        case "framework_nist_csf":
					          return "FRAMEWORK_NIST_CSF";
					        case "nist ai rmf":
					        case "nist_ai_rmf":
					        case "nist airmf":
					        case "framework_nist_ai_rmf":
					          return "FRAMEWORK_NIST_AI_RMF";
					        default:
					          return null;
					      }
					    },
					    [timelineBaseGoals],
					  );

					  // Apply timeline window updates from chat. This allows the agent to set
					  // explicit start/end months for one or more timeline rows using the same
					  // identifiers it would use for filters (e.g. "SOC2", "ISO27001", "L0").
					  const applyTimelineWindowsFromAction = useCallback(
					    (params?: Record<string, unknown>) => {
					      if (!params) return;

					      const rawWindows = (params as { windows?: unknown }).windows;
					      if (!Array.isArray(rawWindows)) return;

					      const modeRaw = (params as { mode?: unknown }).mode;
					      const mode: "merge" | "replace" =
					        modeRaw === "replace" ? "replace" : "merge";

					      type WindowUpdate = { id: string; start: number; end: number };
					      const updates: WindowUpdate[] = [];

					      for (const entry of rawWindows) {
					        if (!entry || typeof entry !== "object") continue;

					        const e = entry as Record<string, unknown>;
					        // Allow a few flexible field names but document "goal" as the
					        // primary identifier expected from the agent.
					        const identifier =
					          (e.goal as unknown) ??
					          (e.goal_key as unknown) ??
					          (e.framework as unknown) ??
					          (e.core as unknown) ??
					          (e.goal_id as unknown) ??
					          (e.id as unknown);
					        const startRaw =
					          (e.start_month as unknown) ??
					          (e.start as unknown) ??
					          (e.startMonth as unknown);
					        const endRaw =
					          (e.end_month as unknown) ??
					          (e.end as unknown) ??
					          (e.endMonth as unknown);

					        const goalId = resolveTimelineGoalId(identifier);
					        if (!goalId) continue;

					        const startNum =
					          typeof startRaw === "number" && Number.isFinite(startRaw)
					            ? startRaw
					            : typeof startRaw === "string" &&
					              startRaw.trim() !== "" &&
					              !Number.isNaN(Number(startRaw))
					            ? Number(startRaw)
					            : null;
					        const endNum =
					          typeof endRaw === "number" && Number.isFinite(endRaw)
					            ? endRaw
					            : typeof endRaw === "string" && endRaw.trim() !== "" &&
					              !Number.isNaN(Number(endRaw))
					            ? Number(endRaw)
					            : null;

					        if (startNum === null || endNum === null) continue;

						        // Basic sanity constraints: non-negative, end > start
						        const start = Math.max(0, Math.round(startNum));
						        let end = Math.round(endNum);
					        if (end <= start) {
					          end = start + 1;
					        }

					        updates.push({ id: goalId, start, end });
					      }

					      if (updates.length === 0) return;

					      setTimelineWindowsByGoalId((prev) => {
					        const base = mode === "replace" ? {} : { ...prev };
					        const next: typeof prev = base;
					        for (const { id, start, end } of updates) {
					          next[id] = { start, end };
					        }
					        return next;
					      });

					      appendHistory(
					        "chat updated timeline windows for " +
					          updates.length +
					          " goal" +
					          (updates.length === 1 ? "" : "s"),
					      );
					    },
					    [appendHistory, resolveTimelineGoalId, setTimelineWindowsByGoalId],
					  );

					  // Apply timeline row ordering from chat. The agent supplies an ordered list
					  // of identifiers (e.g. ["SOC2", "L0", "ISO27001"]) and we map them to
					  // concrete goal ids using the same resolver as windows.
					  const applyTimelineOrderFromAction = useCallback(
					    (params?: Record<string, unknown>) => {
					      if (!params) return;

					      const rawOrder = (params as { order?: unknown }).order;
					      if (!Array.isArray(rawOrder)) return;

					      const identifiers = rawOrder.filter(
					        (v): v is string =>
					          typeof v === "string" && v.trim() !== "",
					      );
					      if (identifiers.length === 0) return;

					      const existingIds = new Set(
					        timelineBaseGoals.map((g) => g.id),
					      );
					      const orderedIds: string[] = [];

					      for (const identifier of identifiers) {
					        const goalId = resolveTimelineGoalId(identifier);
					        if (!goalId) continue;
					        if (!existingIds.has(goalId)) continue;
					        if (!orderedIds.includes(goalId)) {
					          orderedIds.push(goalId);
					        }
					      }

					      // Append any goals that weren't mentioned so they don't disappear.
					      for (const goal of timelineBaseGoals) {
					        if (!orderedIds.includes(goal.id)) {
					          orderedIds.push(goal.id);
					        }
					      }

					      if (orderedIds.length === 0) return;

					      setTimelineRowOrder(orderedIds);
					      appendHistory("chat reordered timeline rows");
					    },
					    [
					      appendHistory,
					      resolveTimelineGoalId,
					      setTimelineRowOrder,
					      timelineBaseGoals,
					    ],
					  );

		  // Whenever the selection/filter history or implementation timeline changes,
		  // notify the AI agent via a frontend_event. This gives the agent awareness
		  // of the user's recent SCF interactions *and* the current rollout plan.
		  //
		  // The timeline payload mirrors the shapes used for ui.set_timeline_windows
		  // and ui.set_timeline_order so the agent can reuse the same parsing logic.
		  useEffect(() => {
		    const sendFrontendEvent = frontendEventSenderRef.current;
		    if (!sendFrontendEvent) return;

		    const timelinePayload = buildTimelinePayload(timeline, timelineRowOrder);

		    try {
		      sendFrontendEvent("scf_filter_history_changed", {
		        history: selectionHistory,
		        activeFilters: activeFilterLabels,
		        selectedCount: selectedControls.size,
		        timestamp: new Date().toISOString(),
		        ...(timelinePayload ? { timeline: timelinePayload } : {}),
		      });
		    } catch (error) {
		      console.error(
		        "[SCF] Failed to send frontend_event for filter history:",
		        error,
		      );
		    }
		  }, [
		    selectionHistory,
		    activeFilterLabels,
		    selectedControls,
		    timeline,
		    timelineRowOrder,
		  ]);
			  // Build indexes between controls and threats from the full control list.
  const threatIndex = useMemo(() => {
    const controlToThreats = new Map<string, string[]>();
    const threatToControls = new Map<string, Set<string>>();

    for (const control of allItems) {
      // NOTE: backend is expected to expose threat IDs on the SCF record.
      // We look for either the SCF "Control Threat Summary" string or fall back to
      // `data.threats` / `data.threat_ids`, all containing SCF threat object_ids (e.g., "NT-1").
      const rawThreats =
        (control.control_threat_summary
          ? control.control_threat_summary
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : (control.data &&
              (control.data["Control Threat Summary"] ||
                control.data.threats ||
                control.data.threat_ids))) || [];
      if (!Array.isArray(rawThreats)) continue;

      const threatIds = rawThreats.filter(
        (t: unknown): t is string => typeof t === "string" && t.length > 0,
      );
      if (threatIds.length === 0) continue;

      controlToThreats.set(control.object_id, threatIds);

      for (const threatId of threatIds) {
        if (!threatToControls.has(threatId)) {
          threatToControls.set(threatId, new Set<string>());
        }
        threatToControls.get(threatId)!.add(control.object_id);
      }
    }

    return { controlToThreats, threatToControls };
  }, [allItems]);
		
		  // NOTE: We previously kept separate aoIndex/evidenceIndex maps. These are now
		  // consolidated into a single controlInsights structure so AO/evidence
		  // filtering can key off a single per-control document.
		  const controlInsights = useMemo(() => {
		    const byControlId = new Map<
		      string,
		      {
		        control: SCFControl;
		        aos: SCFAssessmentObjective[];
		        evidence: SCFEvidenceRequest[];
		      }
		    >();
		
		    // Seed with all controls so we only associate AO/evidence entries to
		    // known SCF controls.
		    for (const control of allItems) {
		      byControlId.set(control.object_id, {
		        control,
		        aos: [],
		        evidence: [],
		      });
		    }
		
		    // Attach assessment objectives to controls based on control_mappings.
		    for (const ao of allAssessmentObjectives) {
		      const mappings = (ao.control_mappings || "")
		        .split("\n")
		        .map((s) => s.trim())
		        .filter((s) => s.length > 0);
		
		      for (const controlId of mappings) {
		        const entry = byControlId.get(controlId);
		        if (!entry) continue;
		        entry.aos.push(ao);
		      }
		    }
		
		    // Attach evidence requests to controls based on control_mappings.
		    for (const ev of allEvidenceRequests) {
		      const mappings = (ev.control_mappings || "")
		        .split("\n")
		        .map((s) => s.trim())
		        .filter((s) => s.length > 0);
		
		      for (const controlId of mappings) {
		        const entry = byControlId.get(controlId);
		        if (!entry) continue;
		        entry.evidence.push(ev);
		      }
		    }
		
		    return { byControlId };
		  }, [allItems, allAssessmentObjectives, allEvidenceRequests]);
  const riskCoverage = useMemo(() => {
    const selectedCountByRisk = new Map<string, number>();

    for (const controlId of debouncedSelectedControls) {
      const control = controlsById.get(controlId);
      if (control) {
        const riskSummary = control.risk_threat_summary;
        void riskSummary; // kept for potential future debugging
      }

      const risksForControl = riskIndex.controlToRisks.get(controlId) ?? [];
      for (const riskId of risksForControl) {
        selectedCountByRisk.set(
          riskId,
          (selectedCountByRisk.get(riskId) ?? 0) + 1,
        );
      }
    }

    const totalRisks = allRisks.length;
    let coveredRisks = 0;
    let totalCoverageScore = 0;
    const perRiskTarget = 10;

    for (const risk of allRisks) {
      const count = selectedCountByRisk.get(risk.object_id) ?? 0;
      if (count > 0) {
        coveredRisks++;
      }
      const capped = Math.min(count, perRiskTarget);
      totalCoverageScore += capped;
    }

    const averageControlsPerRisk = totalRisks > 0 ? totalCoverageScore / totalRisks : 0;
    const coverage = totalRisks > 0 ? totalCoverageScore / (perRiskTarget * totalRisks) : 0;

    return {
      totalRisks,
      coveredRisks,
      coverage,
      averageControlsPerRisk,
      perRiskTarget,
      totalCoverageScore,
      selectedCountByRisk,
      riskToControls: riskIndex.riskToControls,
    };
  }, [allRisks, debouncedSelectedControls, riskIndex, controlsById]);

  const threatCoverage = useMemo(() => {

    const selectedCountByThreat = new Map<string, number>();

    for (const controlId of debouncedSelectedControls) {
      const threatsForControl = threatIndex.controlToThreats.get(controlId) ?? [];
      for (const threatId of threatsForControl) {
        selectedCountByThreat.set(
          threatId,
          (selectedCountByThreat.get(threatId) ?? 0) + 1,
        );
      }
    }

    const totalThreats = allThreats.length;
    let coveredThreats = 0;
    let totalCoverageScore = 0;
    const perThreatTarget = 10;

    for (const threat of allThreats) {
      const count = selectedCountByThreat.get(threat.object_id) ?? 0;
      if (count > 0) {
        coveredThreats++;
      }
      const capped = Math.min(count, perThreatTarget);
      totalCoverageScore += capped;
    }

    const averageControlsPerThreat =
      totalThreats > 0 ? totalCoverageScore / totalThreats : 0;
    const coverage =
      totalThreats > 0 ? totalCoverageScore / (perThreatTarget * totalThreats) : 0;

    return {
      totalThreats,
      coveredThreats,
      coverage,
      averageControlsPerThreat,
      perThreatTarget,
      totalCoverageScore,
      selectedCountByThreat,
      threatToControls: threatIndex.threatToControls,
    };
	  }, [allThreats, debouncedSelectedControls, threatIndex]);

		  // Derived assessment objectives and evidence for the current selection
		  const aoForSelection = useMemo(() => {
		    const aosById = new Map<string, SCFAssessmentObjective>();
		    const controlsByAoId = new Map<string, Set<string>>();
		    let baselineCount = 0;
		
		    for (const controlId of debouncedSelectedControls) {
		      const entry = controlInsights.byControlId.get(controlId);
		      const aosForControl = entry?.aos ?? [];
		      for (const ao of aosForControl) {
		        if (!aosById.has(ao.object_id)) {
		          aosById.set(ao.object_id, ao);
		          if (ao.is_scf_baseline) {
		            baselineCount++;
		          }
		        }
		        let set = controlsByAoId.get(ao.object_id);
		        if (!set) {
		          set = new Set<string>();
		          controlsByAoId.set(ao.object_id, set);
		        }
		        set.add(controlId);
		      }
		    }
		
		    const items = Array.from(aosById.values());
		    return {
		      items,
		      controlsByAoId,
		      baselineCount,
		      totalCount: items.length,
		    };
		  }, [controlInsights, debouncedSelectedControls]);
		
		  const evidenceForSelection = useMemo(() => {
		    const evidenceById = new Map<string, SCFEvidenceRequest>();
		    const controlsByEvidenceId = new Map<string, Set<string>>();
		
		    for (const controlId of debouncedSelectedControls) {
		      const entry = controlInsights.byControlId.get(controlId);
		      const evidenceForControl = entry?.evidence ?? [];
		      for (const ev of evidenceForControl) {
		        if (!evidenceById.has(ev.object_id)) {
		          evidenceById.set(ev.object_id, ev);
		        }
		        let set = controlsByEvidenceId.get(ev.object_id);
		        if (!set) {
		          set = new Set<string>();
		          controlsByEvidenceId.set(ev.object_id, set);
		        }
		        set.add(controlId);
		      }
		    }
		
		    const items = Array.from(evidenceById.values());
		    return {
		      items,
		      controlsByEvidenceId,
		      totalCount: items.length,
		    };
		  }, [controlInsights, debouncedSelectedControls]);

	  async function handleCreateProjectFromConfigSubmit(
	    event: React.FormEvent<HTMLFormElement>,
	  ) {
	    event.preventDefault();
	    setCreateProjectError(null);

	    const trimmedName = scfProjectName.trim();
	    if (!trimmedName) {
	      setCreateProjectError("Project name is required");
	      return;
	    }

	    if (selectedControls.size === 0) {
	      setCreateProjectError(
	        "Select at least one control before creating a project",
	      );
	      return;
	    }

	    setIsCreatingProject(true);

		    try {
		      const controlsPayload: JsonValue[] = [];

	      for (const controlId of selectedControls) {
	        const control = controlsById.get(controlId);
	        if (!control) continue;

	        const entry = controlInsights.byControlId.get(controlId);
	        const aosForControl = entry?.aos ?? [];
	        const evidenceForControl = entry?.evidence ?? [];

	        const riskIds = riskIndex.controlToRisks.get(controlId) ?? [];
	        const threatIds = threatIndex.controlToThreats.get(controlId) ?? [];

	        controlsPayload.push({
	          object_id: control.object_id,
	          title: control.title,
	          domain: control.domain,
	          cadence: control.cadence,
	          weight: control.weight,
	          covers_soc2: !!control.covers_soc2,
	          covers_gdpr: !!control.covers_gdpr,
	          covers_hipaa: !!control.covers_hipaa,
	          covers_iso27001: !!control.covers_iso27001,
	          covers_iso42001: !!control.covers_iso42001,
	          covers_nist_csf: !!control.covers_nist_csf,
	          covers_nist_ai_rmf: !!control.covers_nist_ai_rmf,
	          is_core_lvl0: !!control.is_core_lvl0,
	          is_core_lvl1: !!control.is_core_lvl1,
	          is_core_lvl2: !!control.is_core_lvl2,
	          is_core_ai_ops: !!control.is_core_ai_ops,
	          is_mcr: !!control.is_mcr,
	          is_dsr: !!control.is_dsr,
	          control_description: control.control_description ?? "",
	          risk_threat_summary: control.risk_threat_summary ?? "",
	          micro_small_solutions: control.micro_small_solutions ?? "",
	          selected: true,
	          priority: priorities.has(controlId),
	          risk_ids: riskIds,
	          threat_ids: threatIds,
	          assessment_objective_ids: aosForControl.map((ao) => ao.object_id),
	          evidence_request_ids: evidenceForControl.map((ev) => ev.object_id),
	        });
	      }

	      if (controlsPayload.length === 0) {
	        setCreateProjectError("No valid controls found for project creation");
	        return;
	      }

	      const controlsByAoIdObject: Record<string, string[]> = {};
	      for (const [aoId, controlIds] of aoForSelection.controlsByAoId.entries()) {
	        controlsByAoIdObject[aoId] = Array.from(controlIds);
	      }

	      const controlsByEvidenceIdObject: Record<string, string[]> = {};
	      for (const [evidenceId, controlIds] of evidenceForSelection.controlsByEvidenceId.entries()) {
	        controlsByEvidenceIdObject[evidenceId] = Array.from(controlIds);
	      }

	      const assessmentObjectivesSection =
	        aoForSelection.items.length > 0
	          ? {
	              items: aoForSelection.items,
	              controls_by_ao_id: controlsByAoIdObject,
	            }
	          : undefined;

	      const evidenceRequestsSection =
	        evidenceForSelection.items.length > 0
	          ? {
	              items: evidenceForSelection.items,
	              controls_by_evidence_id: controlsByEvidenceIdObject,
	            }
	          : undefined;

	      const timelinePayload = buildTimelinePayload(timeline, timelineRowOrder);

	      const configPayload = {
	        version: "scf_config.v1",
	        generated_at: new Date().toISOString(),
	        source: "scf_config",
	        project_name: trimmedName,
	        project_description: scfProjectDescription.trim() || undefined,
	        controls: controlsPayload,
	        ...(assessmentObjectivesSection
	          ? { assessment_objectives: assessmentObjectivesSection }
	          : {}),
	        ...(evidenceRequestsSection
	          ? { evidence_requests: evidenceRequestsSection }
	          : {}),
	        ...(timelinePayload ? { timeline: timelinePayload } : {}),
	      };

	      const result = await createProjectFromSCFConfig(configPayload);

	      if (!result.success) {
	        setCreateProjectError(
	          result.error || "Failed to create project from SCF config",
	        );
	        return;
	      }

	      setIsCreateProjectDialogOpen(false);
	      setScfProjectName("");
	      setScfProjectDescription("");
	      setCreateProjectError(null);

	      if (result.project?.object_id) {
	        router.push(`/projects/${result.project.object_id}`);
	      } else {
	        router.push("/projects");
	      }
	    } catch (err) {
	      console.error("[SCF] Failed to create project from config:", err);
	      setCreateProjectError(
	        "An unexpected error occurred while creating the project",
	      );
	    } finally {
	      setIsCreatingProject(false);
	    }
	  }

	  async function loadAllControls() {
    try {
      setIsLoading(true);
      setError(null);
      const all = await getAllSCFControls();
      setAllItems(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load controls");
      setAllItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  /* NOTE: Deprecated loadAllRisks/loadAllThreats implementations kept for reference; replaced by loadAllRisksSafe/loadAllThreatsSafe below.

	  async function loadAllRisks() {
	    try {
  async function loadAllThreats() {
    try {
      setIsThreatsLoading(true);
      setThreatError(null);
      const threats = await getAllSCFThreats();
      setAllThreats(threats);
    } catch (e) {
      setThreatError(e instanceof Error ? e.message : "Failed to load threats");
      setAllThreats([]);
    } finally {
      setIsThreatsLoading(false);
    }
  }


	      setIsRisksLoading(true);
	      setRiskError(null);
	      const risks = await getAllSCFRisks();
	      setAllRisks(risks);
	    } catch (e) {
	      setRiskError(e instanceof Error ? e.message : "Failed to load risks");
	      setAllRisks([]);
	    } finally {
	      setIsRisksLoading(false);
	    }
	  }
  */


  // Safe loaders for catalog data (risks + threats)
  async function loadAllRisksSafe() {
    try {
      setIsRisksLoading(true);
      setRiskError(null);
      const risks = await getAllSCFRisks();
      setAllRisks(risks);
    } catch (e) {
      setRiskError(e instanceof Error ? e.message : "Failed to load risks");
      setAllRisks([]);
    } finally {
      setIsRisksLoading(false);
    }
  }

  async function loadAllThreatsSafe() {
    try {
      setIsThreatsLoading(true);
      setThreatError(null);
      const threats = await getAllSCFThreats();
      setAllThreats(threats);
    } catch (e) {
      setThreatError(e instanceof Error ? e.message : "Failed to load threats");
      setAllThreats([]);
    } finally {
      setIsThreatsLoading(false);
    }
  }

	  async function loadAllAssessmentObjectivesSafe() {
	    try {
	      setIsAssessmentObjectivesLoading(true);
	      setAssessmentObjectivesError(null);
	      const aos = await getAllSCFAssessmentObjectives();
	      setAllAssessmentObjectives(aos);
	    } catch (e) {
	      setAssessmentObjectivesError(
	        e instanceof Error ? e.message : "Failed to load assessment objectives",
	      );
	      setAllAssessmentObjectives([]);
	    } finally {
	      setIsAssessmentObjectivesLoading(false);
	    }
	  }

	  async function loadAllEvidenceRequestsSafe() {
	    try {
	      setIsEvidenceRequestsLoading(true);
	      setEvidenceRequestsError(null);
	      const evidence = await getAllSCFEvidenceRequests();
	      setAllEvidenceRequests(evidence);
	    } catch (e) {
	      setEvidenceRequestsError(
	        e instanceof Error ? e.message : "Failed to load evidence requests",
	      );
	      setAllEvidenceRequests([]);
	    } finally {
	      setIsEvidenceRequestsLoading(false);
	    }
	  }
  useEffect(() => {
    loadAllControls();
    loadAllMappings();
    loadAllRisksSafe();
    loadAllThreatsSafe();
	    loadAllAssessmentObjectivesSafe();
	    loadAllEvidenceRequestsSafe();
  }, []);

  // Load all mappings for all frameworks
  async function loadAllMappings() {
    // Use ref to prevent concurrent/duplicate loads
    if (mappingsLoadingRef.current || mappingsLoadedRef.current) {
      return;
    }

    mappingsLoadingRef.current = true;

    const frameworks = ["NIST CSF", "NIST AI RMF", "ISO27001", "ISO42001", "GDPR", "SOC2", "HIPAA"];
    const mappingData: Record<string, SCFMapping[]> = {};

    await Promise.all(
      frameworks.map(async (framework) => {
        try {
          const data = await getAllSCFMappingsForFramework(framework);
          mappingData[framework] = data;
        } catch (e) {
          mappingData[framework] = [];
        }
      })
    );

    setMappings(mappingData);
    mappingsLoadedRef.current = true;
    mappingsLoadingRef.current = false;
  }

  // Load priorities from localStorage on mount
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("scf-priorities") : null;
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setPriorities(new Set<string>(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  const togglePriority = useCallback((id: string) => {
    setPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("scf-priorities", JSON.stringify(Array.from(next)));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Selection handlers
  const toggleSelection = useCallback((objectId: string) => {
    setSelectedControls((prev) => {
      const next = new Set(prev);
      if (next.has(objectId)) {
        next.delete(objectId);
        appendHistory("deselected control " + objectId);
      } else {
        next.add(objectId);
        appendHistory("selected control " + objectId);
      }
      return next;
    });
  }, [appendHistory]);

  const selectAllDisplayed = useCallback(() => {
    appendHistory("selected all " + filteredItems.length + " controls in view");
    setSelectedControls((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((item) => next.add(item.object_id));
      return next;
    });
  }, [appendHistory, filteredItems]);

  const resetSelection = useCallback(() => {
    setSelectionHistory([]);
    setSelectedControls(new Set());
  }, []);

  const resetFilters = useCallback(() => {
    markFiltering();
    startFilteringTransition(() => {
      setQ("");
      setWeightMin("");
      setCoversSoc2(false);
      setCoversGdpr(false);
      setCoversHipaa(false);
      setCoversIso27001(false);
      setCoversIso42001(false);
      setCoversNistCsf(false);
      setCoversNistAiRmf(false);
      setIsCoreLvl0(false);
      setIsCoreLvl1(false);
      setIsCoreLvl2(false);
      setIsCoreAiOps(false);
      // Clear local selection/filter history when the user manually resets filters.
      setSelectionHistory([]);
    });
  }, [
    markFiltering,
    startFilteringTransition,
    setQ,
    setWeightMin,
    setCoversSoc2,
    setCoversGdpr,
    setCoversHipaa,
    setCoversIso27001,
    setCoversIso42001,
    setCoversNistCsf,
    setCoversNistAiRmf,
    setIsCoreLvl0,
    setIsCoreLvl1,
    setIsCoreLvl2,
    setIsCoreAiOps,
    setSelectionHistory,
  ]);

  useEffect(() => {
    if (!pendingSelectAllFromChat) return;

    // If filters are currently updating (debounced), wait until they settle so
    // we select based on the *final* filteredItems, not the previous state.
    if (isFiltering) return;

    // When the chat requests "select all filtered", we wait until filters have
    // re-applied (filteredItems updated) and then select all displayed.
    selectAllDisplayed();
    setPendingSelectAllFromChat(false);
  }, [pendingSelectAllFromChat, isFiltering, filteredItems, selectAllDisplayed]);

	  // Auto-select filtered controls: whenever filters change, automatically select all
	  // displayed controls **only when there is at least one active filter**.
	  // If there are no active filters (no search, no min weight, no coverage/core
	  // flags), we keep the selection empty so the user starts from a clean slate.
	  useEffect(() => {
	    // Wait until filtering is complete
	    if (isFiltering) return;

	    const hasAnyFilter = activeFilterLabels.length > 0;

	    if (!hasAnyFilter) {
	      // No filters -> no controls selected
	      setSelectedControls(new Set());
	      return;
	    }

	    // When filters are active, selection mirrors the currently filtered items.
	    setSelectedControls(() => {
	      const next = new Set<string>();
	      filteredItems.forEach((item) => next.add(item.object_id));
	      return next;
	    });
	  }, [filteredItems, isFiltering, activeFilterLabels]);

  // SCF chat UI actions - expected message formats from the backend:
  //
  // 1) Set filters (coverage/core/min weight) and auto-select matching controls:
  //    {
  //      "success": true,
  //      "response": "__UPDATE_SIGNAL__",
  //      "uiActions": [
  //        {
  //          "scope": "scf",
  //          "target": "scf_config",
  //          "type": "ui.set_filters",
  //          "params": {
  //            "coverage_frameworks": ["SOC2", "GDPR"],
  //            "core_levels": ["L0", "L1", "L2", "AI_OPS"],
  //            "min_weight": 10
  //          }
  //        }
  //      ]
  //    }
  //
  // 2) Select controls:
  //    a) All currently filtered controls:
  //       {
  //         "success": true,
  //         "response": "__UPDATE_SIGNAL__",
  //         "uiActions": [
  //           {
  //             "scope": "scf",
  //             "target": "scf_config",
  //             "type": "ui.select_controls",
  //             "params": { "mode": "all_filtered" }
  //           }
  //         ]
  //       }
  //    b) Specific controls by SCF object_id:
  //       {
  //         "success": true,
  //         "response": "__UPDATE_SIGNAL__",
  //         "uiActions": [
  //           {
  //             "scope": "scf",
  //             "target": "scf_config",
  //             "type": "ui.select_controls",
  //             "params": {
  //               "mode": "ids",
  //               "ids": ["SCF-CTRL-001", "SCF-CTRL-017"]
  //             }
  //           }
  //         ]
  //       }
  //
  // 3) Reset all filters and selections:
  //    {
  //      "success": true,
  //      "response": "__UPDATE_SIGNAL__",
  //      "uiActions": [
  //        {
  //          "scope": "scf",
  //          "target": "scf_config",
  //          "type": "ui.reset_filters_and_selection"
  //        }
  //      ]
  //    }
  //
  // 4) Set implementation timeline windows for specific rows. The identifiers
  //    (e.g. "SOC2", "ISO27001", "L0") are the same tokens used for
  //    coverage/core filters so the agent can reuse them for both selection and
  //    timeline control:
  //    {
  //      "success": true,
  //      "response": "__UPDATE_SIGNAL__",
  //      "uiActions": [
  //        {
  //          "scope": "scf",
  //          "target": "scf_config",
  //          "type": "ui.set_timeline_windows",
  //          "params": {
  //            "mode": "merge", // or "replace"
  //            "windows": [
  //              { "goal": "SOC2", "start_month": 0, "end_month": 6 },
  //              { "goal": "L0", "start_month": 0, "end_month": 4 }
  //            ]
  //          }
  //        }
  //      ]
  //    }
  //
  // 5) Set implementation timeline row order, again using the same
  //    identifiers as filters and timeline windows:
  //    {
  //      "success": true,
  //      "response": "__UPDATE_SIGNAL__",
  //      "uiActions": [
  //        {
  //          "scope": "scf",
  //          "target": "scf_config",
  //          "type": "ui.set_timeline_order",
  //          "params": {
  //            "order": ["SOC2", "L0", "ISO27001"]
  //          }
  //        }
  //      ]
  //    }
  //
  // 6) Reset the implementation timeline to its default layout (sequential
  //    4-month windows and default row order):
  //    {
  //      "success": true,
  //      "response": "__UPDATE_SIGNAL__",
  //      "uiActions": [
  //        {
  //          "scope": "scf",
  //          "target": "scf_config",
  //          "type": "ui.reset_timeline"
  //        }
  //      ]
  //    }
  const handleChatUpdate = useCallback(
    (_updateType?: string, uiActions?: UiAction[]) => {
      if (!uiActions || uiActions.length === 0) return;

      const relevantActions = uiActions.filter((action) => {
        const scope = action.scope ?? "scf";
        const target = action.target ?? "scf_config";

        const scopeMatches = scope === "scf" || scope === "global";
        const targetMatches = target === "scf_config" || target === "scf";

        return scopeMatches && targetMatches;
      });

      if (relevantActions.length === 0) return;

	      // If a reset action is present in this batch, apply it first so that
	      // subsequent filter/selection/timeline updates operate on a clean
	      // baseline. This prevents sequences like
	      //   [reset, set_filters, select_controls]
	      // from effectively "cancelling" the reset.
	      const hasResetTimeline = relevantActions.some(
	        (action) => action.type === "ui.reset_timeline",
	      );
	      const hasResetFiltersAndSelection = relevantActions.some(
	        (action) => action.type === "ui.reset_filters_and_selection",
	      );

	      if (hasResetTimeline) {
	        // Clear explicit windows and order; the existing effects will
	        // repopulate default 4-month windows in the base order.
	        setTimelineWindowsByGoalId({});
	        setTimelineRowOrder([]);
	        appendHistory("chat reset the implementation timeline");
	      }

	      if (hasResetFiltersAndSelection) {
	        resetFilters();
	        resetSelection();
	        appendHistory("chat reset all filters and selections");
	      }

	      // Apply remaining actions in order, skipping resets we already
	      // handled above.
	      for (const action of relevantActions) {
	        switch (action.type) {
	          case "ui.reset_timeline":
	          case "ui.reset_filters_and_selection":
	            // Already processed in the reset phase.
	            break;
	          case "ui.set_filters":
	            applyScfFiltersFromAction(action.params);
	            break;
	          case "ui.select_controls":
	            applyScfSelectionFromAction(action.params);
	            break;
	          case "ui.set_timeline_windows":
	            applyTimelineWindowsFromAction(action.params);
	            break;
	          case "ui.set_timeline_order":
	            applyTimelineOrderFromAction(action.params);
	            break;
	          default:
	            // Unknown ui action types are ignored.
	            break;
	        }
	      }
    },
    [
      appendHistory,
      applyScfFiltersFromAction,
      applyScfSelectionFromAction,
      applyTimelineOrderFromAction,
      applyTimelineWindowsFromAction,
      resetFilters,
      resetSelection,
      setTimelineRowOrder,
      setTimelineWindowsByGoalId,
    ],
  );



	  const scfSuggestedQuestions = useMemo(() => {
	    const suggestions: string[] = [];
	    if (selectedControls.size === 0) {
	      suggestions.push("Filter controls to SOC 2 and L1 core");
	    } else {
	      suggestions.push(
	        `What frameworks do my ${selectedControls.size} selected controls cover?`,
	      );
	    }
	    suggestions.push("Show coverage gaps for ISO 27001");
	    suggestions.push("Select all AI_OPS controls");
	    return suggestions;
	  }, [selectedControls]);

	  const orderedTimelineGoals =
	    timelineRowOrder.length > 0
	      ? [...timeline.goals].sort((a, b) => {
	          const aIndex = timelineRowOrder.indexOf(a.id);
	          const bIndex = timelineRowOrder.indexOf(b.id);
	          if (aIndex === -1 && bIndex === -1) {
	            return 0;
	          }
	          if (aIndex === -1) return 1;
	          if (bIndex === -1) return -1;
	          return aIndex - bIndex;
	        })
	      : timeline.goals;

		  // Use a shared axis max for both the month scale and the bars so that
		  // everything lines up visually. We always show at least 12 months as the
		  // default planning horizon, and extend beyond that if any bar is dragged
		  // further out.
		  const markerMaxMonths = Math.max(12, timeline.maxMonths);
		  const monthMarkers = Array.from({ length: markerMaxMonths + 1 }, (_, i) => i);
	  const totalControlsAllGoals = timeline.goals.reduce(
	    (sum, goal) => sum + goal.totalControls,
	    0,
	  );
	  const totalNewControls = timeline.totalUniqueControls;

	  return (
    <div className="w-full h-full p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">SCF Configurator</h1>
	        <p className="text-muted-foreground mt-2">
	          Here we are just letting you and the agent select the controls that match your goals; ask the
	          agent if you are confused (I was pretty confused at first).
	        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - Filters */}
        <div className="lg:w-80 flex-shrink-0 space-y-6">

          <Card>
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle>Filters</CardTitle>
                {isFiltering && !isLoading && (
                  <div className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Filtering...
                  </div>
                )}
              </div>
              <ExportButton
                allControls={allItems}
                priorityControlIds={priorities}
                selectedControlIds={selectedControls}
              />
	              <Button
	                size="sm"
	                onClick={() => {
	                  setCreateProjectError(null);
	                  setIsCreateProjectDialogOpen(true);
	                }}
	                disabled={selectedControls.size === 0}
	                className="w-full"
	              >
	                Create project from SCF config
	              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={resetFilters}
                className="w-full"
              >
                Reset Filters
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Input
                  placeholder="Search (q): title, domain, object_id"
                  value={q}
                  onChange={(e) => {
                    markFiltering();
                    startFilteringTransition(() => {
                      setQ(e.target.value);
                    });
                  }}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min weight"
                  value={weightMin}
                  onChange={(e) => {
                    markFiltering();
                    startFilteringTransition(() => {
                      setWeightMin(e.target.value);
                    });
                  }}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Coverage</div>
                  <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="soc2"
                    checked={coversSoc2}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversSoc2(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "SOC 2");
                    }}
                  />
                  <Label htmlFor="soc2">SOC 2</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gdpr"
                    checked={coversGdpr}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversGdpr(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "GDPR");
                    }}
                  />
                  <Label htmlFor="gdpr">GDPR</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hipaa"
                    checked={coversHipaa}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversHipaa(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "HIPAA");
                    }}
                  />
                  <Label htmlFor="hipaa">HIPAA</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="iso27001"
                    checked={coversIso27001}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversIso27001(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "ISO 27001");
                    }}
                  />
                  <Label htmlFor="iso27001">ISO 27001</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="iso42001"
                    checked={coversIso42001}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversIso42001(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "ISO 42001");
                    }}
                  />
                  <Label htmlFor="iso42001">ISO 42001</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="nistcsf"
                    checked={coversNistCsf}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversNistCsf(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "NIST CSF");
                    }}
                  />
                  <Label htmlFor="nistcsf">NIST CSF</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="nistairmf"
                    checked={coversNistAiRmf}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setCoversNistAiRmf(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "NIST AI RMF");
                    }}
                  />
                  <Label htmlFor="nistairmf">NIST AI RMF</Label>
                </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Core</div>
                  <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="core0"
                    checked={isCoreLvl0}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setIsCoreLvl0(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "Core L0");
                    }}
                  />
                  <Label htmlFor="core0">Core L0</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="core1"
                    checked={isCoreLvl1}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setIsCoreLvl1(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "Core L1");
                    }}
                  />
                  <Label htmlFor="core1">Core L1</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="core2"
                    checked={isCoreLvl2}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setIsCoreLvl2(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "Core L2");
                    }}
                  />
                  <Label htmlFor="core2">Core L2</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="coreaiops"
                    checked={isCoreAiOps}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      markFiltering();
                      startFilteringTransition(() => {
                        setIsCoreAiOps(checked);
                      });
                      appendHistory((checked ? "selected " : "deselected ") + "Core AI Ops");
                    }}
                  />
                  <Label htmlFor="coreaiops">Core AI Ops</Label>
                </div>
              </div>
            </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t">
                <div>
                  Results: {filteredItems.length} of {allItems.length}
                </div>
                {activeFilterLabels.length > 0 && (
                  <div>
                    Filters: {activeFilterLabels.join(" + ")}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600">Error: {error}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">

      {/* Coverage Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Framework Coverage</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedControls.size} control{selectedControls.size !== 1 ? 's' : ''} selected
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {riskCoverage.totalRisks > 0 && (
              <button
                type="button"
                onClick={() => setIsRiskDetailsOpen(true)}
                className="border rounded-lg p-4 space-y-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {(() => {
                  const coveragePercent = riskCoverage.coverage * 100;
                  const percentage = coveragePercent.toFixed(1);
                  const isGreen = coveragePercent >= 90;
                  const isBlue = coveragePercent >= 75 && coveragePercent < 90;
                  const isYellow = coveragePercent < 75;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">SCF Risks</span>
                        <Badge
                          className={
                            isGreen
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800"
                              : isBlue
                              ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800"
                              : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
                          }
                        >
                          {percentage}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {riskCoverage.coveredRisks} of {riskCoverage.totalRisks} risks covered
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isGreen
                              ? "bg-emerald-500"
                              : isBlue
                              ? "bg-blue-500"
                              : "bg-yellow-500"
                          }`}
                          style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Click to see more details
                      </div>
                    </>
                  );
                })()}
              </button>
            )}


            {threatCoverage.totalThreats > 0 && (
              <button
                type="button"
                onClick={() => setIsThreatDetailsOpen(true)}
                className="border rounded-lg p-4 space-y-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {(() => {
                  const coveragePercent = threatCoverage.coverage * 100;
                  const percentage = coveragePercent.toFixed(1);
                  const isGreen = coveragePercent >= 90;
                  const isBlue = coveragePercent >= 75 && coveragePercent < 90;
                  const isYellow = coveragePercent < 75;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">SCF Threats</span>
                        <Badge
                          className={
                            isGreen
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800"
                              : isBlue
                              ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800"
                              : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
                          }
                        >
                          {percentage}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {threatCoverage.coveredThreats} of {threatCoverage.totalThreats} threats covered
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isGreen
                              ? "bg-emerald-500"
                              : isBlue
                              ? "bg-blue-500"
                              : "bg-yellow-500"
                          }`}
                          style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Click to see more details
                      </div>
                    </>
                  );
                })()}
              </button>
            )}

            {Object.entries(coverageStats).map(([framework, stats]) => {
              const percentage = (stats.coverage * 100).toFixed(1);
              const coveragePercent = stats.coverage * 100;

              // Color thresholds: >=90% green, >=75% blue, else yellow
              const isGreen = coveragePercent >= 90;
              const isBlue = coveragePercent >= 75 && coveragePercent < 90;
              const isYellow = coveragePercent < 75;

              return (
                <div key={framework} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{framework}</span>
                    <Badge
                      className={
                        isGreen
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-800"
                          : isBlue
                          ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800"
                          : "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800"
                      }
                    >
                      {percentage}%
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.selected} of {stats.mapped} controls
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isGreen
                          ? "bg-emerald-500"
                          : isBlue
                          ? "bg-blue-500"
                          : "bg-yellow-500"
                      }`}
                      style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
		      </Card>
	    		
		    	{/* Implementation timeline is always visible; when there are no goals it
		    	   simply shows an empty state instead of hiding the card entirely. */}
		    	<Card>
		        	<CardHeader>
		          	<CardTitle>Implementation timeline</CardTitle>
		          	<p className="text-sm text-muted-foreground mt-1">
		          	  Each row represents a selected core level or framework. Drag and resize the
		          	  colored bars to plan when you will complete each milestone.
		          	</p>
		        	</CardHeader>
		        	<CardContent className="space-y-4">
		        	  {timeline.goals.length === 0 ? (
		        	    <p className="text-sm text-muted-foreground">
		        	      No implementation milestones yet. Select some controls with the filters
		        	      or ask the agent to propose a rollout plan, and they will appear here.
		        	    </p>
		        	  ) : (
		        	    <>
		          {/* NOTE: Previously this card used a single horizontal strip of segments
		              sized by newControls plus a numeric "Target months" input. This was
		              replaced with a per-row Gantt-style layout and direct drag/resize
		              interaction so that only actively selected filters appear as channels
		              on the timeline, which better matches the requested UX. */}
		
		        	          {/* Month markers header row */}
		        	          <div className="space-y-2">
		            {/* Use fixed widths for the anchor + title columns so the month scale
		                aligns exactly with the bar column across all rows. */}
		            <div className="grid grid-cols-[32px,220px,minmax(0,1fr),auto] items-center gap-2 text-[11px] text-muted-foreground">
		              <div />
		              <div />
		              <div className="relative h-5">
		                <div className="absolute inset-0 flex items-end justify-between">
		                  {monthMarkers.map((month) => (
		                    <span key={month} className="translate-x-[-50%]">
		                      {month}m
		                    </span>
		                  ))}
		                </div>
		                <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
		              </div>
		              <div className="text-right">Controls</div>
		            </div>
		
		            {/* Rows per selected filter */}
		            <div className="space-y-1">
		              {orderedTimelineGoals.map((goal) => {
		                // Use the same axis as the month markers so the bars always
		                // line up with the visible scale.
		                const axisMax = Math.max(12, timeline.maxMonths, 1);
		                const barStartPercent = (goal.startMonth / axisMax) * 100;
		                const barWidthPercent =
		                  ((goal.endMonth - goal.startMonth) / axisMax) * 100 ||
		                  (4 / axisMax) * 100;
		                const colorClass =
		                  goal.type === "CORE" ? "bg-slate-500" : "bg-indigo-500";
		
		                const handleResizeMouseDown = (
		                  e: React.MouseEvent<HTMLDivElement>,
		                  edge: "start" | "end",
		                ) => {
		                  e.preventDefault();
		                  e.stopPropagation();
		                  const trackEl =
		                    (e.currentTarget.parentElement?.parentElement as HTMLElement | null) ??
		                    null;
		                  if (!trackEl) return;
		                  const rect = trackEl.getBoundingClientRect();
		                  const win =
		                    timelineWindowsByGoalId[goal.id] ?? {
		                      start: goal.startMonth,
		                      end: goal.endMonth,
		                    };
		                  dragStateRef.current = {
		                    goalId: goal.id,
		                    mode: edge,
		                    trackLeft: rect.left,
		                    trackWidth: rect.width,
		                    axisMax,
		                    initialStart: win.start,
		                    initialEnd: win.end,
		                  };
		                };
		
		                const handleBarMouseDown = (
		                  e: React.MouseEvent<HTMLDivElement>,
		                ) => {
		                  e.preventDefault();
		                  e.stopPropagation();
		                  const trackEl = e.currentTarget.parentElement as HTMLElement | null;
		                  if (!trackEl) return;
		                  const rect = trackEl.getBoundingClientRect();
		                  const win =
		                    timelineWindowsByGoalId[goal.id] ?? {
		                      start: goal.startMonth,
		                      end: goal.endMonth,
		                    };
		                  const px = e.clientX;
		                  const ratio = (px - rect.left) / rect.width;
		                  const clampedRatio = Math.min(1, Math.max(0, ratio));
		                  const pointerMonthAtStart = Math.round(clampedRatio * axisMax);
		                  dragStateRef.current = {
		                    goalId: goal.id,
		                    mode: "move",
		                    trackLeft: rect.left,
		                    trackWidth: rect.width,
		                    axisMax,
		                    initialStart: win.start,
		                    initialEnd: win.end,
		                    pointerMonthAtStart,
		                  };
		                };
		
		                const handleRowDragMouseDown = (
		                  e: React.MouseEvent<HTMLButtonElement>,
		                ) => {
		                  e.preventDefault();
		                  e.stopPropagation();
		                  const order =
		                    timelineRowOrder.length > 0
		                      ? timelineRowOrder
		                      : timeline.goals.map((g) => g.id);
		                  const startIndex = order.indexOf(goal.id);
		                  if (startIndex === -1) return;
		                  rowDragStateRef.current = {
		                    draggingId: goal.id,
		                    startY: e.clientY,
		                    startIndex,
		                    currentIndex: startIndex,
		                    orderSnapshot: order.slice(),
		                  };
		                };
		
		                return (
		                  <div
		                    key={goal.id}
		                    className="grid grid-cols-[32px,220px,minmax(0,1fr),auto] items-center gap-2"
		                  >
		                    {/* Column 1: vertical drag anchor for row reordering */}
		                    <button
		                      type="button"
		                      onMouseDown={handleRowDragMouseDown}
		                      className="h-6 w-4 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground"
		                      aria-label="Reorder timeline row"
		                    >
		                      <span className="flex flex-col gap-[2px]">
		                        <span className="h-[2px] w-3 bg-border rounded-full" />
		                        <span className="h-[2px] w-3 bg-border rounded-full" />
		                      </span>
		                    </button>
		
		                    {/* Column 2: title (fixed width, truncate if too long) */}
		                    <div className="flex items-center gap-1 min-w-0">
		                      <span className="text-sm font-medium truncate" title={goal.label}>
		                        {goal.label}
		                      </span>
		                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
		                        {goal.type === "CORE" ? "Core level" : "Framework"}
		                      </span>
		                    </div>
		
		                    {/* Column 3: bar with hover-only resize anchors */}
		                    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted group">
		                      <div
		                        className={`absolute inset-y-0 rounded-full ${colorClass} transition-colors group-hover:bg-opacity-90`}
		                        style={{
		                          left: `${barStartPercent}%`,
		                          width: `${barWidthPercent}%`,
		                        }}
		                        onMouseDown={handleBarMouseDown}
		                      >
		                        {/* Start drag handle */}
		                        <div
		                          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
		                          onMouseDown={(e) => handleResizeMouseDown(e, "start")}
		                        />
		                        {/* End drag handle */}
		                        <div
		                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
		                          onMouseDown={(e) => handleResizeMouseDown(e, "end")}
		                        />
		                      </div>
		                    </div>
		
		                    {/* Column 4: counts */}
		                    <div className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
		                      {goal.totalControls} ctrl{goal.totalControls === 1 ? "" : "s"} (
		                      {goal.newControls} new)
		                    </div>
		                  </div>
		                );
		              })}
		            </div>
		          </div>
		
		        	          {/* Totals row under counts column - only show total new controls */}
		        	          <div className="flex justify-end text-[11px] text-muted-foreground">
		        	            <span>
		        	              Total: {totalNewControls} new ctrl
		        	              {totalNewControls === 1 ? "" : "s"}
		        	            </span>
		        	          </div>
		        	        </>
		        	      )}
		        	    </CardContent>
		        	  </Card>

      {riskCoverage.totalRisks > 0 && (
        <Dialog open={isRiskDetailsOpen} onOpenChange={setIsRiskDetailsOpen}>
          <DialogContent className="w-[98vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle>SCF Risk Coverage Details</DialogTitle>
                <DialogDescription>
                  Avg {riskCoverage.averageControlsPerRisk.toFixed(1)} of {riskCoverage.perRiskTarget} target controls per risk
                  ({riskCoverage.coveredRisks} of {riskCoverage.totalRisks} risks have at least one selected control).
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-md border bg-muted px-1 py-1">
                  <Button
                    size="sm"
                    variant={riskFilter === "all" ? "default" : "outline"}
                    onClick={() => setRiskFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={riskFilter === "covered" ? "default" : "outline"}
                    onClick={() => setRiskFilter("covered")}
                  >
                    Covered
                  </Button>
                  <Button
                    size="sm"
                    variant={riskFilter === "uncovered" ? "default" : "outline"}
                    onClick={() => setRiskFilter("uncovered")}
                  >
                    Uncovered
                  </Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIsRiskDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogHeader>

            {isRisksLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading risks…
              </div>
            ) : riskError ? (
              <p className="text-sm text-red-600">Error loading risks: {riskError}</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Showing{" "}
                    {
                      allRisks.filter((risk) => {
                        const count = riskCoverage.selectedCountByRisk.get(risk.object_id) ?? 0;
                        if (riskFilter === "covered") return count > 0;
                        if (riskFilter === "uncovered") return count === 0;
                        return true;
                      }).length
                    }{" "}
                    of {allRisks.length} risks ({riskFilter}).
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Risk ID</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Grouping</TableHead>
                        <TableHead className="whitespace-nowrap">NIST Function</TableHead>
                        <TableHead className="whitespace-nowrap">Covered by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allRisks
                        .filter((risk) => {
                          const count = riskCoverage.selectedCountByRisk.get(risk.object_id) ?? 0;
                          if (riskFilter === "covered") return count > 0;
                          if (riskFilter === "uncovered") return count === 0;
                          return true;
                        })
                        .map((risk) => {
                          const selectedCount =
                            riskCoverage.selectedCountByRisk.get(risk.object_id) ?? 0;

                          return (
                            <TableRow key={risk.object_id}>
                              <TableCell className="whitespace-nowrap text-xs font-mono">
                                {risk.object_id}
                              </TableCell>
                              <TableCell className="max-w-[420px] text-xs">
                                <div className="font-medium">{risk.title}</div>
                                {risk.description && (
                                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-3">
                                    {risk.description}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{risk.grouping}</TableCell>
                              <TableCell className="text-xs">{risk.nist_function}</TableCell>
                              <TableCell className="text-xs">
                                {selectedCount > 0 ? (
                                  <span>
                                    Partially covered by {selectedCount} selected control
                                    {selectedCount === 1 ? "" : "s"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Not currently covered
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}


      {threatCoverage.totalThreats > 0 && (
        <Dialog open={isThreatDetailsOpen} onOpenChange={setIsThreatDetailsOpen}>
          <DialogContent className="w-[98vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <DialogTitle>SCF Threat Coverage Details</DialogTitle>
                <DialogDescription>
                  Avg {threatCoverage.averageControlsPerThreat.toFixed(1)} of {threatCoverage.perThreatTarget} target controls per threat
                  ({threatCoverage.coveredThreats} of {threatCoverage.totalThreats} threats have at least one selected control).
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-md border bg-muted px-1 py-1">
                  <Button
                    size="sm"
                    variant={threatFilter === "all" ? "default" : "outline"}
                    onClick={() => setThreatFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={threatFilter === "covered" ? "default" : "outline"}
                    onClick={() => setThreatFilter("covered")}
                  >
                    Covered
                  </Button>
                  <Button
                    size="sm"
                    variant={threatFilter === "uncovered" ? "default" : "outline"}
                    onClick={() => setThreatFilter("uncovered")}
                  >
                    Uncovered
                  </Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIsThreatDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogHeader>

            {isThreatsLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading threats…
              </div>
            ) : threatError ? (
              <p className="text-sm text-red-600">Error loading threats: {threatError}</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Showing{" "}
                    {
                      allThreats.filter((threat) => {
                        const count =
                          threatCoverage.selectedCountByThreat.get(threat.object_id) ?? 0;
                        if (threatFilter === "covered") return count > 0;
                        if (threatFilter === "uncovered") return count === 0;
                        return true;
                      }).length
                    }{" "}
                    of {allThreats.length} threats ({threatFilter}).
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Threat ID</TableHead>
                        <TableHead>Threat</TableHead>
                        <TableHead>Grouping</TableHead>
                        <TableHead className="whitespace-nowrap">Covered by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allThreats
                        .filter((threat) => {
                          const count =
                            threatCoverage.selectedCountByThreat.get(threat.object_id) ?? 0;
                          if (threatFilter === "covered") return count > 0;
                          if (threatFilter === "uncovered") return count === 0;
                          return true;
                        })
                        .map((threat) => {
                          const selectedCount =
                            threatCoverage.selectedCountByThreat.get(threat.object_id) ?? 0;

                          return (
                            <TableRow key={threat.object_id}>
                              <TableCell className="whitespace-nowrap text-xs font-mono">
                                {threat.object_id}
                              </TableCell>
                              <TableCell className="max-w-[420px] text-xs">
                                <div className="font-medium">{threat.title}</div>
                                {threat.description && (
                                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-3">
                                    {threat.description}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">{threat.grouping}</TableCell>
                              <TableCell className="text-xs">
                                {selectedCount > 0 ? (
                                  <span>
                                    Partially covered by {selectedCount} selected control
                                    {selectedCount === 1 ? "" : "s"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Not currently covered
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}



	      <Tabs defaultValue="controls" className="space-y-4">
	        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	      <TabsList>
	        <TabsTrigger value="controls">Controls</TabsTrigger>
	        <TabsTrigger value="evidence">
	          Evidence Requests
	          {evidenceForSelection.totalCount > 0 && (
	            <span className="ml-1 text-xs text-muted-foreground">
	              ({evidenceForSelection.totalCount})
	            </span>
	          )}
	        </TabsTrigger>
	        <TabsTrigger value="assessment">
	          Assessment Objectives
	          {aoForSelection.totalCount > 0 && (
	            <span className="ml-1 text-xs text-muted-foreground">
	              ({aoForSelection.totalCount})
	            </span>
	          )}
	        </TabsTrigger>
	      </TabsList>
	      <div className="text-xs text-muted-foreground">
	        {debouncedSelectedControls.size} control
	        {debouncedSelectedControls.size !== 1 ? "s" : ""} selected
	      </div>
	        </div>

	        <TabsContent value="controls">
	          <Card>
	            <CardHeader>
	              <CardTitle>
	                Results {allItems.length ? `(${filteredItems.length} of ${allItems.length})` : ""}
	              </CardTitle>
	            </CardHeader>
	            <CardContent>
	              {isLoading ? (
	                <div className="flex items-center justify-center py-10">
	                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
	                  <span className="ml-2 text-sm text-muted-foreground">Loading controls…</span>
	                </div>
	              ) : filteredItems.length === 0 ? (
	                <p className="text-sm text-muted-foreground">No results</p>
	              ) : (
	                <Accordion type="multiple" defaultValue={[]} className="w-full">
	                  {groups.map(([domainName, ctrls]) => (
	                    <AccordionItem key={domainName} value={domainName}>
	                      <AccordionTrigger>
	                        <div className="flex w-full items-center justify-between">
	                          <span className="font-medium">{domainName}</span>
	                          <span className="text-xs text-muted-foreground">{ctrls.length} controls</span>
	                        </div>
	                      </AccordionTrigger>
	                      <AccordionContent>
	                        <Table>
	                          <TableHeader>
	                            <TableRow>
	                              <TableHead className="w-10">Select</TableHead>
	                              <TableHead className="w-10">Priority</TableHead>
	                              <TableHead>Object ID</TableHead>
	                              <TableHead>Title</TableHead>
	                              <TableHead>Coverage</TableHead>
	                              <TableHead>Core</TableHead>
	                              <TableHead>Cadence</TableHead>
	                              <TableHead>Weight</TableHead>
	                            </TableRow>
	                          </TableHeader>
	                          <TableBody>
	                            {ctrls.map((c) => (
	                              <SCFControlRow
	                                key={c.object_id}
	                                control={c}
	                                isSelected={selectedControls.has(c.object_id)}
	                                isPriority={priorities.has(c.object_id)}
	                                onToggleSelection={toggleSelection}
	                                onTogglePriority={togglePriority}
	                              />
	                            ))}
	                          </TableBody>
	                        </Table>
	                      </AccordionContent>
	                    </AccordionItem>
	                  ))}
	                </Accordion>
	              )}
	            </CardContent>
	          </Card>
	        </TabsContent>

	        <TabsContent value="evidence">
	          <Card>
	            <CardHeader>
	              <CardTitle>Evidence Requests</CardTitle>
	              <p className="text-sm text-muted-foreground mt-1">
	                {debouncedSelectedControls.size === 0
	                  ? "Select one or more controls to see suggested evidence requests."
	                  : evidenceForSelection.totalCount === 0
	                  ? "No SCF evidence requests are directly mapped to the current selection."
	                  : `${evidenceForSelection.totalCount} evidence request${
	                      evidenceForSelection.totalCount === 1 ? "" : "s"
	                    } mapped to your selection.`}
	              </p>
	            </CardHeader>
	            <CardContent>
	              {isEvidenceRequestsLoading ? (
	                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
	                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                  Loading evidence requests…
	                </div>
	              ) : evidenceRequestsError ? (
	                <p className="text-sm text-red-600">
	                  Error loading evidence requests: {evidenceRequestsError}
	                </p>
		              ) :
		              debouncedSelectedControls.size === 0 || evidenceForSelection.totalCount === 0 ? null : (
	                // NOTE: Description was removed from the table to keep this list compact;
	                // full details are shown in a row detail dialog instead.
		                <div className="overflow-x-auto max-w-5xl">
	                  <Table>
	                    <TableHeader>
	                      <TableRow>
	                        <TableHead className="whitespace-nowrap">Evidence ID</TableHead>
	                        <TableHead>Artifact</TableHead>
	                        <TableHead>Area of Focus</TableHead>
	                        <TableHead className="whitespace-nowrap">Applies to</TableHead>
	                      </TableRow>
	                    </TableHeader>
	                    <TableBody>
	                      {evidenceForSelection.items
	                        .slice()
	                        .sort((a, b) => a.object_id.localeCompare(b.object_id))
	                        .map((erl) => {
	                          const controls =
	                            evidenceForSelection.controlsByEvidenceId.get(erl.object_id);
	                          const controlCount = controls?.size ?? 0;
	
	                          return (
	                            <TableRow
	                              key={erl.object_id}
	                              className="cursor-pointer hover:bg-muted/50"
	                              onClick={() => {
	                                setSelectedEvidence(erl);
	                                setIsEvidenceDetailsOpen(true);
	                              }}
	                            >
	                              <TableCell className="whitespace-nowrap text-xs font-mono">
	                                {erl.object_id}
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                <div className="font-medium line-clamp-2">{erl.artifact}</div>
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                {erl.area_of_focus ? (
	                                  <Badge
	                                    variant="outline"
	                                    className="text-[11px] font-normal"
	                                  >
	                                    {erl.area_of_focus}
	                                  </Badge>
	                                ) : (
	                                  <span className="text-muted-foreground">—</span>
	                                )}
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                {controlCount > 0 ? (
	                                  <span>
	                                    Applies to {controlCount} selected control
	                                    {controlCount === 1 ? "" : "s"}
	                                  </span>
	                                ) : (
	                                  <span className="text-muted-foreground">
	                                    Not mapped to current selection
	                                  </span>
	                                )}
	                              </TableCell>
	                            </TableRow>
	                          );
	                        })}
	                    </TableBody>
	                  </Table>
	                </div>
	              )}
	            </CardContent>
	          </Card>
	        </TabsContent>

	        <TabsContent value="assessment">
	          <Card>
	            <CardHeader>
	              <CardTitle>Assessment Objectives</CardTitle>
	              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
	                <p className="text-sm text-muted-foreground">
	                  {debouncedSelectedControls.size === 0
	                    ? "Select one or more controls to see baseline assessment objectives."
	                    : aoForSelection.totalCount === 0
	                    ? "No assessment objectives are directly mapped to the current selection."
	                    : `${aoForSelection.totalCount} assessment objective${
	                        aoForSelection.totalCount === 1 ? "" : "s"
	                      } mapped to your selection (${aoForSelection.baselineCount} baseline).`}
	                </p>
	                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
	                  <Checkbox
	                    checked={showBaselineOnly}
	                    onCheckedChange={(value) => setShowBaselineOnly(!!value)}
	                  />
	                  Baseline only
	                </label>
	              </div>
	            </CardHeader>
	            <CardContent>
	              {isAssessmentObjectivesLoading ? (
	                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
	                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                  Loading assessment objectives…
	                </div>
	              ) : assessmentObjectivesError ? (
	                <p className="text-sm text-red-600">
	                  Error loading assessment objectives: {assessmentObjectivesError}
	                </p>
		              ) :
		              debouncedSelectedControls.size === 0 || aoForSelection.totalCount === 0 ? null : (
		                <div className="overflow-x-auto max-w-5xl">
	                  <Table>
	                    <TableHeader>
	                      <TableRow>
	                        <TableHead className="whitespace-nowrap">AO ID</TableHead>
	                        <TableHead>Statement</TableHead>
	                        <TableHead>Origin</TableHead>
	                        <TableHead>Baseline</TableHead>
	                        <TableHead className="whitespace-nowrap">Applies to</TableHead>
	                      </TableRow>
	                    </TableHeader>
	                    <TableBody>
	                      {aoForSelection.items
	                        .filter((ao) => (showBaselineOnly ? !!ao.is_scf_baseline : true))
	                        .slice()
	                        .sort((a, b) => a.object_id.localeCompare(b.object_id))
	                        .map((ao) => {
	                          const controls = aoForSelection.controlsByAoId.get(ao.object_id);
	                          const controlCount = controls?.size ?? 0;
	
	                          return (
	                            <TableRow
	                              key={ao.object_id}
	                              className="cursor-pointer hover:bg-muted/50"
	                              onClick={() => {
	                                setSelectedAssessmentObjective(ao);
	                                setIsAssessmentDetailsOpen(true);
	                              }}
	                            >
	                              <TableCell className="whitespace-nowrap text-xs font-mono">
	                                {ao.object_id}
	                              </TableCell>
	                              <TableCell className="max-w-[360px] text-xs">
	                                <div className="font-medium line-clamp-2">{ao.statement}</div>
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                {ao.origin ? (
	                                  <Badge
	                                    variant="outline"
	                                    className="text-[11px] font-normal"
	                                  >
	                                    {ao.origin}
	                                  </Badge>
	                                ) : (
	                                  <span className="text-muted-foreground">—</span>
	                                )}
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                {ao.is_scf_baseline ? (
	                                  <Badge className="bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 text-[11px]">
	                                    Baseline
	                                  </Badge>
	                                ) : (
	                                  <span className="text-muted-foreground text-[11px]">
	                                    Non-baseline
	                                  </span>
	                                )}
	                              </TableCell>
	                              <TableCell className="text-xs">
	                                {controlCount > 0 ? (
	                                  <span>
	                                    Applies to {controlCount} selected control
	                                    {controlCount === 1 ? "" : "s"}
	                                  </span>
	                                ) : (
	                                  <span className="text-muted-foreground">
	                                    Not mapped to current selection
	                                  </span>
	                                )}
	                              </TableCell>
	                            </TableRow>
	                          );
	                        })}
	                    </TableBody>
	                  </Table>
	                </div>
	              )}
	            </CardContent>
	          </Card>
	        </TabsContent>

	        {/* Create project from SCF config dialog */}
	        <Dialog
	          open={isCreateProjectDialogOpen}
	          onOpenChange={(open) => {
	            setIsCreateProjectDialogOpen(open);
	            if (!open) {
	              setCreateProjectError(null);
	            }
	          }}
	        >
	          <DialogContent className="max-w-md">
	            <DialogHeader>
	              <DialogTitle>Create project from SCF configuration</DialogTitle>
	              <DialogDescription>
	                Create a new project seeded from your currently selected controls,
	                including documentation, evidence requests, and assessment objectives.
	              </DialogDescription>
	            </DialogHeader>
	            <form
	              onSubmit={handleCreateProjectFromConfigSubmit}
	              className="space-y-4"
	            >
	              <div className="space-y-2">
	                <Label htmlFor="scf-project-name">Project name</Label>
	                <Input
	                  id="scf-project-name"
	                  placeholder="e.g. SOC 2 – Core Controls Rollout"
	                  value={scfProjectName}
	                  onChange={(e) => setScfProjectName(e.target.value)}
	                  autoFocus
	                  disabled={isCreatingProject}
	                />
	              </div>
	              <div className="space-y-2">
	                <Label htmlFor="scf-project-description">
	                  Description (optional)
	                </Label>
	                <Textarea
	                  id="scf-project-description"
	                  placeholder="Describe the purpose and scope of this project..."
	                  value={scfProjectDescription}
	                  onChange={(e) => setScfProjectDescription(e.target.value)}
	                  disabled={isCreatingProject}
	                  rows={3}
	                />
	              </div>
	              <p className="text-xs text-muted-foreground">
	                {selectedControls.size === 0
	                  ? "No controls selected. Select at least one control to enable project creation."
	                  : `${selectedControls.size} control${
	                      selectedControls.size === 1 ? "" : "s"
	                    } selected; only selected controls will be included in the project.`}
	              </p>
	              {createProjectError && (
	                <p className="text-sm text-red-600">{createProjectError}</p>
	              )}
	              <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
	                <Button
	                  type="button"
	                  variant="outline"
	                  onClick={() => setIsCreateProjectDialogOpen(false)}
	                  disabled={isCreatingProject}
	                >
	                  Cancel
	                </Button>
	                <Button
	                  type="submit"
	                  disabled={
	                    isCreatingProject || selectedControls.size === 0
	                  }
	                >
	                  {isCreatingProject ? (
	                    <>
	                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                      Creating…
	                    </>
	                  ) : (
	                    "Create project"
	                  )}
	                </Button>
	              </DialogFooter>
	            </form>
	          </DialogContent>
	        </Dialog>

	        {/* Evidence Request detail dialog (row click) */}
	        {selectedEvidence && (
	          <Dialog
	            open={isEvidenceDetailsOpen}
	            onOpenChange={(open) => {
	              setIsEvidenceDetailsOpen(open);
	              if (!open) {
	                setSelectedEvidence(null);
	              }
	            }}
	          >
	            <DialogContent className="max-w-xl">
	              <DialogHeader>
	                <DialogTitle>
	                  Evidence {selectedEvidence.object_id}
	                </DialogTitle>
	                <DialogDescription>
	                  Suggested artifact mapped to your currently selected controls.
	                </DialogDescription>
	              </DialogHeader>
	              <div className="space-y-4 text-sm">
	                <div>
	                  <div className="font-medium">Artifact</div>
	                  <div className="mt-1">{selectedEvidence.artifact}</div>
	                </div>
	                <div>
	                  <div className="font-medium">Area of focus</div>
	                  <div className="mt-1">
	                    {selectedEvidence.area_of_focus ? (
	                      <Badge variant="outline" className="text-[11px] font-normal">
	                        {selectedEvidence.area_of_focus}
	                      </Badge>
	                    ) : (
	                      <span className="text-xs text-muted-foreground">
	                        Not specified
	                      </span>
	                    )}
	                  </div>
	                </div>
	                <div>
	                  <div className="font-medium">Description</div>
	                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
	                    {selectedEvidence.description || "No description provided."}
	                  </p>
	                </div>
	                <div>
	                  <div className="font-medium">Applies to controls</div>
	                  {(() => {
	                    const controlIds =
	                      evidenceForSelection.controlsByEvidenceId.get(
	                        selectedEvidence.object_id,
	                      );
	                    if (!controlIds || controlIds.size === 0) {
	                      return (
	                        <p className="mt-1 text-xs text-muted-foreground">
	                          Not mapped to current selection.
	                        </p>
	                      );
	                    }
	                    const controls = Array.from(controlIds)
	                      .map((id) => controlsById.get(id))
	                      .filter((c): c is SCFControl => !!c);
	                    return (
	                      <ul className="mt-1 space-y-1 text-xs">
	                        {controls.map((control) => (
	                          <li key={control.object_id}>
	                            <span className="font-mono">{control.object_id}</span>{" "}
	                            <span className="text-muted-foreground">- {control.title}</span>
	                          </li>
	                        ))}
	                      </ul>
	                    );
	                  })()}
	                </div>
	              </div>
	            </DialogContent>
	          </Dialog>
	        )}

	        {/* Assessment Objective detail dialog (row click) */}
	        {selectedAssessmentObjective && (
	          <Dialog
	            open={isAssessmentDetailsOpen}
	            onOpenChange={(open) => {
	              setIsAssessmentDetailsOpen(open);
	              if (!open) {
	                setSelectedAssessmentObjective(null);
	              }
	            }}
	          >
	            <DialogContent className="max-w-xl">
	              <DialogHeader>
	                <DialogTitle>
	                  Assessment Objective {selectedAssessmentObjective.object_id}
	                </DialogTitle>
	                <DialogDescription>
	                  Baseline assessment guidance mapped to your currently selected controls.
	                </DialogDescription>
	              </DialogHeader>
	              <div className="space-y-4 text-sm">
	                <div>
	                  <div className="font-medium">Statement</div>
	                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
	                    {selectedAssessmentObjective.statement}
	                  </p>
	                </div>
	                <div className="flex flex-wrap items-center gap-2 text-xs">
	                  {selectedAssessmentObjective.origin && (
	                    <Badge variant="outline" className="text-[11px] font-normal">
	                      {selectedAssessmentObjective.origin}
	                    </Badge>
	                  )}
	                  {selectedAssessmentObjective.is_scf_baseline ? (
	                    <Badge className="bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 text-[11px]">
	                      Baseline
	                    </Badge>
	                  ) : (
	                    <span className="text-[11px] text-muted-foreground">Non-baseline</span>
	                  )}
	                </div>
	                <div>
	                  <div className="font-medium">Applies to controls</div>
	                  {(() => {
	                    const controlIds =
	                      aoForSelection.controlsByAoId.get(
	                        selectedAssessmentObjective.object_id,
	                      );
	                    if (!controlIds || controlIds.size === 0) {
	                      return (
	                        <p className="mt-1 text-xs text-muted-foreground">
	                          Not mapped to current selection.
	                        </p>
	                      );
	                    }
	                    const controls = Array.from(controlIds)
	                      .map((id) => controlsById.get(id))
	                      .filter((c): c is SCFControl => !!c);
	                    return (
	                      <ul className="mt-1 space-y-1 text-xs">
	                        {controls.map((control) => (
	                          <li key={control.object_id}>
	                            <span className="font-mono">{control.object_id}</span>{" "}
	                            <span className="text-muted-foreground">- {control.title}</span>
	                          </li>
	                        ))}
	                      </ul>
	                    );
	                  })()}
	                </div>
	              </div>
	            </DialogContent>
	          </Dialog>
	        )}
	      </Tabs>
      {organizationId && (
        <ProjectChatPanel
          projectId={organizationId}
          projectName="SCF Configurator"
          disableProjectId
          entryPoint="scf_config"
          resumeSessionId={resumeSessionId}
          initiallyOpen={!!resumeSessionId}
          onUpdateEvent={handleChatUpdate}
          onRegisterFrontendEventSender={(sender) => {
            frontendEventSenderRef.current = sender;
          }}
          suggestedQuestions={scfSuggestedQuestions}
        />
      )}
        </div>
      </div>
    </div>
  );
}

