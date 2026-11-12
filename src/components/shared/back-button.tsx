"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Returns to the previous page, or closes the tab when the page was opened in a new one. */
export function BackButton({ primary = false }: { primary?: boolean }) {
  const router = useRouter();
  return (
    <Button
      variant={primary ? "default" : "outline"}
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else {
          window.close();
          // Browsers only allow scripts to close tabs they opened; fall back to the home page.
          setTimeout(() => router.push("/"), 150);
        }
      }}
    >
      <ArrowLeft /> Go back
    </Button>
  );
}
