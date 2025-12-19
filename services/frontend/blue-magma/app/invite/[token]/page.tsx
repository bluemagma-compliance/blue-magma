import { InvitePageServer } from "./invite-page-server";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <InvitePageServer token={token} />
    </main>
  );
}
