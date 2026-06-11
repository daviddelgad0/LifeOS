import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">LifeOS</h1>
      <p className="text-text-secondary">
        The app shell arrives in step 3. For now, review the design system.
      </p>
      <Link href="/preview" className={buttonVariants({ size: "lg" })}>
        View design system
        <ArrowRight className="size-4" />
      </Link>
    </main>
  );
}
