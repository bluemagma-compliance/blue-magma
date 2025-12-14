import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ChatInterface from "./components/ChatInterface";
import { checkGraphLangHealth } from "./actions";

// Loading component
function ChatLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-primary"></div>
        <p className="text-gray-600 dark:text-muted-foreground">Loading AI Chat Assistant...</p>
      </div>
    </div>
  );
}

// Error component - Static version without interactivity
function ChatError({ error }: { error: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="text-red-600 dark:text-red-400 text-xl mb-2">⚠️</div>
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          Chat Service Unavailable
        </h2>
        <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
        <div className="text-sm text-red-600 dark:text-red-300">
          Please refresh the page to try again.
        </div>
      </div>
    </div>
  );
}

// Main chat page component
async function ChatPage() {
  // Check authentication
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const orgId = cookieStore.get("organization_id")?.value;

  if (!accessToken || !orgId) {
    redirect("/login");
  }

  try {
    // Check if GraphLang service is healthy
    const healthCheck = await checkGraphLangHealth();
    if (!healthCheck.success) {
      return <ChatError error={healthCheck.error || "Service unavailable"} />;
    }

    return (
      <ChatInterface
        organizationId={orgId}
        serviceStatus={healthCheck}
      />
    );
  } catch (error) {
    console.error("Error loading chat page:", error);
    return (
      <ChatError 
        error={error instanceof Error ? error.message : "Failed to load chat interface"} 
      />
    );
  }
}

// Exported page component with Suspense
export default function Page() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPage />
    </Suspense>
  );
}
