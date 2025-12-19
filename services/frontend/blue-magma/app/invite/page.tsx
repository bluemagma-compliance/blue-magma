import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function InvitePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logos/pngs/24 Black Horizontal.png"
            alt="Blue Magma"
            width={200}
            height={45}
            className="h-18 w-auto"
          />
        </div>

        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Invalid Invitation Link
          </h1>
          <p className="text-gray-600">
            This invitation link is missing a token. Please check your email for
            the correct invitation link.
          </p>
          <div className="pt-4 space-y-2">
            <Link href="/login">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Go to Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline" className="w-full">
                Create New Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
