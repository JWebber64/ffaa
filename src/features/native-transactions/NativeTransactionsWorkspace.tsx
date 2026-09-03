import { useMemo } from "react";
import { Activity, Handshake, ListChecks, Store } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import type { CanonicalLeagueWorkspace } from "../league-domain/types";
import { NativeTradeWorkspace } from "../native-trades/NativeTradeWorkspace";
import { useNativeTrades } from "../native-trades/useNativeTrades";
import { NativeWaiverWorkspace } from "../native-waivers/NativeWaiverWorkspace";
import { useNativeWaivers } from "../native-waivers/useNativeWaivers";
import "./native-transactions.css";

type Tab = "activity" | "waivers" | "trades" | "market";
const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [{ id: "activity", label: "Activity", icon: Activity }, { id: "waivers", label: "Waivers", icon: ListChecks }, { id: "trades", label: "Trades", icon: Handshake }, { id: "market", label: "Trade Market", icon: Store }];
function tab(value: string | null): Tab { return TABS.some((entry) => entry.id === value) ? value as Tab : "activity"; }
function time(value: string, timezone: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(parsed) : "Time unavailable"; }

export function NativeTransactionsWorkspace({ workspace }: { workspace: CanonicalLeagueWorkspace }) {
  const season = workspace.season!; const [params, setParams] = useSearchParams(); const selected = tab(params.get("tab")); const isCommissioner = workspace.authority.canManage;
  const trades = useNativeTrades(workspace.league.id, season.id, season.settingsVersionId); const waivers = useNativeWaivers(workspace.league.id, season.id, season.settingsVersionId, workspace.membership?.userId ?? "", isCommissioner);
  const activity = useMemo(() => {
    const teamName = (id: string) => trades.teams.find((team) => team.franchiseId === id)?.name ?? id;
    return [
      ...trades.receipts.map((row) => ({ id: `trade-${row.id}`, at: row.processedAt, type: "Trade", title: `${teamName(row.fromFranchiseId)} and ${teamName(row.toFranchiseId)}`, detail: `${row.offeredAssets.length + row.requestedAssets.length} assets · ${row.reviewPolicy.replace(/_/gu, " ")}` })),
      ...waivers.receipts.map((row) => ({ id: `waiver-${row.id}`, at: row.processedAt, type: "Waiver", title: row.status === "won" ? `${teamName(row.franchiseId)} won ${row.addPlayerId}` : `${teamName(row.franchiseId)} claim failed`, detail: row.winningBid === null ? row.failures.join(" ") || "No award" : `$${row.winningBid} · priority ${row.priorityBefore} to ${row.priorityAfter}` })),
    ].sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 40);
  }, [trades.receipts, trades.teams, waivers.receipts]);

  function select(next: Tab) { const updated = new URLSearchParams(params); updated.set("tab", next); setParams(updated, { replace: true }); }
  return <div className="native-transactions-page"><header><div><span>Native transactions</span><h1>League activity & markets</h1><p>Claims, trades, outcomes, and roster movement remain tied to the authoritative asset ledger.</p></div><strong>{activity.length} completed events</strong></header><nav aria-label="Transaction views">{TABS.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-selected={selected === id} className={selected === id ? "is-active" : ""} onClick={() => select(id)}><Icon aria-hidden="true" />{label}</button>)}</nav>
    {selected === "activity" ? <section className="native-transaction-activity" aria-labelledby="transaction-activity-title"><header><div><span>Ledger stream</span><h2 id="transaction-activity-title">Completed activity</h2></div><small>Newest first</small></header>{activity.length ? <div role="table" aria-label="Completed league transactions"><div className="native-transaction-row is-head" role="row"><span>Type</span><span>Parties / result</span><span>Evidence</span><span>Completed</span></div>{activity.map((row) => <div className="native-transaction-row" role="row" key={row.id}><strong data-label="Type">{row.type}</strong><span data-label="Parties / result">{row.title}</span><small data-label="Evidence">{row.detail}</small><time data-label="Completed">{time(row.at, workspace.league.timezone)}</time></div>)}</div> : <p>No completed waiver or trade receipt is available yet.</p>}</section> : null}
    {selected === "waivers" ? <NativeWaiverWorkspace workspace={workspace} /> : null}
    {selected === "trades" ? <NativeTradeWorkspace workspace={workspace} /> : null}
    {selected === "market" ? <section className="native-trade-market" aria-labelledby="trade-market-title"><header><div><span>League market</span><h2 id="trade-market-title">Teams & available capital</h2></div><small>{trades.offers.filter((offer) => offer.status === "sent").length} open offers</small></header><div className="native-trade-market-head" aria-hidden="true"><span>Team</span><span>Roster</span><span>FAAB</span><span>Open offers</span></div>{trades.teams.map((team) => <article key={team.franchiseId}><strong>{team.name}</strong><span>{team.rosterPlayerIds.length} players</span><span>${trades.teamStates.find((row) => row.franchiseId === team.franchiseId)?.faabRemaining ?? 0}</span><span>{trades.offers.filter((offer) => offer.status === "sent" && [offer.fromFranchiseId, offer.toFranchiseId].includes(team.franchiseId)).length}</span></article>)}</section> : null}
  </div>;
}
