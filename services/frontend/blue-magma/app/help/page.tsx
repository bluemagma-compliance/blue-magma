"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Help &amp; Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Look, I&apos;m still working on this. I also need help and support.</p>
          <p>
            Please email me at
            {" "}
            <a
              href="mailto:andrew@bluemagma.net"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              andrew@bluemagma.net
            </a>
            {" "}
            and I&apos;ll get back to you.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

