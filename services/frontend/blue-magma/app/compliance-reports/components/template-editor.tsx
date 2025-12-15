"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Edit,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ReportTemplate,
  TemplateSection,
  TemplateRule,
  Codebase,
  UiTemplateSection,
  UiReportTemplate,
  UiTemplateRule,
} from "@/types/api";
import {
  createTemplate,
  updateTemplate,
  createTemplateSection,
  updateTemplateSection,
  deleteTemplateSection,
  createRule,
  getCodebases,
} from "../template-actions";

interface TemplateEditorProps {
  template: UiReportTemplate;
  onSave: (template: UiReportTemplate) => void;
  onCancel: () => void;
}

export default function TemplateEditor({
  template,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  // Ensure template has required properties initialized
  const initialTemplate: UiReportTemplate = {
    ...template,
    sections: template.sections || [],
    codebases: template.codebases || [],
  };
  const [editingTemplate, setEditingTemplate] =
    useState<UiReportTemplate>(initialTemplate);
  const [originalSections] = useState<UiTemplateSection[]>(
    template.sections || [],
  ); // Track original sections for deletion detection
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [loadingCodebases, setLoadingCodebases] = useState(true);

  useEffect(() => {
    const loadCodebases = async () => {
      try {
        const codebasesData = await getCodebases();
        setCodebases(codebasesData || []);
      } catch (error) {
        console.error("Failed to load codebases:", error);
        toast.error("Failed to load codebases");
      } finally {
        setLoadingCodebases(false);
      }
    };

    loadCodebases();
  }, []);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleRule = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const addSection = () => {
    const sections = editingTemplate.sections || [];
    const newSection: UiTemplateSection = {
      object_id: `section-${Date.now()}`,
      name: "New Section",
      description: "",
      template_id: editingTemplate.object_id || "",
      rules: [],
      order: sections.length,
    };

    setEditingTemplate({
      ...editingTemplate,
      sections: [...sections, newSection],
    });
    setExpandedSections(new Set([...expandedSections, newSection.object_id]));
    setEditingSection(newSection.object_id);
  };

  const updateSection = (
    sectionId: string,
    updates: Partial<UiTemplateSection>,
  ) => {
    const sections = editingTemplate.sections || [];
    setEditingTemplate({
      ...editingTemplate,
      sections: sections.map((section) =>
        section.object_id === sectionId ? { ...section, ...updates } : section,
      ),
    });
  };

  const deleteSection = (sectionId: string) => {
    const sections = editingTemplate.sections || [];
    setEditingTemplate({
      ...editingTemplate,
      sections: sections.filter((section) => section.object_id !== sectionId),
    });
  };

  const addRule = (sectionId: string) => {
    const newRule: UiTemplateRule = {
      object_id: `rule-${Date.now()}`,
      name: "New Rule",
      rule: "",
      policy_name: "",
      policy_version: "1.0",
      evidence_schema: { required_documents: [] },
      scope: "",
      tags: "",
      public: false,
      source: "custom",
      description: "",
      severity: "medium",
      section: "",
      organization_id: 0,
    };

    updateSection(sectionId, {
      rules: [
        ...(editingTemplate.sections.find((s) => s.object_id === sectionId)
          ?.rules || []),
        newRule,
      ],
    });
    setEditingRule(newRule.object_id);
  };

  const updateRule = (
    sectionId: string,
    ruleId: string,
    updates: Partial<UiTemplateRule>,
  ) => {
    const sections = editingTemplate.sections || [];
    const section = sections.find((s) => s.object_id === sectionId);
    if (!section) return;

    const rules = section.rules || [];
    updateSection(sectionId, {
      rules: rules.map((rule) =>
        rule.object_id === ruleId ? { ...rule, ...updates } : rule,
      ),
    });
  };

  const deleteRule = (sectionId: string, ruleId: string) => {
    const section = editingTemplate.sections.find(
      (s) => s.object_id === sectionId,
    );
    if (!section) return;

    updateSection(sectionId, {
      rules: section.rules.filter((rule) => rule.object_id !== ruleId),
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Set template as inactive by default
      const templateToSave = {
        ...editingTemplate,
        active: false,
      };

      // Check if this is a new template (starts with 'custom-') or existing
      const isNewTemplate = editingTemplate.object_id.startsWith("custom-");

      let savedTemplate: UiReportTemplate;

      if (isNewTemplate) {
        // Create new template
        console.log("Creating new template:", {
          name: templateToSave.name,
          description: templateToSave.description,
          active: false,
          codebases:
            templateToSave.codebases?.map((cb) =>
              typeof cb === "string" ? cb : cb.object_id,
            ) || [],
        });

        savedTemplate = await createTemplate({
          name: templateToSave.name,
          description: templateToSave.description,
          active: false,
          codebases:
            templateToSave.codebases?.map((cb) =>
              typeof cb === "string" ? cb : cb.object_id,
            ) || [],
        });

        console.log("Template created successfully:", savedTemplate);
      } else {
        // Update existing template
        console.log("Updating existing template:", templateToSave.object_id);

        savedTemplate = await updateTemplate(templateToSave.object_id, {
          name: templateToSave.name,
          description: templateToSave.description,
          active: false,
          codebases:
            templateToSave.codebases?.map((cb) =>
              typeof cb === "string" ? cb : cb.object_id,
            ) || [],
        });

        console.log("Template updated successfully:", savedTemplate);
      }

      // Handle sections and rules for both new and existing templates
      if ((templateToSave.sections?.length || 0) > 0) {
        console.log(
          "Processing sections for template:",
          savedTemplate.object_id,
        );

        for (const section of templateToSave.sections) {
          // Skip sections without names
          if (!section.name.trim()) {
            console.log("Skipping section without name");
            continue;
          }

          // First, create any new rules in this section
          const ruleIds: string[] = [];

          for (const rule of section.rules) {
            if (
              rule.object_id.startsWith("rule-") &&
              rule.name.trim() &&
              rule.rule.trim()
            ) {
              try {
                console.log(
                  "Creating rule:",
                  rule.name,
                  "with content:",
                  rule.rule,
                );

                // Create new rule with all required fields
                const createdRule = await createRule({
                  name: rule.name,
                  description: rule.description || "",
                  rule: rule.rule,
                  evidence_schema: "",
                  policy_name: "",
                  policy_version: "1.0",
                  public: false,
                  scope: "",
                  section: "",
                  severity: "medium",
                  source: "custom",
                  tags: "",
                });

                console.log("Rule created with ID:", createdRule.object_id);
                ruleIds.push(createdRule.object_id);
              } catch (error) {
                console.error("Failed to create rule:", rule.name, error);
                toast.error(`Failed to create rule: ${rule.name}`);
                // Continue with other rules
              }
            } else if (!rule.object_id.startsWith("rule-")) {
              // Existing rule, use its ID
              ruleIds.push(rule.object_id);
            }
          }

          // Check if this is a new section or existing section
          const isNewSection = section.object_id.startsWith("section-");

          try {
            if (isNewSection) {
              // Create new section
              console.log("Creating new section:", {
                name: section.name,
                description: section.description || "",
                template_id: savedTemplate.object_id,
                rules: ruleIds,
              });

              await createTemplateSection({
                name: section.name,
                description: section.description || "",
                template_id: savedTemplate.object_id,
                rules: ruleIds, // Array of rule object IDs (strings)
              });

              console.log("Section created successfully:", section.name);
            } else {
              // Update existing section
              console.log("Updating existing section:", {
                sectionId: section.object_id,
                name: section.name,
                description: section.description || "",
                template_id: savedTemplate.object_id,
                rules: ruleIds,
              });

              await updateTemplateSection(section.object_id, {
                name: section.name,
                description: section.description || "",
                template_id: savedTemplate.object_id,
                rules: ruleIds, // Array of rule object IDs (strings)
              });

              console.log("Section updated successfully:", section.name);
            }
          } catch (error) {
            console.error(
              `Failed to ${isNewSection ? "create" : "update"} section:`,
              section.name,
              error,
            );
            toast.error(
              `Failed to ${isNewSection ? "create" : "update"} section: ${
                section.name
              }`,
            );
            // Continue with other sections
          }
        }
      }

      // Handle section deletions for existing templates
      if (!isNewTemplate) {
        const currentSectionIds = new Set(
          (templateToSave.sections || []).map((s) => s.object_id),
        );
        const deletedSections = originalSections.filter(
          (section) =>
            !section.object_id.startsWith("section-") && // Only consider existing sections (not temporary ones)
            !currentSectionIds.has(section.object_id),
        );

        for (const deletedSection of deletedSections) {
          try {
            console.log(
              "Deleting section:",
              deletedSection.name,
              "with ID:",
              deletedSection.object_id,
            );
            await deleteTemplateSection(deletedSection.object_id);
            console.log("Section deleted successfully:", deletedSection.name);
          } catch (error) {
            console.error(
              "Failed to delete section:",
              deletedSection.name,
              error,
            );
            toast.error(`Failed to delete section: ${deletedSection.name}`);
            // Continue with other deletions
          }
        }
      }

      toast.success("Template saved successfully!");
      onSave(savedTemplate);
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="pb-2">
                Edit Template: {editingTemplate.name}
              </CardTitle>
              <CardDescription>
                Manage sections and rules for this compliance template
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template-name" className="pb-2">
                Template Name
              </Label>
              <Input
                id="template-name"
                value={editingTemplate.name || ""}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="template-framework" className="pb-2">
                Framework
              </Label>
              <Input
                id="template-framework"
                value={editingTemplate.framework || ""}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    framework: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="template-description" className="pb-2">
              Description
            </Label>
            <Textarea
              id="template-description"
              value={editingTemplate.description || ""}
              onChange={(e) =>
                setEditingTemplate({
                  ...editingTemplate,
                  description: e.target.value,
                })
              }
              rows={3}
            />
          </div>

          {/* Codebase Selection */}
          <div>
            <Label className="pb-2">Associated Codebases</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select codebases that this template applies to
            </p>
            {loadingCodebases ? (
              <div className="text-sm text-muted-foreground">
                Loading codebases...
              </div>
            ) : (codebases?.length || 0) === 0 ? (
              <div className="text-sm text-muted-foreground">
                No codebases available
              </div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                {codebases.map((codebase) => {
                  const isSelected =
                    editingTemplate.codebases?.some(
                      (cb) =>
                        (typeof cb === "string" ? cb : cb.object_id) ===
                        codebase.object_id,
                    ) || false;

                  return (
                    <div
                      key={codebase.object_id}
                      className="flex items-center space-x-2"
                    >
                      <Label className="text-sm font-normal w-full">
                        <Checkbox
                          id={`codebase-${codebase.object_id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditingTemplate({
                                ...editingTemplate,
                                codebases: [
                                  ...(editingTemplate.codebases || []),
                                  codebase,
                                ],
                              });
                            } else {
                              setEditingTemplate({
                                ...editingTemplate,
                                codebases: (
                                  editingTemplate.codebases || []
                                ).filter(
                                  (cb) =>
                                    (typeof cb === "string"
                                      ? cb
                                      : cb.object_id) !== codebase.object_id,
                                ),
                              });
                            }
                          }}
                        />
                        <div className="font-medium">
                          {codebase.codebase_name}
                        </div>
                        {codebase.codebase_description && (
                          <div className="text-xs text-muted-foreground">
                            {codebase.codebase_description}
                          </div>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Template Sections</h3>
          <Button onClick={addSection}>
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </div>

        {(editingTemplate.sections || []).map((section) => (
          <Card key={section.object_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer flex-1"
                  onClick={() => toggleSection(section.object_id)}
                >
                  {expandedSections.has(section.object_id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {editingSection === section.object_id ? (
                    <Input
                      value={section.name || ""}
                      onChange={(e) =>
                        updateSection(section.object_id, {
                          name: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingSection(null);
                        if (e.key === "Escape") setEditingSection(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    <CardTitle className="text-base">{section.name}</CardTitle>
                  )}
                  <Badge variant="outline" className="ml-2">
                    {section.rules?.length || 0} rule
                    {(section.rules?.length || 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSection(section.object_id);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSection(section.object_id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedSections.has(section.object_id) ? (
              <CardContent className="space-y-4">
                {editingSection === section.object_id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="space-y-3"
                  >
                    <div>
                      <Label
                        htmlFor={`section-desc-${section.object_id}`}
                        className="pb-2"
                      >
                        Section Description
                      </Label>
                      <Textarea
                        id={`section-desc-${section.object_id}`}
                        value={section.description || ""}
                        onChange={(e) =>
                          updateSection(section.object_id, {
                            description: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingSection(null);
                          }
                          // Don't exit on Enter for textarea, allow multiline
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        rows={3}
                        placeholder="Enter section description..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEditingSection(null)}>
                        <Save className="mr-2 h-3 w-3" />
                        Done
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingSection(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Rules</h4>
                  <Button size="sm" onClick={() => addRule(section.object_id)}>
                    <Plus className="mr-2 h-3 w-3" />
                    Add Rule
                  </Button>
                </div>

                {(section.rules?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No rules in this section. Click &quot;Add Rule&quot; to get
                    started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(section.rules || []).map((rule) => (
                      <Card
                        key={rule.object_id}
                        className="border-l-4 border-l-blue-500"
                      >
                        <CardContent className="px-4">
                          {editingRule === rule.object_id ? (
                            <div className="space-y-3">
                              <div>
                                <Label
                                  htmlFor={`rule-name-${rule.object_id}`}
                                  className="pb-2"
                                >
                                  Rule Name
                                </Label>
                                <Input
                                  id={`rule-name-${rule.object_id}`}
                                  value={rule.name || ""}
                                  onChange={(e) =>
                                    updateRule(
                                      section.object_id,
                                      rule.object_id,
                                      { name: e.target.value },
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label
                                  htmlFor={`rule-desc-${rule.object_id}`}
                                  className="pb-2"
                                >
                                  Description
                                </Label>
                                <Textarea
                                  id={`rule-desc-${rule.object_id}`}
                                  value={rule.description || ""}
                                  onChange={(e) =>
                                    updateRule(
                                      section.object_id,
                                      rule.object_id,
                                      { description: e.target.value },
                                    )
                                  }
                                  rows={2}
                                />
                              </div>
                              <div>
                                <Label
                                  htmlFor={`rule-content-${rule.object_id}`}
                                  className="pb-2"
                                >
                                  Rule Content
                                </Label>
                                <Textarea
                                  id={`rule-content-${rule.object_id}`}
                                  value={rule.rule || ""}
                                  onChange={(e) =>
                                    updateRule(
                                      section.object_id,
                                      rule.object_id,
                                      { rule: e.target.value },
                                    )
                                  }
                                  rows={3}
                                  placeholder="Enter the actual rule that will be analyzed"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => setEditingRule(null)}
                                >
                                  <Save className="mr-2 h-3 w-3" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRule(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-start justify-between">
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() => toggleRule(rule.object_id)}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-medium">{rule.name}</h5>
                                    {expandedRules.has(rule.object_id) ? (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </div>
                                  {!expandedRules.has(rule.object_id) &&
                                    rule.rule && (
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {rule.rule}
                                      </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingRule(rule.object_id);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteRule(
                                        section.object_id,
                                        rule.object_id,
                                      );
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {expandedRules.has(rule.object_id) && (
                                <div className="mt-3 pt-3 border-t space-y-3">
                                  <div>
                                    <Label className="text-xs font-medium text-muted-foreground">
                                      Rule Content
                                    </Label>
                                    <p className="text-sm bg-muted/30 p-3 rounded text-foreground whitespace-pre-wrap">
                                      {rule.rule}
                                    </p>
                                  </div>
                                  {rule.description && (
                                    <div>
                                      <Label className="text-xs font-medium text-muted-foreground">
                                        Description
                                      </Label>
                                      <p className="text-sm">
                                        {rule.description}
                                      </p>
                                    </div>
                                  )}
                                  {rule.scope && (
                                    <div>
                                      <Label className="text-xs font-medium text-muted-foreground">
                                        Scope
                                      </Label>
                                      <p className="text-sm">{rule.scope}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            ) : (
              <CardDescription>{section.description}</CardDescription>
            )}
          </Card>
        ))}

        {(editingTemplate.sections?.length || 0) === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No Sections Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start building your template by adding sections and rules.
                </p>
                <Button onClick={addSection}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Section
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
