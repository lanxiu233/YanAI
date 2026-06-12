"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?auth=signup");
  }, [router]);

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[#f7f3f1]">
      <LoaderCircle className="size-5 animate-spin text-rose-400" />
    </div>
  );
}
