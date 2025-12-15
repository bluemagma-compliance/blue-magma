"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import type {
  CommitmentControlResponse,
  CommitmentProjectResponse,
} from "../actions";

function renderProjectStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "audit-ready") {
    return (
      <Badge variant="outline" className="border-green-500 text-green-700">
        {status}
      </Badge>
    );
  }
  if (normalized === "on-hold" || normalized === "paused") {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
        {status}
      </Badge>
    );
  }
  if (normalized === "completed") {
    return (
      <Badge variant="outline" className="border-blue-500 text-blue-700">
        {status}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/50 text-muted-foreground"
    >
      {status}
    </Badge>
  );
}

function renderControlStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  let label = status;
  if (normalized === "in_progress") label = "In progress";
  if (normalized === "implemented") label = "Implemented";
  if (normalized === "not_applicable") label = "Not applicable";
  if (normalized === "implemented" || normalized === "compliant") {
    return (
      <Badge variant="outline" className="border-green-500 text-green-700">
        {label}
      </Badge>
    );
  }
  if (normalized === "in_progress" || normalized === "partial") {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
        {label}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/50 text-muted-foreground"
    >
      {label}
    </Badge>
  );
}

function Control({ control }: { control: CommitmentControlResponse }) {
  const uniqueFrameworks = Array.from(new Set(control.frameworks || []));
  return (
    <Card className="border-muted/60 bg-background/60 shadow-none">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-medium leading-snug">
              {control.title}
            </CardTitle>
            {control.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                {control.description}
              </p>
            )}
          </div>
          {uniqueFrameworks.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {uniqueFrameworks.map((fw) => (
                <Badge
                  key={fw}
                  variant="outline"
                  className="border-muted-foreground/40 bg-muted/40 text-[10px] font-medium uppercase tracking-wide"
                >
                  {fw}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          {renderControlStatusBadge(control.status)}
        </div>
      </CardHeader>
      {control.framework_mappings && control.framework_mappings.length > 0 && (
        <CardContent className="pt-2">
          <div className="flex flex-wrap gap-1">
            {control.framework_mappings.map((mapping) => {
              if (!mapping.external_ids || mapping.external_ids.length === 0)
                return null;
              const joined = mapping.external_ids.join(", ");
              return (
                <Badge
                  key={`${mapping.framework}-${joined}`}
                  variant="outline"
                  className="border-muted-foreground/40 bg-muted/30 text-[11px]"
                >
                  {mapping.framework}: {joined}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface PublicTrustClientProps {
  projects: CommitmentProjectResponse[];
}

export function PublicTrustClient({ projects }: PublicTrustClientProps) {
  const [search, setSearch] = useState("");
  const { filteredProjects, hasAnyProjects, hasMatches } = useMemo(() => {
    const allProjects = projects ?? [];
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) {
      return {
        filteredProjects: allProjects,
        hasAnyProjects: allProjects.length > 0,
        hasMatches: allProjects.length > 0,
      };
    }
    const filtered = allProjects
      .map((project) => {
        const controls = project.controls ?? [];
        const matchingControls = controls.filter((control) =>
          control.title.toLowerCase().includes(normalizedQuery),
        );
        return { ...project, controls: matchingControls };
      })
      .filter((project) => project.controls && project.controls.length > 0);
    return {
      filteredProjects: filtered,
      hasAnyProjects: allProjects.length > 0,
      hasMatches: filtered.length > 0,
    };
  }, [projects, search]);

	  return (
	    <section aria-labelledby="projects-controls-heading" className="space-y-3">
	      <div className="mt-1 flex justify-end pt-2 border-t border-muted/40">
	        <a
	          href="https://www.trybluemagma.com"
	          target="_blank"
	          rel="noreferrer"
	          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
	        >
	          <Image
	            src="/logos/pngs/24 Black Horizontal.png"
	            alt="Blue Magma logo"
	            width={80}
	            height={16}
	          />
	          <span>Powered by Blue Magma</span>
	        </a>
	      </div>

	      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	        <h2
	          id="projects-controls-heading"
	          className="text-sm font-medium text-muted-foreground"
	        >
	          Projects &amp; controls
	        </h2>
	        <Input
	          type="search"
	          value={search}
	          onChange={(event) => setSearch(event.target.value)}
	          placeholder="Search controls by title"
	          className="h-8 w-full max-w-xs text-xs"
	        />
	      </div>

      {hasAnyProjects ? (
        hasMatches ? (
          <Accordion
            type="multiple"
            defaultValue={filteredProjects.map((project) => project.object_id)}
            className="w-full space-y-3"
          >
            {filteredProjects.map((project) => (
              <AccordionItem
                key={project.object_id}
                value={project.object_id}
                className="border rounded-lg bg-background/80"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="space-y-1 text-left">
                      <p className="text-sm font-medium leading-none">
                        {project.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="text-[10px] uppercase tracking-wide">
                          Status
                        </span>
                        {renderProjectStatusBadge(project.status)}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="mt-3 space-y-3">
                    {(project.controls ?? []).map((control) => (
                      <Control key={control.title} control={control} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Card className="border-dashed bg-muted/40">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No controls match your search yet. Try a different title or clear the
              search to see all projects and controls.
            </CardContent>
          </Card>
        )
	      ) : (
	        <Card className="border-dashed bg-muted/40">
	          <CardContent className="py-8 text-center text-sm text-muted-foreground">
	            No projects or controls are currently available to display.
	          </CardContent>
	        </Card>
	      )}
    </section>
  );
}

