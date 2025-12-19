import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { billingService } from "@/services/billingService";

async function getOrganizationId() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID found");
  }

  return orgId;
}

export async function GET() {
  try {
    const orgId = await getOrganizationId();
    const billingData = await billingService.getOrganizationBilling(orgId);

    return NextResponse.json(billingData);
  } catch (error) {
    console.error("Error fetching organization billing:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch billing data",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const orgId = await getOrganizationId();
    const updateData = await request.json();

    const updatedData = await billingService.updateOrganizationBilling(
      orgId,
      updateData,
    );

    return NextResponse.json(updatedData);
  } catch (error) {
    console.error("Error updating organization billing:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update billing data",
      },
      { status: 500 },
    );
  }
}
