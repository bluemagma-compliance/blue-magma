import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InvitePageClient } from "./invite-page-client";
import { validateInvitationAction } from "@/app/invite/actions";

interface InvitePageServerProps {
  token: string;
}

export async function InvitePageServer({ token }: InvitePageServerProps) {
  // Check if user is already authenticated
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token");

  if (accessToken?.value) {
    redirect("/dashboard");
  }

  // Validate the invitation token
  let invitationData = null;
  let error = null;

  try {
    const validation = await validateInvitationAction(token);
    if (validation.valid) {
      invitationData = validation;
    } else {
      error = validation.message || "Invalid or expired invitation";
    }
  } catch (err) {
    console.error("Error validating invitation:", err);
    error = "Failed to validate invitation. Please try again.";
  }

  return (
    <InvitePageClient
      token={token}
      invitationData={invitationData}
      error={error}
    />
  );
}
