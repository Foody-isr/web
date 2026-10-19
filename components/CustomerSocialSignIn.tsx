"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { useI18n } from "@/lib/i18n";
import { fetchCustomerSocialProviders, loginCustomerSocial, startCustomerSocialSignIn } from "@/services/api";
import { useGuestAccount } from "@/store/useGuestAccount";

type Provider = "facebook" | "apple";
type Flow = Awaited<ReturnType<typeof startCustomerSocialSignIn>>;
type FacebookResponse = { authResponse?: { accessToken?: string } };
type AppleResponse = { authorization: { code: string; state: string }; user?: { name?: { firstName?: string; lastName?: string } } };
declare global {
  interface Window {
    FB?: { init: (options: { appId: string; version: string; cookie: boolean; xfbml: boolean }) => void; login: (callback: (response: FacebookResponse) => void, options: { scope: string }) => void };
    AppleID?: { auth: { init: (options: { clientId: string; scope: string; redirectURI: string; state: string; nonce: string; usePopup: boolean }) => void; signIn: () => Promise<AppleResponse> } };
  }
}

const scripts: Partial<Record<Provider, Promise<void>>> = {};
const flows: Partial<Record<Provider, Promise<Flow>>> = {};
const refreshEvent = "foody-social-flow-consumed";

function loadSDK(provider: Provider): Promise<void> {
  if (provider === "facebook" ? !!window.FB : !!window.AppleID) return Promise.resolve();
  if (scripts[provider]) return scripts[provider]!;
  scripts[provider] = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { script.remove(); delete scripts[provider]; reject(new Error("provider SDK unavailable")); };
    const timer = window.setTimeout(fail, 15_000);
    script.src = provider === "facebook" ? "https://connect.facebook.net/en_US/sdk.js" : "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => { window.clearTimeout(timer); if (provider === "facebook" ? !!window.FB : !!window.AppleID) resolve(); else fail(); };
    script.onerror = () => { window.clearTimeout(timer); fail(); };
    document.head.append(script);
  });
  return scripts[provider]!;
}

async function prepareFlow(provider: Provider): Promise<Flow> {
  if (!flows[provider]) flows[provider] = startCustomerSocialSignIn(provider).then(flow => ({ ...flow, createdAt: Date.now() })).catch(error => { delete flows[provider]; throw error; });
  const flow = await flows[provider]!;
  if (Date.now() - flow.createdAt >= 9 * 60_000) { delete flows[provider]; return prepareFlow(provider); }
  return flow;
}

/** Consistent social choices shared by entry sign-in and inline checkout enrollment. */
export function CustomerSocialSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const { t } = useI18n();
  const providers = useQuery({ queryKey: ["customer-social-providers"], queryFn: fetchCustomerSocialProviders, staleTime: 5 * 60_000, retry: false });
  const [ready, setReady] = useState<Partial<Record<Provider, Flow>>>({});
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  const onSignedInRef = useRef(onSignedIn); onSignedInRef.current = onSignedIn;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    const prepare = () => {
      setReady({});
      for (const provider of ["facebook", "apple"] as const) {
        if (!providers.data?.[provider]) continue;
        void Promise.all([loadSDK(provider), prepareFlow(provider)]).then(([, flow]) => {
          if (cancelled) return;
          if (provider === "facebook" && providers.data?.facebook) window.FB?.init({ appId: providers.data.facebook.app_id, version: providers.data.facebook.api_version, cookie: false, xfbml: false });
          setReady(previous => ({ ...previous, [provider]: flow }));
        }).catch(() => { if (!cancelled) setError(true); });
      }
    };
    prepare(); window.addEventListener(refreshEvent, prepare);
    return () => { cancelled = true; window.removeEventListener(refreshEvent, prepare); };
  }, [providers.data, retry]);

  async function finish(provider: Provider, input: { state: string; access_token?: string; code?: string; name?: string }) {
    try {
      const result = await loginCustomerSocial(provider, input);
      useGuestAccount.getState().setSession(result.account);
      if (mounted.current) onSignedInRef.current?.();
    } catch { if (mounted.current) setError(true);
    } finally {
      delete flows[provider]; window.dispatchEvent(new Event(refreshEvent));
      if (mounted.current) setBusy(null);
    }
  }

  function signIn(provider: Provider) {
    const flow = ready[provider];
    if (!flow || busy) return;
    if (Date.now() - flow.createdAt >= 9 * 60_000) { delete flows[provider]; setRetry(v => v + 1); return; }
    setError(false); setBusy(provider);
    if (provider === "facebook") {
      // Call synchronously within the click so mobile browsers permit the popup.
      try { window.FB!.login(response => {
        const token = response.authResponse?.accessToken;
        if (!token) { if (mounted.current) setBusy(null); return; }
        void finish(provider, { state: flow.state, access_token: token });
      }, { scope: "public_profile,email" }); } catch { setBusy(null); setError(true); }
    } else {
      const settings = providers.data!.apple!;
      try {
        window.AppleID!.auth.init({ clientId: settings.client_id, redirectURI: settings.redirect_uri, scope: "name email", state: flow.state, nonce: flow.nonce, usePopup: true });
        void window.AppleID!.auth.signIn().then(response => {
          if (response.authorization.state !== flow.state) throw new Error("invalid provider state");
          const name = [response.user?.name?.firstName, response.user?.name?.lastName].filter(Boolean).join(" ");
          return finish(provider, { state: flow.state, code: response.authorization.code, name });
        }).catch((caught: { error?: string }) => {
          if (!mounted.current) return;
          setBusy(null);
          if (caught?.error !== "popup_closed_by_user" && caught?.error !== "user_cancelled_authorize") setError(true);
        });
      } catch { setBusy(null); setError(true); }
    }
  }

  return <div className="w-full space-y-3" data-customer-social-sign-in>
    <div inert={!!busy || undefined}><GoogleSignIn onSignedIn={onSignedIn} /></div>
    {(["facebook", "apple"] as const).filter(provider => !!providers.data?.[provider]).map(provider => <button
      key={provider} type="button" data-social-provider={provider} onClick={() => signIn(provider)} disabled={!ready[provider] || !!busy}
      className="relative flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-[var(--divider)] bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:opacity-50"
    >
      {provider === "facebook" ? <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.71 4.53-4.71 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.88v2.28h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" /></svg> : <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.6 7.59 9.1 7.31c1.33.07 2.25.77 3.03.83 1.17-.24 2.29-.96 3.54-.87 1.5.12 2.63.72 3.38 1.8-3.1 1.87-2.36 5.96.48 7.11-.57 1.5-1.31 2.99-2.49 4.11l.01-.01ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z" /></svg>}
      <span>{t(busy === provider ? "loading" : provider === "facebook" ? "accountContinueFacebook" : "accountContinueApple")}</span>
    </button>)}
    {(error || providers.isError) && <p role="status" className="text-center text-xs leading-relaxed text-[var(--text-muted)]">{t("accountSocialUnavailable")} <button type="button" className="min-h-11 underline underline-offset-2" onClick={() => { setError(false); setRetry(v => v + 1); if (providers.isError) void providers.refetch(); }}>{t("retry")}</button></p>}
  </div>;
}
