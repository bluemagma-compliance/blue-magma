import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { Ruling } from "@/types/api";
import RulingCard from "@/app/compliance-reports/report/[reportId]/components/RulingCard";

interface RuleCardProps {
  ruleId: string;
  rulings: Ruling[];
  expandedRules: Set<string>;
  toggleRule: (ruleId: string) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({
  ruleId,
  rulings,
  expandedRules,
  toggleRule,
}) => {
  return (
    <Card key={ruleId} className="border-l-4 border-l-green-500">
      <Collapsible
        open={expandedRules.has(ruleId)}
        onOpenChange={() => toggleRule(ruleId)}
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-auto">
            <div className="flex items-center gap-3 text-left">
              <BookOpen className="h-5 w-5 text-green-500" />
              <div>
                <h4 className="font-semibold">Rule: {ruleId}</h4>
                <p className="text-sm text-muted-foreground">
                  {rulings.length} ruling
                  {rulings.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {rulings.length} ruling
                {rulings.length !== 1 ? "s" : ""}
              </Badge>
              {expandedRules.has(ruleId) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <div className="space-y-3 mt-3">
            {rulings.map((ruling) => (
              <RulingCard key={ruling.object_id} ruling={ruling} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default RuleCard;
