import React from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { ReportSection, Ruling } from "@/types/api";
import RuleCard from "@/app/compliance-reports/report/[reportId]/components/RuleCard";

interface ReportSectionProps {
  section: ReportSection;
  expandedSections: Set<string>;
  toggleSection: (sectionId: string) => void;
  expandedRules: Set<string>;
  toggleRule: (ruleId: string) => void;
}

const ReportSectionComponent: React.FC<ReportSectionProps> = ({
  section,
  expandedSections,
  toggleSection,
  expandedRules,
  toggleRule,
}) => {
  const ruleIdToRuling = Object.entries(
    (section.rulings ?? []).reduce(
      (acc, ruling) => {
        const ruleId = ruling.rule_id || "unknown";
        if (!acc[ruleId]) {
          acc[ruleId] = [];
        }
        acc[ruleId].push(ruling);
        return acc;
      },
      {} as Record<string, Ruling[]>
    )
  );
  return (
    <Collapsible
      key={section.object_id}
      open={expandedSections.has(section.object_id)}
      onOpenChange={() => toggleSection(section.object_id)}
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto">
          <div className="flex items-center gap-3 text-left">
            <Shield className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold">{section.name}</h3>
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {section.rulings
                ? Object.keys(
                    section.rulings.reduce(
                      (acc, ruling) => {
                        const ruleId = ruling.rule_id || "unknown";
                        acc[ruleId] = true;
                        return acc;
                      },
                      {} as Record<string, boolean>
                    )
                  ).length
                : 0}{" "}
              rules
            </Badge>
            {expandedSections.has(section.object_id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        {section.rulings && section.rulings.length > 0 ? (
          <div className="space-y-4 mt-4">
            {ruleIdToRuling.map(([ruleId, rulings]) => (
              <RuleCard
                key={ruleId}
                ruleId={ruleId}
                rulings={rulings}
                expandedRules={expandedRules}
                toggleRule={toggleRule}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No rulings available for this section</p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ReportSectionComponent;
