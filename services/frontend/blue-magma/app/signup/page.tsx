import { OrganizationSignupServer } from "@/app/signup/organization-signup-server";

export default function OrganizationSignupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <OrganizationSignupServer />
    </main>
  );
}
