import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrganizationSignupClient } from "./organization-signup-client";

export async function OrganizationSignupServer() {
  // Check if user is already authenticated
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token");

  if (accessToken?.value) {
    redirect("/dashboard");
  }

  // Default form data that can be passed to client
  const defaultFormData = {
    firstName: "",
    lastName: "",
    email: "test@example.com", // Default test email
    password: "",
    phone: "",
  };

  return <OrganizationSignupClient defaultFormData={defaultFormData} />;
}
