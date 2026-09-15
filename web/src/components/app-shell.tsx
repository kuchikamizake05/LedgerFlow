"use client";

import { usePathname } from "next/navigation";
import { FeedbackProvider } from "@/components/feedback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Workspace } from "@/components/workspace";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth/");

  return (
    <TooltipProvider delay={350}>
      <FeedbackProvider>{isAuthRoute ? children : <Workspace>{children}</Workspace>}</FeedbackProvider>
    </TooltipProvider>
  );
}
