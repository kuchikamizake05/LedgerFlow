"use client";

import { createContext, useCallback, useContext } from "react";
import { Toaster, toast } from "sonner";

type FeedbackType = "success" | "error" | "info";
type Feedback = {
  type: FeedbackType;
  title: string;
  description?: string;
};

type FeedbackContextValue = {
  notify: (feedback: Feedback) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const notify = useCallback((feedback: Feedback) => {
    const options = {
      description: feedback.description,
      duration: feedback.type === "error" ? 8000 : 5000,
    };
    if (feedback.type === "success") toast.success(feedback.title, options);
    else if (feedback.type === "error") toast.error(feedback.title, options);
    else toast.info(feedback.title, options);
  }, []);

  return (
    <FeedbackContext.Provider value={{ notify }}>
      {children}
      <Toaster
        closeButton
        offset={{ top: "84px", right: "24px" }}
        mobileOffset={{ top: "80px", right: "16px", left: "16px" }}
        position="top-right"
        theme="dark"
        toastOptions={{ className: "ledgerflow-toast" }}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context)
    throw new Error("useFeedback must be used within FeedbackProvider");
  return context;
}
