import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getPublicCommitment } from "../actions";
import { PublicTrustClient } from "./public-trust-client";

export default async function PublicTrustPage({
	  searchParams,
	}: {
	  searchParams?: Promise<{ org_id?: string | string[] }>;
	}) {
	  const resolvedSearchParams = (await searchParams) ?? {};
	  const rawOrgId = resolvedSearchParams.org_id;
	  const orgId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;

  if (!orgId) {
    notFound();
  }

  const preview = await getPublicCommitment(orgId);

  if (!preview || !preview.organization) {
    notFound();
  }

  const organization = preview.organization;
  const organizationName =
    organization.organization_name || organization.name || "Your organization";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <header className="space-y-3">
          <h1 className="flex items-center text-3xl font-bold tracking-tight">
            <ShieldCheck className="mr-3 h-8 w-8 text-primary" />
            {organizationName} Trust Center
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This page explains how {organizationName} protects your data and aligns
            with leading security and privacy standards. It highlights the key
            controls we have in place and how they map to industry frameworks and
            regulations.
          </p>
          <p className="max-w-2xl text-xs text-muted-foreground">
            The information on this page is self-attested by {organizationName} and
            is provided to help you understand their security and compliance
            posture. It does not constitute a certification or audit report.
          </p>
        </header>

	        <PublicTrustClient projects={preview.projects ?? []} />
      </main>
    </div>
  );
}

