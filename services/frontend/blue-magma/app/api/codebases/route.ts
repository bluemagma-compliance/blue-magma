import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_BASE } from "@/config/api";

// Helper function to get auth headers
async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    throw new Error("No access token available");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// Helper function to get organization ID
async function getOrganizationId(): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID available");
  }

  return orgId;
}

export async function GET() {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      headers,
      cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint doesn't exist yet, return empty array
        return NextResponse.json([]);
      }
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Failed to fetch codebases: ${response.status} - ${errorData.error || "Unknown error"}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Ensure we always return an array
    if (!Array.isArray(data)) {
      console.warn("API returned non-array data for codebases:", data);
      return NextResponse.json([]);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching codebases:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      codebase_name,
      codebase_repo_url,
      codebase_description,
      codebase_type,
    } = body;

    console.log("Received codebase creation request:", body);

    // Validate that codebase_type is provided
    if (!codebase_type || codebase_type.trim() === "") {
      return NextResponse.json(
        { error: "Codebase type is required" },
        { status: 400 },
      );
    }

    // Validate that codebase_type is one of the allowed types
    const allowedTypes = [
      "frontend",
      "backend",
      "application",
      "infrastructure",
    ];
    if (!allowedTypes.includes(codebase_type.toLowerCase())) {
      return NextResponse.json(
        {
          error:
            "Invalid codebase type. Must be one of: Frontend, Backend, Application, Infrastructure",
        },
        { status: 400 },
      );
    }

    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const backendBody = {
      codebase_name,
      codebase_repo_url,
      codebase_description,
      codebase_type: codebase_type.trim(),
    };

    console.log("Sending to backend:", backendBody);

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      method: "POST",
      headers,
      body: JSON.stringify(backendBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Failed to create codebase: ${response.status} - ${errorData.error || "Unknown error"}`,
        },
        { status: response.status },
      );
    }

    const result = await response.json();

    // Revalidate the codebases page to show the new codebase
    revalidatePath("/codebases");

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating codebase:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const codebaseId = url.searchParams.get("codebaseId");

    if (!codebaseId) {
      return NextResponse.json(
        { error: "Codebase ID is required" },
        { status: 400 },
      );
    }

    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    console.log(`Deleting codebase ${codebaseId} for organization ${orgId}`);

    const response = await fetch(
      `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Failed to delete codebase: ${response.status} - ${errorData.error || "Unknown error"}`,
        },
        { status: response.status },
      );
    }

    // Revalidate the codebases page to reflect the deletion
    revalidatePath("/codebases");
    revalidatePath("/dashboard");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting codebase:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
