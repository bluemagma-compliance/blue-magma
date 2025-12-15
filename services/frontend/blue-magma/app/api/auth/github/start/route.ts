import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/config/api";
import type {
  GitHubOAuthStartRequest,
  GitHubOAuthStartResponse,
} from "@/types/github-auth";

export async function POST(request: NextRequest) {
  try {
    const body: GitHubOAuthStartRequest = await request.json();
    const { action, return_url } = body;

    // Validate required fields
    if (!action || !return_url) {
      return NextResponse.json(
        { error: "Action and return_url are required" },
        { status: 400 },
      );
    }

    // Validate action type
    if (!["login", "link"].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "login" or "link"' },
        { status: 400 },
      );
    }

    // Call backend start endpoint
    const response = await fetch(`${API_BASE}/auth/github/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        return_url,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GitHub OAuth start failed:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to start GitHub OAuth" },
        { status: response.status },
      );
    }

    const data: GitHubOAuthStartResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GitHub OAuth start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
