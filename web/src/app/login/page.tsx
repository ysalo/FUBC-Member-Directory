import { Suspense } from "react";
import LoginClient from "@/components/login-client";
import { getLocale } from "@/lib/locale";
import AppLoading from "@/components/app-loading";

export default async function LoginPage() {
  const locale = await getLocale();
  return (
    <Suspense fallback={<AppLoading layout="login" />}>
      <LoginClient locale={locale} />
    </Suspense>
  );
}
