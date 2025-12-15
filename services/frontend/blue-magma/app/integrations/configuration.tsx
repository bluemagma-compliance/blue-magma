import { Cloud, GitBranch } from "lucide-react";

interface IntegrationConfiguration {
  title: string;
  description: string;
  docsLink?: string;
  available: boolean;
  setupLink: string;
  icon: React.ReactNode;
  features: string[];
}

export const awsIcon = (
  <div className="p-2 bg-yellow-400 rounded-lg">
    <Cloud className="h-6 w-6 text-white" />
  </div>
);

export const integrations: IntegrationConfiguration[] = [
  {
    title: "GitHub",
    description:
      "Connect your GitHub repositories for automated compliance scanning",
    available: true,
    setupLink: "/integrations/github",
    docsLink: "https://docs.github.com/en/apps",
    icon: (
      <div className="p-2 bg-gray-900 rounded-lg">
        <GitBranch className="h-6 w-6 text-white" />
      </div>
    ),
    features: [
      "Automatic repository scanning",
      "Real-time webhook updates",
      "Multi-repository support",
      "Branch-based compliance tracking",
    ],
  },
  {
    title: "GitLab",
    description: "Connect GitLab repositories and CI/CD pipelines",
    available: false,
    setupLink: "/integrations/gitlab",
    docsLink: undefined,
    icon: (
      <div className="p-2 bg-orange-500 rounded-lg">
        <GitBranch className="h-6 w-6 text-white" />
      </div>
    ),
    features: [
      "GitLab repository integration",
      "CI/CD pipeline compliance",
      "Merge request scanning",
      "Issue tracking integration",
    ],
  },
  {
    title: "Bitbucket",
    description: "Integrate with Atlassian Bitbucket repositories",
    available: false,
    setupLink: "/integrations/bitbucket",
    docsLink: undefined,
    icon: (
      <div className="p-2 bg-blue-600 rounded-lg">
        <GitBranch className="h-6 w-6 text-white" />
      </div>
    ),
    features: [
      "Bitbucket repository scanning",
      "Pull request integration",
      "Atlassian ecosystem support",
      "Team collaboration features",
    ],
  },
  {
    title: "AWS",
    description: "Integrate with AWS services for compliance monitoring",
    available: true,
    setupLink: "/integrations/aws",
    docsLink: undefined,
    icon: awsIcon,
    features: [
      "Monitor AWS resources",
      "Compliance checks for S3, EC2, IAM, and more",
      "Automated alerts and reporting",
      "Integration with AWS CloudTrail",
    ],
  },
];
