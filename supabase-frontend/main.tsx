import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { StrictMode, useEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import PayrollApp from "../app/payroll-app";
import "../app/globals.css";
import "./login.css";
import "./live-enhancements";

type JoyPayrollConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  apiUrl?: string;
};

declare global {
  interface Window {
    JOY_PAYROLL_CONFIG?: JoyPayrollConfig;
  }
}

function validConfiguration(value: unknown): value is JoyPayrollConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<JoyPayrollConfig>;
  if (
    typeof config.supabaseUrl !== "string" ||
    typeof config.supabasePublishableKey !== "string" ||
    config.supabaseUrl.includes("YOUR_PROJECT_REF") ||
    config.supabasePublishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")
  ) return false;
  try {
    const url = new URL(config.supabaseUrl);
    return url.protocol === "https:" && config.supabasePublishableKey.length > 20;
  } catch { return false; }
}

function SetupRequired() {
  return <main className="joy-login-page"><section className="joy-login-card joy-setup-card"><Brand /><h1>Finish your Supabase connection</h1><p>Enter the Supabase project URL and publishable key in the deployed <strong>config.js</strong> file.</p><ol><li>Supabase → Project Settings → API Keys.</li><li>Copy the Project URL and the publishable key.</li><li>Edit config.js in the deployed payroll website.</li><li>Save the file and refresh this page.</li></ol><aside>Never place a secret key, service-role key, SMTP password, database password, or employee data in config.js.</aside></section></main>;
}

function Brand() {
  return <div className="joy-login-brand"><span>J</span><div><strong>JOY</strong><small>Corporate Solutions · Payroll</small></div></div>;
}

function LoginScreen({ supabase, recovery, onOtpVerified, onRecoveryComplete }: { supabase: SupabaseClient; recovery: boolean; onOtpVerified: () => void; onRecoveryComplete: () => void; }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const normalizedEmail = email.trim().toLowerCase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      if (recovery) {
        if (password.length < 12) throw new Error("Choose a password containing at least 12 characters.");
        if (password !== confirmPassword) throw new Error("The two passwords do not match.");
        const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
        if (updateError) throw updateError;
        setPassword(""); setConfirmPassword(""); onRecoveryComplete(); return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError) throw new Error(signInError.message === "Invalid login credentials" ? "Incorrect email or password. Use Email OTP for first login or a forgotten password." : signInError.message);
      setPassword("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  async function sendOtp() {
    setError(null); setMessage(null); setOtp("");
    if (!normalizedEmail) { setError("Enter your authorised work email before requesting an OTP."); return; }
    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: false } });
      if (otpError) throw otpError;
      setOtpSent(true); setMessage("A 6-digit Joy Payroll OTP has been requested for this authorised email. Check Inbox and Spam/Junk.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send the email OTP."); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setError(null); setMessage(null);
    if (!normalizedEmail || !/^\d{6,10}$/.test(otp.trim())) { setError("Enter the OTP code received at your authorised email address."); return; }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: otp.trim(), type: "email" });
      if (verifyError) throw verifyError;
      setOtp(""); setOtpSent(false); onOtpVerified();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The OTP could not be verified."); }
    finally { setBusy(false); }
  }

  return <main className="joy-login-page"><section className="joy-login-card"><Brand /><span className="joy-login-kicker">CONFIDENTIAL PAYROLL WORKSPACE</span><h1>{recovery ? "Set your secure password" : "Sign in to Joy Payroll"}</h1><p>{recovery ? "After email verification, create your own secure payroll password." : "Existing users can use their password. First-time users and forgotten-password users can verify by company email OTP."}</p><form onSubmit={(event) => void submit(event)}>
    {!recovery ? <label><span>Authorised work email</span><input autoComplete="username" autoFocus onChange={(event) => { setEmail(event.target.value); setOtpSent(false); setOtp(""); }} placeholder="you@joycorporatesolutions.com" required type="email" value={email} /></label> : null}
    {!recovery && otpSent ? <label><span>Email OTP</span><input autoComplete="one-time-code" inputMode="numeric" maxLength={10} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="Enter OTP" value={otp} /></label> : null}
    {!recovery && !otpSent ? <label><span>Password</span><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label> : null}
    {recovery ? <><label><span>New password</span><input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label><span>Confirm new password</span><input autoComplete="new-password" minLength={12} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label></> : null}
    {error ? <div className="joy-login-notice joy-login-error">{error}</div> : null}{message ? <div className="joy-login-notice joy-login-success">{message}</div> : null}
    {recovery ? <button className="joy-login-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Save new password"}</button> : otpSent ? <button className="joy-login-submit" disabled={busy || !otp} onClick={() => void verifyOtp()} type="button">{busy ? "Verifying…" : "Verify OTP & set password"}</button> : <button className="joy-login-submit" disabled={busy} type="submit">{busy ? "Please wait…" : "Sign in"}</button>}
    {!recovery ? <button className="joy-login-reset" disabled={busy} onClick={() => void sendOtp()} type="button">{otpSent ? "Resend email OTP" : "First login / Forgot password — Email OTP"}</button> : null}
    {!recovery && otpSent ? <button className="joy-login-reset" disabled={busy} onClick={() => { setOtpSent(false); setOtp(""); setMessage(null); }} type="button">Back to password sign-in</button> : null}
  </form><footer>OTP and password-reset emails are sent only to authorised user email accounts. Access remains controlled by your Super Admin profile.</footer></section></main>;
}

function SupabasePayroll({ config }: { config: JoyPayrollConfig }) {
  const supabase = useMemo(() => createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { autoRefreshToken: true, detectSessionInUrl: true, persistSession: true, storageKey: "joy-payroll-auth-session" } }), [config.supabasePublishableKey, config.supabaseUrl]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setSession(data.session); if (data.session?.user.user_metadata?.must_change_password === true) setRecovery(true); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => { if (!mounted) return; setSession(nextSession); setLoading(false); if (event === "PASSWORD_RECOVERY") setRecovery(true); if (nextSession?.user.user_metadata?.must_change_password === true) setRecovery(true); if (event === "SIGNED_OUT") setRecovery(false); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [supabase]);
  if (loading) return <main className="joy-login-page"><section className="joy-login-card joy-loading-card"><Brand /><p>Checking your secure payroll session…</p></section></main>;
  if (!session || recovery) return <LoginScreen supabase={supabase} recovery={recovery} onOtpVerified={() => setRecovery(true)} onRecoveryComplete={() => setRecovery(false)} />;
  const userMetadata = session.user.user_metadata ?? {};
  const candidate = userMetadata.full_name ?? userMetadata.name;
  const displayName = typeof candidate === "string" && candidate.trim() ? candidate.trim() : session.user.email ?? "Joy Payroll User";
  return <PayrollApp accessToken={session.access_token} apiEndpoint={config.apiUrl?.trim() || `${config.supabaseUrl}/functions/v1/payroll-api`} displayName={displayName} onSignOut={async () => { await supabase.auth.signOut(); }} onChangePassword={async (password) => { const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } }); if (error) throw error; }} publishableKey={config.supabasePublishableKey} />;
}

function App() { const config = window.JOY_PAYROLL_CONFIG; return validConfiguration(config) ? <SupabasePayroll config={config} /> : <SetupRequired />; }
const root = document.getElementById("root"); if (!root) throw new Error("The Joy Payroll website root element is missing.");
createRoot(root).render(<StrictMode><App /></StrictMode>);
