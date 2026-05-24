import { Suspense } from "react";
import OnboardingWizard from "@/app/components/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingWizard />
    </Suspense>
  );
}
