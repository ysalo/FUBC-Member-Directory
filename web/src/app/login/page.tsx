import { Suspense } from "react";
import LoginClient from "@/components/login-client";
import { getLocale } from "@/lib/locale";

export default async function LoginPage() {
  const locale = await getLocale();
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <LoginClient locale={locale} />
    </Suspense>
  );
}
