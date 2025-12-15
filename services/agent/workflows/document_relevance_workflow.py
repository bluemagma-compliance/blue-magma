"""Document relevance workflow (Phase 3: analysis + execution loop).

This module defines a LangGraph-based workflow that wraps the existing
`_evaluate_single_document_with_writer` method from `ProjectContentTool`
and layers in an analysis/planning node plus an execution node that
iterates over a small action queue.

Phase 3 keeps external behavior the same as previous phases: callers
still receive the original writer-style evaluation result and continue
to apply document/evidence edits in `ProjectContentTool`. The new
execution loop and routing decisions are internal-only scaffolding for
future behavior changes.
"""
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from emitters.thought_emitter import emit_workflow_thought


class DocumentRelevanceWorkflowState(TypedDict, total=False):
    """State for the document relevance workflow.

    Threads through:
      - input document, project context, and last messages;
      - the evaluation result from the underlying writer step;
      - a high-level analysis/plan produced by an LLM;
      - an execution-time action queue; and
      - a routing_decision describing how control should return to the
        main LLM or other graph nodes.
    """

    document: Dict[str, Any]
    project_context: str
    last_messages: List[Dict[str, Any]]
    evaluation_result: Dict[str, Any]
    plan: Dict[str, Any]
    # Action queue and bookkeeping for the execution node. Actions are
    # stored as plain dicts (the .dict() representation of
    # DocumentRelevanceAction) so they are JSON-serializable.
    pending_actions: List[Dict[str, Any]]
    completed_actions: List[Dict[str, Any]]
    done: bool
    routing_decision: Dict[str, Any]


class DocumentRelevanceAction(BaseModel):
    """Single high-level step the document relevance workflow could execute.

    In later phases we will support edit_document and edit_evidence_requests
    actions. For Phase 2, the execution node only handles
    "return_to_main_llm" and treats other actions as unsupported.
    """

    action_type: str = Field(
        description=(
            "Type of action the workflow should take next. "
            "Expected values: 'edit_document', 'edit_evidence_requests', "
            "or 'return_to_main_llm'."
        )
    )
    reason: str = Field(
        description="Short explanation of why this action is recommended."
    )


class DocumentRelevancePlan(BaseModel):
    """Analysis-and-plan output from the document relevance LLM node.

    For Phase 2 this is primarily used to validate structured output and
    wiring. Phase 3 begins to treat actions as part of an execution
    loop, but external side-effects remain owned by ProjectContentTool.
    """

    actions: List[DocumentRelevanceAction] = Field(
        default_factory=list,
        description=(
            "Ordered list of high-level actions the workflow should attempt. "
            "The first action is considered the highest priority."
        ),
    )
    summary: Optional[str] = Field(
        default=None,
        description=(
            "Optional short summary of how the workflow should proceed "
            "(e.g., whether to edit the document, update evidence requests, "
            "or simply return control to the main LLM)."
        ),
    )


class ExecutionRoutingDecision(BaseModel):
    """Post-action routing decision for the execution node.

    This is produced by a (potentially cheaper) LLM after each action is
    logically executed. It tells the workflow whether to continue,
    insert additional actions, or cancel the remaining plan.
    """

    decision: str = Field(
        ...,
        description=(
            'What to do after the most recent action. Expected values: '
            '"continue", "insert_before_next", or "cancel".'
        ),
    )
    new_actions: List[DocumentRelevanceAction] = Field(
        default_factory=list,
        description=(
            "Additional actions to insert before the next pending action "
            "when decision == 'insert_before_next'."
        ),
    )
    notes: Optional[str] = Field(
        default=None,
        description=(
            "Optional explanation or rationale for the routing decision. "
            "May be surfaced in debug logs or thoughts."
        ),
    )


async def run_document_relevance_workflow(
    project_content_tool: Any,
    *,
    document: Dict[str, Any],
    project_context: str,
    last_messages: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Run the document relevance workflow.

    Phase 3 keeps the external behavior identical to Phase 1 and 2:
    callers still receive the same evaluation_result structure that is
    produced by `_evaluate_single_document_with_writer`. The additional
    analysis, execution, and routing metadata are internal-only for now.
    """

    async def _initial_evaluation_node(
        state: DocumentRelevanceWorkflowState,
    ) -> DocumentRelevanceWorkflowState:
        """Call the existing writer step to get the core evaluation.

        This preserves the original behavior and result shape. The
        evaluation is then fed into the analysis/planning node.
        """

        title = state.get("document", {}).get("title") or "(untitled document)"
        try:
            await emit_workflow_thought(
                f"Phase 3: running writer evaluation for '{title}' in document relevance workflow.",
                node="document_relevance.initial_evaluation",
            )
        except Exception:
            # Thought emission is best-effort and must not break the flow.
            pass

        try:
            result = await project_content_tool._evaluate_single_document_with_writer(  # type: ignore[attr-defined]
                document=state["document"],
                project_context=state["project_context"],
                last_messages=state.get("last_messages", []),
            )
        except Exception as exc:  # pragma: no cover - defensive guardrail
            # If something unexpected happens, surface a structured
            # failure rather than raising, so callers see a consistent
            # shape.
            if hasattr(project_content_tool, "_debug"):
                project_content_tool._debug(
                    f"document_relevance_workflow: writer step failed with error: {exc!r}"
                )
            result = {"success": False, "error": str(exc)}

        new_state: DocumentRelevanceWorkflowState = dict(state)
        new_state["evaluation_result"] = result
        return new_state

    async def _analysis_and_planning_node(
        state: DocumentRelevanceWorkflowState,
    ) -> DocumentRelevanceWorkflowState:
        """Use an LLM with structured output to propose a high-level plan.

        We pass the document, project context, and the writer-produced
        evaluation into a structured-output LLM that returns a
        DocumentRelevancePlan. In Phase 3 this plan seeds a small action
        queue that the execution node iterates over, but external
        side-effects (document/evidence writes) are still applied by
        ProjectContentTool.
        """

        new_state: DocumentRelevanceWorkflowState = dict(state)
        evaluation_result = new_state.get("evaluation_result") or {}
        evaluation = evaluation_result.get("evaluation") or {}
        title = new_state.get("document", {}).get("title") or "(untitled document)"

        try:
            await emit_workflow_thought(
                f"Phase 3: analyzing document '{title}' to propose a relevance action plan.",
                node="document_relevance.analysis",
            )
        except Exception:
            pass

        llm_client = getattr(project_content_tool, "llm_client", None)
        if not llm_client or not hasattr(llm_client, "with_structured_output"):
            # Fallback: no LLM available for planning, default to a single
            # return_to_main_llm action so the workflow remains safe.
            default_action = DocumentRelevanceAction(
                action_type="return_to_main_llm",
                reason=(
                    "LLM client not available for planning; returning control "
                    "to the main LLM without performing edits."
                ),
            )
            plan = DocumentRelevancePlan(
                actions=[default_action],
                summary=(
                    "Default Phase 3 plan: no-op document relevance workflow "
                    "because planning LLM is unavailable."
                ),
            )
            plan_dict = plan.dict()
            new_state["plan"] = plan_dict
            new_state["pending_actions"] = plan_dict.get("actions") or []
            new_state.setdefault("completed_actions", [])
            new_state["done"] = False
            # Emit a thought that explicitly lists the planned actions so the
            # frontend can display the current task list.
            try:
                actions = plan_dict.get("actions") or []
                if actions:
                    lines = []
                    for idx, action in enumerate(actions, start=1):
                        a_type = str(action.get("action_type") or "?").strip()
                        reason = str(action.get("reason") or "").strip()
                        if reason:
                            lines.append(f"{idx}. {a_type} – {reason}")
                        else:
                            lines.append(f"{idx}. {a_type}")
                    actions_text = "\n".join(lines)
                    await emit_workflow_thought(
                        (
                            f"Phase 3: planned actions for '{title}':\n"
                            f"{actions_text}"
                        ),
                        node="document_relevance.plan",
                    )
            except Exception:
                # Thought emission is best-effort.
                pass
            return new_state

        # Configure a structured-output LLM for the analysis/plan.
        try:
            structured_llm = llm_client.with_structured_output(DocumentRelevancePlan)
        except Exception as exc:  # pragma: no cover - defensive guardrail
            if hasattr(project_content_tool, "_debug"):
                project_content_tool._debug(
                    "document_relevance_workflow: failed to configure structured "
                    f"LLM for planning: {exc!r}"
                )
            default_action = DocumentRelevanceAction(
                action_type="return_to_main_llm",
                reason=(
                    "Could not configure planning LLM; returning control to the "
                    "main LLM without performing edits."
                ),
            )
            plan = DocumentRelevancePlan(actions=[default_action])
            plan_dict = plan.dict()
            new_state["plan"] = plan_dict
            new_state["pending_actions"] = plan_dict.get("actions") or []
            new_state.setdefault("completed_actions", [])
            new_state["done"] = False
            # Emit a minimal task-list thought even when we fall back.
            try:
                actions = plan_dict.get("actions") or []
                if actions:
                    lines = []
                    for idx, action in enumerate(actions, start=1):
                        a_type = str(action.get("action_type") or "?").strip()
                        reason = str(action.get("reason") or "").strip()
                        if reason:
                            lines.append(f"{idx}. {a_type} – {reason}")
                        else:
                            lines.append(f"{idx}. {a_type}")
                    actions_text = "\n".join(lines)
                    await emit_workflow_thought(
                        (
                            f"Phase 3: planned actions for '{title}' (fallback plan):\n"
                            f"{actions_text}"
                        ),
                        node="document_relevance.plan",
                    )
            except Exception:
                pass
            return new_state

        project_context_text = new_state.get("project_context") or (
            "Org/project context not provided explicitly. Org ID and Project ID "
            "are available in the system."
        )

        relevance_score = evaluation.get("relevance_score")
        relevance_category = evaluation.get("relevance_category")
        rationale = evaluation.get("rationale")

        prompt = f"""You are planning next steps for a document relevance workflow.

Project context (from the system):
{project_context_text}

Document under evaluation:
- Title: {title}

Writer evaluation summary (already computed by another step):
- relevance_score: {relevance_score}
- relevance_category: {relevance_category}
- rationale: {rationale}

Your job is to propose a small, ordered list of high-level actions for
the workflow to perform next. You MUST choose from these actions only:

- "edit_document"          => propose edits to the document content
- "edit_evidence_requests" => propose edits to evidence requests linked to this document
- "return_to_main_llm"     => stop the workflow and return control to the main LLM

Guidelines:
- Prefer "return_to_main_llm" when you do not see a clear, high-value
  document or evidence edit to perform automatically.
- Keep the actions list short (1-3 items).
- Explain briefly in `reason` why each action is recommended.
"""

        plan: Optional[DocumentRelevancePlan] = None
        max_retries = 1
        last_error: Optional[str] = None

        for attempt in range(max_retries + 1):
            try:
                plan = await structured_llm.ainvoke([HumanMessage(content=prompt)])
                break
            except Exception as exc:  # pragma: no cover - defensive guardrail
                last_error = str(exc)
                if hasattr(project_content_tool, "_debug"):
                    project_content_tool._debug(
                        "document_relevance_workflow: planning LLM call failed "
                        f"on attempt {attempt}: {exc!r}"
                    )

        if plan is None:
            # If planning failed entirely, fall back to a simple
            # return_to_main_llm plan so we never break callers.
            reason = (
                "Planning LLM failed; returning control to the main LLM."
                f" Last error: {last_error}" if last_error else "Planning LLM failed."
            )
            default_action = DocumentRelevanceAction(
                action_type="return_to_main_llm",
                reason=reason,
            )
            plan = DocumentRelevancePlan(actions=[default_action])

        plan_dict = plan.dict()
        new_state["plan"] = plan_dict
        new_state["pending_actions"] = plan_dict.get("actions") or []
        new_state.setdefault("completed_actions", [])
        new_state["done"] = False

        # Emit a thought that summarizes the full action queue so the current
        # set of tasks is observable from the frontend.
        try:
            actions = plan_dict.get("actions") or []
            if actions:
                lines = []
                for idx, action in enumerate(actions, start=1):
                    a_type = str(action.get("action_type") or "?").strip()
                    reason = str(action.get("reason") or "").strip()
                    if reason:
                        lines.append(f"{idx}. {a_type} – {reason}")
                    else:
                        lines.append(f"{idx}. {a_type}")
                actions_text = "\n".join(lines)
                await emit_workflow_thought(
                    (
                        f"Phase 3: planned actions for '{title}':\n"
                        f"{actions_text}"
                    ),
                    node="document_relevance.plan",
                )
        except Exception:
            pass
        return new_state

    async def _make_execution_routing_decision(
        *,
        action: Dict[str, Any],
        pending_actions: List[Dict[str, Any]],
        evaluation: Dict[str, Any],
    ) -> Optional[ExecutionRoutingDecision]:
        """Use a (potentially cheaper) LLM to steer the execution loop.

        Returns None when no suitable LLM client is available or when
        configuration/calls fail. Callers should treat None as
        "continue" with no new actions inserted.
        """

        routing_llm_client = getattr(project_content_tool, "routing_llm_client", None)
        if routing_llm_client is None:
            routing_llm_client = getattr(project_content_tool, "llm_client", None)

        if routing_llm_client is None or not hasattr(routing_llm_client, "with_structured_output"):
            return None

        title = document.get("title") or "(untitled document)"
        score = evaluation.get("relevance_score")
        category = evaluation.get("relevance_category")

        try:
            structured_llm = routing_llm_client.with_structured_output(ExecutionRoutingDecision)
        except Exception as exc:  # pragma: no cover - defensive guardrail
            if hasattr(project_content_tool, "_debug"):
                project_content_tool._debug(
                    "document_relevance_workflow: failed to configure routing LLM "
                    f"for execution node: {exc!r}"
                )
            return None

        action_type = str(action.get("action_type") or "").strip()
        action_reason = str(action.get("reason") or "").strip()
        remaining = len(pending_actions)

        prompt = f"""You are routing a document relevance workflow after executing one action.

Document title: {title}
Current document relevance_score: {score} (category: {category})

Most recent action:
- type: {action_type}
- reason: {action_reason}

There are currently {remaining} additional pending actions in the queue.

Decide what the workflow should do next. You MUST choose exactly one:

- "continue"          => continue with the next pending action as-is
- "insert_before_next" => insert a few high-value actions before the next one
- "cancel"            => stop executing remaining actions and return control

Guidelines:
- Prefer "continue" when the plan already looks reasonable.
- Use "insert_before_next" sparingly when a very small number of extra
  actions would clearly improve the outcome.
- Use "cancel" when further automated actions would be low value or
  risky; this will return control to the main LLM instead.
"""

        max_retries = 1
        last_error: Optional[str] = None

        for attempt in range(max_retries + 1):
            try:
                decision_model: ExecutionRoutingDecision = await structured_llm.ainvoke(  # type: ignore[assignment]
                    [HumanMessage(content=prompt)]
                )
                return decision_model
            except Exception as exc:  # pragma: no cover - defensive guardrail
                last_error = str(exc)
                if hasattr(project_content_tool, "_debug"):
                    project_content_tool._debug(
                        "document_relevance_workflow: routing LLM call failed "
                        f"on attempt {attempt}: {exc!r}"
                    )

        if hasattr(project_content_tool, "_debug") and last_error is not None:
            project_content_tool._debug(
                "document_relevance_workflow: routing LLM ultimately failed: "
                f"{last_error!r}"
            )
        return None

    async def _execution_node(
        state: DocumentRelevanceWorkflowState,
    ) -> DocumentRelevanceWorkflowState:
        """Execution node for Phase 3: iterate over a small action queue.

        The execution node currently treats actions as *logical* steps
        only. It records which actions were processed and uses a
        cheap(er) LLM (when available) to decide whether to continue,
        insert actions, or cancel. Actual document/evidence mutations are
        still performed by ProjectContentTool based on the writer
        evaluation, so external semantics remain unchanged.
        """

        new_state: DocumentRelevanceWorkflowState = dict(state)
        evaluation_result = new_state.get("evaluation_result") or {}
        evaluation = evaluation_result.get("evaluation") or {}
        plan_dict = new_state.get("plan") or {}

        pending_actions: List[Dict[str, Any]] = list(
            new_state.get("pending_actions") or plan_dict.get("actions") or []
        )
        completed_actions: List[Dict[str, Any]] = list(
            new_state.get("completed_actions") or []
        )

        if new_state.get("done"):
            # Workflow already marked done; just propagate state.
            return new_state

        title = new_state.get("document", {}).get("title") or "(untitled document)"

        if not pending_actions:
            routing_decision: Dict[str, Any] = {
                "kind": "return_to_main_llm",
                "reason": "Phase 3: no actions in plan; returning control to main LLM.",
            }
            try:
                await emit_workflow_thought(
                    f"Phase 3: execution node had no actions for '{title}', "
                    f"routing_decision={routing_decision}.",
                    node="document_relevance.execution",
                )
            except Exception:
                pass

            new_state["pending_actions"] = []
            new_state["completed_actions"] = completed_actions
            new_state["routing_decision"] = routing_decision
            new_state["done"] = True
            return new_state

        max_iterations = 5
        last_routing_model: Optional[ExecutionRoutingDecision] = None

        for _ in range(max_iterations):
            if not pending_actions:
                break

            raw_action = pending_actions.pop(0) or {}
            raw_type = raw_action.get("action_type") or ""
            action_type = str(raw_type).strip()
            reason = str(raw_action.get("reason") or "").strip()

            try:
                await emit_workflow_thought(
                    f"Phase 3: executing planned action '{action_type}' for '{title}' "
                    f"(reason: {reason}).",
                    node="document_relevance.execution",
                )
            except Exception:
                pass

            # For now we treat edit actions as logical steps only so that the
            # outer ProjectContentTool continues to own all I/O.
            if action_type == "edit_document":
                action_outcome = {
                    "kind": "edit_document",
                    "status": "planned",
                    "note": (
                        "Document content edits are currently applied outside the "
                        "workflow using the writer evaluation; this workflow step "
                        "is recorded for observability only."
                    ),
                }
            elif action_type == "edit_evidence_requests":
                action_outcome = {
                    "kind": "edit_evidence_requests",
                    "status": "planned",
                    "note": (
                        "Evidence request edits are currently applied by the "
                        "ProjectContentTool when relevance_score is high enough; "
                        "this workflow step is recorded for observability only."
                    ),
                }
            elif action_type == "return_to_main_llm":
                routing_decision = {
                    "kind": "return_to_main_llm",
                    "reason": reason
                    or "Workflow plan requested returning control to the main LLM.",
                }
                completed_actions.append(raw_action)
                new_state["pending_actions"] = pending_actions
                new_state["completed_actions"] = completed_actions
                new_state["routing_decision"] = routing_decision
                new_state["done"] = True
                try:
                    await emit_workflow_thought(
                        f"Phase 3: execution node returning to main LLM for '{title}' "
                        f"with routing_decision={routing_decision}.",
                        node="document_relevance.execution",
                    )
                except Exception:
                    pass
                return new_state
            else:
                action_outcome = {
                    "kind": "unknown_action_type",
                    "action_type": action_type,
                    "status": "ignored",
                    "note": (
                        "Action type not recognized by Phase 3 execution node; "
                        "ignoring and continuing."
                    ),
                }

            completed_actions.append({**raw_action, "outcome": action_outcome})

            # Ask the routing LLM (when available) how to proceed.
            routing_model = await _make_execution_routing_decision(
                action=raw_action,
                pending_actions=pending_actions,
                evaluation=evaluation,
            )

            if routing_model is None:
                # Default: continue sequentially with whatever is left.
                continue

            last_routing_model = routing_model
            decision = str(routing_model.decision or "").strip()
            extra_actions = [a.dict() for a in routing_model.new_actions or []]

            try:
                await emit_workflow_thought(
                    f"Phase 3: routing decision after '{action_type}' is "
                    f"'{decision}' with {len(extra_actions)} new_actions.",
                    node="document_relevance.routing",
                )
            except Exception:
                pass

            if decision == "insert_before_next" and extra_actions:
                pending_actions = extra_actions + pending_actions
            elif decision == "cancel":
                routing_decision = {
                    "kind": "cancelled_by_execution_routing",
                    "reason": routing_model.notes
                    or "Execution routing LLM requested cancellation after the "
                    "latest action.",
                }
                new_state["pending_actions"] = pending_actions
                new_state["completed_actions"] = completed_actions
                new_state["routing_decision"] = routing_decision
                new_state["done"] = True
                return new_state
            else:
                # "continue" or unknown => just move on to the next action.
                continue

        # Finished iterating (either no pending actions or max_iterations reached).
        if pending_actions:
            routing_decision = {
                "kind": "partial_plan_executed",
                "reason": (
                    "Phase 3: maximum execution iterations reached; returning "
                    "control to main LLM with remaining pending actions."
                ),
            }
        else:
            reason = (
                last_routing_model.notes
                if last_routing_model and last_routing_model.notes
                else "Phase 3: all planned actions executed; returning control to main LLM."
            )
            routing_decision = {
                "kind": "return_to_main_llm",
                "reason": reason,
            }

        try:
            await emit_workflow_thought(
                f"Phase 3: execution node finished for '{title}' with "
                f"routing_decision={routing_decision}.",
                node="document_relevance.execution",
            )
        except Exception:
            pass

        new_state["pending_actions"] = pending_actions
        new_state["completed_actions"] = completed_actions
        new_state["routing_decision"] = routing_decision
        new_state["done"] = True
        return new_state

    workflow = StateGraph(DocumentRelevanceWorkflowState)
    workflow.add_node("initial_evaluation", _initial_evaluation_node)
    workflow.add_node("analysis_and_planning", _analysis_and_planning_node)
    workflow.add_node("execution", _execution_node)
    workflow.set_entry_point("initial_evaluation")
    workflow.add_edge("initial_evaluation", "analysis_and_planning")
    workflow.add_edge("analysis_and_planning", "execution")
    workflow.add_edge("execution", END)

    app = workflow.compile()
    initial_state: DocumentRelevanceWorkflowState = {
        "document": document,
        "project_context": project_context,
        "last_messages": last_messages or [],
    }
    final_state = await app.ainvoke(initial_state)

    evaluation_result: Dict[str, Any] = final_state.get(
        "evaluation_result", {"success": False, "error": "No evaluation result"}
    )

    # Attach workflow metadata so the calling tool (and therefore the main LLM)
    # can see what happened inside the workflow run. This is additive and
    # backwards-compatible: existing callers that only look at
    # evaluation_result["evaluation"] continue to work unchanged.
    try:
        workflow_meta: Dict[str, Any] = {
            "plan": final_state.get("plan"),
            "pending_actions": final_state.get("pending_actions"),
            "completed_actions": final_state.get("completed_actions"),
            "routing_decision": final_state.get("routing_decision"),
            "done": bool(final_state.get("done")),
        }

        # Build a compact natural-language summary for the LLM to consume.
        doc_title = document.get("title") or "(untitled document)"
        actions = workflow_meta.get("completed_actions") or []
        plan = workflow_meta.get("plan") or {}
        planned_count = len(plan.get("actions") or []) if isinstance(plan, dict) else 0
        completed_count = len(actions)

        routing = workflow_meta.get("routing_decision") or {}
        routing_kind = routing.get("kind") or "unknown"
        routing_reason = routing.get("reason") or ""

        summary_parts = [
            f"Document relevance workflow for '{doc_title}' executed.",
            f"Planned actions: {planned_count}; completed actions: {completed_count}.",
            f"Final routing: {routing_kind}",
        ]
        if routing_reason:
            summary_parts.append(f"Reason: {routing_reason}")

        workflow_meta["summary"] = " ".join(summary_parts)

        # Return a shallow copy so we do not mutate the original result object.
        wrapped_result: Dict[str, Any] = dict(evaluation_result)
        wrapped_result["workflow"] = workflow_meta
        return wrapped_result
    except Exception:
        # If anything goes wrong while attaching metadata, fall back to the
        # bare evaluation_result to avoid breaking callers.
        return evaluation_result

