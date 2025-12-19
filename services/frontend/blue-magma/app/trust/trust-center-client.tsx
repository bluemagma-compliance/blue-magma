"use client";

import { useState } from "react";
import Image from "next/image";
import {
	  ShieldCheck,
	  Loader2,
	  Link as LinkIcon,
	  ExternalLink,
	  Copy,
	} from "lucide-react";
import {
	  Card,
	  CardContent,
	  CardHeader,
	  CardTitle,
	  CardDescription,
	} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
	  import {
	    Accordion,
	    AccordionContent,
	    AccordionItem,
	    AccordionTrigger,
	  } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  updateShareCommitment,
  type CommitmentResponse,
  type CommitmentProjectResponse,
  type CommitmentControlResponse,
} from "./actions";

interface TrustCenterClientProps {
  initialPreview: CommitmentResponse | null;
}

export function TrustCenterClient({ initialPreview }: TrustCenterClientProps) {
	  const [preview, setPreview] = useState<CommitmentResponse | null>(initialPreview);
	  const [isToggling, setIsToggling] = useState(false);
	  const [search, setSearch] = useState("");

  const handleToggleShareCommitment = async () => {
    if (!preview?.organization) return;

    const nextEnabled = !preview.organization.share_commitment;
    setIsToggling(true);

    try {
      const result = await updateShareCommitment(nextEnabled);

      if (!result.success) {
        toast.error(result.error || "Failed to update shareable link");
        return;
      }

      setPreview((current) =>
        current
          ? {
              ...current,
              organization: {
                ...current.organization,
                share_commitment: nextEnabled,
              },
            }
          : current,
      );

      toast.success(
        nextEnabled
          ? "Shareable link enabled. Your public trust page will be available to customers."
          : "Shareable link disabled. Your public trust page is now offline.",
      );
    } catch (err) {
      console.error("Error updating share commitment:", err);
      toast.error("An unexpected error occurred while updating the shareable link.");
    } finally {
      setIsToggling(false);
    }
  };

  const renderProjectStatusBadge = (status: string) => {
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
      <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground">
        {status}
      </Badge>
    );
  };

  const renderControlStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
	
	    const friendlyLabel = (() => {
	      switch (normalized) {
	        case "in_progress":
	        case "in-progress":
	          return "In progress";
	        case "implemented":
	          return "Implemented";
	        case "compliant":
	          return "Compliant";
	        case "not_started":
	        case "not-started":
	          return "Not started";
	        case "planned":
	          return "Planned";
	        case "not_applicable":
	        case "not-applicable":
	          return "Not applicable";
	        default:
	          return status;
	      }
	    })();
    if (normalized === "implemented" || normalized === "compliant") {
      return (
	        <Badge
	          variant="outline"
	          className="border-green-500 text-green-700 text-[11px] font-medium px-2 py-0.5"
	        >
	          {friendlyLabel}
        </Badge>
      );
    }
    if (normalized === "in-progress" || normalized === "partial") {
      return (
	        <Badge
	          variant="outline"
	          className="border-yellow-500 text-yellow-700 text-[11px] font-medium px-2 py-0.5"
	        >
	          {friendlyLabel}
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
	        className="border-muted-foreground/50 text-muted-foreground text-[11px] font-medium px-2 py-0.5"
      >
	        {friendlyLabel}
      </Badge>
    );
  };

  const renderControl = (control: CommitmentControlResponse) => {
    const uniqueFrameworks = Array.from(new Set(control.frameworks ?? []));

    return (
      <div
        key={`${control.scf_id}-${control.title}`}
        className="flex flex-col gap-1 rounded-md border p-3 bg-background/60"
      >
	        <div className="min-w-0 flex-1">
	          <div className="flex items-center gap-2">
	            <p className="font-medium text-sm leading-snug">{control.title}</p>
	            {control.scf_id && (
	              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
	                {control.scf_id}
	              </Badge>
	            )}
	          </div>
	          <div className="mt-1 flex items-center gap-2 text-xs">
	            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
	              Status
	            </span>
	            {renderControlStatusBadge(control.status)}
	          </div>
	          {control.description && (
	            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
	              {control.description}
	            </p>
	          )}
	        </div>

	        <div className="mt-2 flex flex-wrap gap-1">
	          {uniqueFrameworks.map((fw) => (
	            <Badge
	              key={fw}
	              variant="outline"
	              className="text-[10px] uppercase tracking-wide bg-muted/40"
	            >
	              {fw}
	            </Badge>
	          ))}
	          {control.framework_mappings?.map((mapping) => {
	            if (!mapping.external_ids || mapping.external_ids.length === 0) {
	              return null;
	            }
	            const joined = mapping.external_ids.join(", ");
	            return (
	              <Badge
	                key={`${mapping.framework}-${joined}`}
	                variant="outline"
	                className="text-[10px] uppercase tracking-wide bg-muted/40"
	              >
	                {mapping.framework}: {joined}
	              </Badge>
	            );
	          })}
	        </div>
      </div>
    );
  };

  const renderProject = (project: CommitmentProjectResponse) => {
    const uniqueFrameworks = Array.from(new Set(project.frameworks ?? []));
    const mappedControlsCount = project.controls?.length ?? 0;
    const frameworkCount = uniqueFrameworks.length;

    return (
      <AccordionItem key={project.object_id} value={project.object_id}>
        <Card className="w-full">
          <CardHeader className="p-0">
            <AccordionTrigger className="px-4">
              <div className="flex w-full items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base mb-1 truncate">
                    {project.name}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {mappedControlsCount} control
                      {mappedControlsCount === 1 ? "" : "s"} mapped
                    </span>
                    {frameworkCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true">&bull;</span>
                        <span>
                          {frameworkCount} framework
                          {frameworkCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    )}
                  </div>
                  {frameworkCount > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Selected controls map to the following frameworks and regulations:
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {uniqueFrameworks.map((fw) => (
                      <Badge
                        key={fw}
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide bg-muted/40"
                      >
                        {fw}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-start">
                  {renderProjectStatusBadge(project.status)}
                </div>
              </div>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent>
            <CardContent className="space-y-3 pt-0 pb-4">
              {project.controls && project.controls.length > 0 ? (
                <div className="space-y-2">
                  {project.controls.map((control) => renderControl(control))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No mapped controls yet for this project.
                </p>
              )}
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    );
  };

	  if (!preview) {
	    return (
	      <div className="w-full h-full p-4 md:p-8 space-y-8">
	        <div className="flex items-center justify-between">
	          <div>
	            <h1 className="text-3xl font-bold tracking-tight flex items-center">
	              <ShieldCheck className="mr-3 h-8 w-8 text-primary" />
	              Trust Center
	            </h1>
	            <p className="text-muted-foreground mt-2 max-w-2xl">
	              This page explains how your organization protects customer data and
	              aligns with leading security and privacy standards. It highlights
	              key controls and how they map to industry frameworks and
	              regulations.
	            </p>
	          </div>
	        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No trust data available yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t find any projects or controls to populate your trust
              preview. Once you have active projects with mapped controls, this
              page will show a preview of your public trust commitments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

		  const organization = preview.organization;
		  const organizationName =
		    organization.organization_name || organization.name || "Your organization";
		  const shareEnabled = !!organization.share_commitment;
		  const orgId = organization.object_id;
		  const publicPath = `/trust/public?org_id=${encodeURIComponent(orgId)}`;
		  const origin =
		    typeof window !== "undefined" && window.location?.origin
		      ? window.location.origin
		      : "";
		  const publicUrl = origin ? `${origin}${publicPath}` : publicPath;
		  const normalizedQuery = search.trim().toLowerCase();
		  const allProjects = preview.projects ?? [];
		  const filteredProjects = !normalizedQuery
		    ? allProjects
		    : allProjects
		        .map((project) => {
		          const controls = project.controls ?? [];
		          const matchingControls = controls.filter((control) =>
		            control.title.toLowerCase().includes(normalizedQuery),
		          );
		          return { ...project, controls: matchingControls };
		        })
		        .filter((project) => project.controls && project.controls.length > 0);
		  const hasAnyProjects = allProjects.length > 0;
		  const hasMatches = filteredProjects.length > 0;

		  const handleCopyPublicLink = async () => {
		    try {
		      await navigator.clipboard.writeText(publicUrl);
		      toast.success("Public trust page link copied to clipboard.");
		    } catch (error) {
		      console.error("Failed to copy public trust page link:", error);
		      toast.error(
		        "Unable to copy the link automatically. You can copy it from your browser.",
		      );
		    }
		  };

		  return (
	    <div className="w-full h-full p-4 md:p-8 space-y-8">
	      {/* Header */}
	      <div className="flex items-center justify-between flex-wrap gap-4">
	        <div>
	          <h1 className="text-3xl font-bold tracking-tight flex items-center">
	            <ShieldCheck className="mr-3 h-8 w-8 text-primary" />
	            {organizationName} Trust Center
	          </h1>
	          <p className="text-muted-foreground mt-2 max-w-2xl">
	            This page explains how {organizationName} protects your data and
	            aligns with leading security and privacy standards. It highlights
	            the key controls we have in place and how they map to industry
	            frameworks and regulations.
	          </p>
	        </div>
	      </div>

	      {/* Preview banner with toggle */}
      <Card className="border-yellow-300 bg-yellow-50/70 dark:bg-yellow-950/40">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <Badge className="bg-yellow-500 text-yellow-950 text-xs uppercase tracking-wide">
              Preview only
            </Badge>
            <div>
              <p className="text-sm font-medium">
                You are viewing a private preview of your public trust page.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Customers cannot see this page until you enable the shareable
                link below.
              </p>
            </div>
          </div>
	          <div className="flex flex-col items-start md:items-end gap-1">
	            <Button
	              size="sm"
	              variant={shareEnabled ? "outline" : "default"}
	              onClick={handleToggleShareCommitment}
	              disabled={isToggling}
	            >
	              {isToggling ? (
	                <>
	                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                  Updating...
	                </>
	              ) : (
	                <>
	                  <LinkIcon className="mr-2 h-4 w-4" />
	                  {shareEnabled ? "Disable shareable link" : "Enable shareable link"}
	                </>
	              )}
	            </Button>
	            <p className="text-xs text-muted-foreground">
	              Current status: {shareEnabled ? "Enabled" : "Disabled"}
	            </p>
		            {shareEnabled && (
		              <div className="mt-1 flex flex-wrap items-center gap-2">
		                <Button size="sm" variant="ghost" asChild>
		                  <a href={publicUrl} target="_blank" rel="noreferrer">
		                    <ExternalLink className="mr-2 h-4 w-4" />
		                    View public page
		                  </a>
		                </Button>
		                <Button
		                  size="sm"
		                  variant="ghost"
		                  onClick={handleCopyPublicLink}
		                >
		                  <Copy className="mr-2 h-4 w-4" />
		                  Copy link
		                </Button>
		                {publicUrl && (
		                  <span className="text-[11px] text-muted-foreground break-all">
		                    {publicUrl}
		                  </span>
		                )}
		              </div>
		            )}
	          </div>
        </CardContent>
      </Card>

	      {/* Organization summary card removed as redundant after moving
	          organization name into the main Trust Center header. */}

		      {/* Customer-facing security & compliance commitment + projects/controls */}
		      <div className="space-y-4 max-w-5xl mx-auto w-full">
		        <div className="space-y-2">
		          <h2 className="text-lg font-semibold">Security &amp; compliance commitment</h2>
		          <p className="text-xs text-muted-foreground max-w-3xl">
		            At {organizationName}, we are committed to protecting your data and
		            operating in line with leading security, privacy, and regulatory
		            standards. The information on this page is a self-attested overview
		            of our controls and practices, and is not a formal certification or
		            third-party assessment.
		          </p>
		        </div>

		        <div className="mt-3 flex justify-end pt-2 border-t border-muted/40">
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

		        <div className="space-y-2">
		          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		            <h3 className="text-sm font-medium text-muted-foreground">
		              Projects &amp; controls
		            </h3>
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
		                {filteredProjects.map((project) => renderProject(project))}
		              </Accordion>
		            ) : (
		              <Card className="border-dashed">
		                <CardContent className="py-6">
		                  <p className="text-sm text-muted-foreground">
		                    No controls match your search yet. Try a different title or
		                    clear the search to see all projects and controls.
		                  </p>
		                </CardContent>
		              </Card>
		            )
		          ) : (
		            <Card className="border-dashed">
		              <CardContent className="py-6">
		                <p className="text-sm text-muted-foreground">
		                  We didn&apos;t find any eligible projects to include in your
		                  trust preview yet. Once you have active projects with mapped
		                  controls, they will appear here.
		                </p>
		              </CardContent>
		            </Card>
		          )}
		        </div>
		      </div>
	    </div>
	  );
	}
