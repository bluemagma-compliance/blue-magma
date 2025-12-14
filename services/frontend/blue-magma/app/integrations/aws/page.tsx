"use client";

import { useState, useEffect } from "react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  LinkIcon,
  CornerDownRight,
  CornerDownLeft,
  Trash,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AWSInstallation,
  deleteAwsInstallation,
  getAWSInstallation,
  saveRoleArn,
  startAWSInstallation,
  syncAwsInstallation,
} from "./actions";
import { awsIcon } from "../configuration";
import { useRouter } from "next/navigation";

function SetupFlow({ onCompleted }: { onCompleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [arn, setArn] = useState("");

  const setupCfnStack = async () => {
    try {
      setLoading(true);
      const rsp = await startAWSInstallation();
      window.open(rsp.install_url, "_blank")?.focus();
      setStep(2); // Move to the next step
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to open CloudFormation template";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitArn = async () => {
    const trimmedArn = arn.trim();
    if (!trimmedArn) {
      toast.error("Please input a valid ARN.");
      return;
    }
    try {
      setLoading(true);
      await saveRoleArn(trimmedArn);
      toast.success("Successfully linked AWS account!");
      onCompleted();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save Role ARN";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Step 1: Create Stack</h2>
          <p className="text-muted-foreground">
            Click the button below to create the CloudFormation stack in your
            AWS account. This will allow Blue Magma secure, read-only access to
            selected AWS services in your account for compliance monitoring.
          </p>
          <div className="flex flex-row gap-2">
            <Button onClick={setupCfnStack} size="lg" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  <span>Creating Stack...</span>
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Create Stack</span>
                </>
              )}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setStep(2)}>
              <CornerDownRight className="mr-2 h-4 w-4" />
              <span>I have already created the stack</span>
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Step 2: Input ARN</h2>
          <p className="text-muted-foreground">
            After creating the stack, go the Outputs tab of the stack in the AWS
            CloudFormation console to find the Role ARN. Copy and paste it
            below.
          </p>
          <input
            type="text"
            value={arn}
            onChange={(e) => setArn(e.target.value)}
            placeholder="Enter ARN here"
            className="w-full p-2 border rounded-md"
          />
          <div className="flex flex-row gap-2">
            <Button onClick={submitArn} size="lg" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Link AWS Account
                </>
              )}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
              <CornerDownLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageInstallation({
  installation,
  onUpdated,
}: {
  installation: AWSInstallation;
  onUpdated: (installation: AWSInstallation) => void;
}) {
  const [isLoadingRemoval, setIsLoadingRemoval] = useState(false);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const router = useRouter();

  const lastSynced = installation?.sync_time
    ? new Date(installation.sync_time).toLocaleString()
    : "never";

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to remove the AWS integration? This action cannot be undone. You will also need to delete the CloudFormation stack from your AWS account separately.`
      )
    ) {
      return;
    }
    try {
      setIsLoadingRemoval(true);
      await deleteAwsInstallation();
      toast.success("AWS installation deleted successfully!");
      router.push("/integrations");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to delete AWS installation";
      toast.error(errorMessage);
    } finally {
      setIsLoadingRemoval(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsLoadingSync(true);
      toast.info("Initiating AWS installation sync. This may take a while...");
      const updated = await syncAwsInstallation();
      toast.success("AWS installation sync completed successfully!");
      onUpdated(updated);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sync AWS installation";
      toast.error(errorMessage);
    } finally {
      setIsLoadingSync(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your AWS Integration</CardTitle>
	          <CardDescription>
	          <p>
	            {/* CloudCheck icon is not available in our lucide-react version. */}
	            Your AWS account is successfully connected to Blue Magma.
	          </p>
          <p className="mt-2 text-muted-foreground">
            Last synced: {lastSynced}
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Button
            onClick={handleSync}
            disabled={isLoadingSync}
            className="self-end"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoadingSync ? "animate-spin" : ""}`}
            />
            <span>
              {isLoadingSync ? "Syncing..." : "Sync AWS Installation"}
            </span>
          </Button>
          <Button
            variant="destructive_outline"
            onClick={handleDelete}
            disabled={isLoadingRemoval}
            className="self-end"
          >
            {isLoadingRemoval ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Deleting...
              </>
            ) : (
              <>
                <Trash className="mr-2 h-4 w-4" />
                Remove AWS Integration
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AwsIntegrationPage() {
  const [installation, setInstallation] = useState<AWSInstallation | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstallations();
  }, []);

  const loadInstallations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAWSInstallation();
      setInstallation(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load AWS installations";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading AWS integration...</span>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/integrations">← Back to Integrations</Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight flex gap-3 items-center mb-2">
              {awsIcon}
              AWS Integration
            </h1>
            <p className="text-muted-foreground">
              Connect your Amazon Web Services account to Blue Magma for
              streamlined compliance management.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {installation ? (
          <ManageInstallation
            installation={installation}
            onUpdated={setInstallation}
          />
        ) : (
          <SetupFlow onCompleted={loadInstallations} />
        )}

        {/* Integration Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>AWS Integration Benefits</CardTitle>
            <CardDescription>
              Streamline your compliance workflow with AWS integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Automatic Compliance Scanning
                </h4>
                <p className="text-sm text-muted-foreground">
                  Continuously scan your deployments for compliance issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
