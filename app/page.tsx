import { requireAuthenticatedUser } from "./auth";
import PayrollApp from "./payroll-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireAuthenticatedUser("/");
  return <PayrollApp displayName={user.displayName} />;
}
