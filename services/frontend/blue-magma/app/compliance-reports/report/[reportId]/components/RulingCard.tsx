import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ruling } from "@/types/api";
import RulingQuestion from "@/app/compliance-reports/report/[reportId]/components/RulingQuestion";

interface RulingCardProps {
  ruling: Ruling;
}

const RulingCard: React.FC<RulingCardProps> = ({ ruling }) => {
  return (
    <Card
      key={ruling.object_id}
      className="border-l-4 border-l-blue-500 bg-muted/30"
    >
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ruling.status || "pending"}</Badge>
              {ruling.decision && (
                <Badge
                  variant={
                    ruling.decision === "NON_COMPLIANT"
                      ? "destructive"
                      : ruling.decision === "COMPLIANT"
                        ? "default"
                        : "secondary"
                  }
                >
                  {ruling.decision}
                </Badge>
              )}
              {ruling.level && (
                <Badge
                  variant={
                    ruling.level === "HIGH" || ruling.level === "CRITICAL"
                      ? "destructive"
                      : ruling.level === "MEDIUM"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {ruling.level}
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              Ruling ID: {ruling.object_id}
            </span>
          </div>

          {ruling.reasoning && ruling.reasoning !== "pending" && (
            <div>
              <h5 className="font-medium mb-2">Reasoning</h5>
              <p className="text-sm text-muted-foreground">
                {ruling.reasoning}
              </p>
            </div>
          )}

          {ruling.questions && ruling.questions.length > 0 && (
            <div>
              <h5 className="font-medium mb-2">Analysis Questions</h5>
              <div className="space-y-3">
                {ruling.questions.map((question) => (
                  <RulingQuestion
                    key={question.object_id}
                    question={question}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RulingCard;
