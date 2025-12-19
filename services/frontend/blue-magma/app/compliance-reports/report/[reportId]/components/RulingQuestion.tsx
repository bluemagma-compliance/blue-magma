import React from "react";
import { Badge } from "@/components/ui/badge";
import { Question } from "@/types/api";

interface RulingQuestionProps {
  question: Question;
}

const RulingQuestion: React.FC<RulingQuestionProps> = ({ question }) => {
  return (
    <div className="border rounded-lg p-3 bg-background">
      <h6 className="font-medium text-sm mb-2">{question.question}</h6>
      <p className="text-sm text-muted-foreground mb-3">{question.answer}</p>

      {question.found_properties && question.found_properties.length > 0 && (
        <div>
          <h6 className="font-medium text-xs mb-2">Found Properties</h6>
          <div className="space-y-2">
            {question.found_properties.map((property) => (
              <div
                key={property.object_id}
                className="text-xs bg-muted rounded p-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{property.key}</span>
                  <Badge
                    variant={property.is_issue ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {property.property_type}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{property.value}</p>
                {property.is_issue && property.issue_severity && (
                  <Badge variant="destructive" className="text-xs mt-1">
                    {property.issue_severity}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RulingQuestion;
