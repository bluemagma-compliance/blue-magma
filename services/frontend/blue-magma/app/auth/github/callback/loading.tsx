import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCw, Github } from "lucide-react";

export default function GitHubCallbackLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <CardTitle className="text-xl">Processing GitHub Login</CardTitle>
          <CardDescription>
            Please wait while we complete your GitHub authentication...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Github className="h-4 w-4" />
            <span>Connecting with GitHub</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
