export function getPrimaryDraftAction(pathname: string) {
  const isHostSetup = pathname === "/host/setup" || pathname.startsWith("/host/setup/");

  return isHostSetup
    ? { to: "/offline-draft", label: "Offline Draft" }
    : { to: "/host/setup", label: "Start Draft" };
}
