import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/App";
import { getSessionId } from "@/lib/session";
import { Trophy, Star, Medal } from "lucide-react";

interface LeaderboardEntry {
  sessionId: string;
  totalPoints: number;
  visitCount: number;
}

const MEDAL_COLORS = ["#C9A227", "#A0A0A0", "#CD7F32"];

export default function LeaderboardPage() {
  const { t, totalPoints, visitedSiteIds } = useApp();
  const mySessionId = getSessionId();

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000,
  });

  const myEntry = { sessionId: mySessionId, totalPoints, visitCount: visitedSiteIds.size };

  // Merge local progress into leaderboard
  const allEntries = [...entries];
  const myIndex = allEntries.findIndex(e => e.sessionId === mySessionId);
  if (myIndex >= 0) {
    allEntries[myIndex] = myEntry;
  } else if (totalPoints > 0) {
    allEntries.push(myEntry);
  }
  allEntries.sort((a, b) => b.totalPoints - a.totalPoints);

  const myRank = allEntries.findIndex(e => e.sessionId === mySessionId) + 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-6" data-testid="leaderboard-page">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: "linear-gradient(135deg, #C9A227, #E8B84B)" }}>
          <Trophy size={28} style={{ color: "#2A1A00" }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {t.lbTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Albania's best explorers</p>
      </div>

      {/* My rank card */}
      {totalPoints > 0 && (
        <div className="rounded-xl border-2 bg-card p-4 flex items-center justify-between"
          style={{ borderColor: "hsl(var(--primary))" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
              {myRank || "?"}
            </div>
            <div>
              <div className="font-semibold text-sm">{t.lbYou}</div>
              <div className="text-xs text-muted-foreground">{visitedSiteIds.size} sites visited</div>
            </div>
          </div>
          <div className="points-badge text-base px-3 py-1.5">
            <Star size={12} fill="currentColor" />
            {totalPoints} pts
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton skeleton-text w-1/3" />
                <div className="skeleton skeleton-text w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy size={40} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">{t.lbEmpty}</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="leaderboard-list">
          {allEntries.map((entry, i) => {
            const isMe = entry.sessionId === mySessionId;
            const rank = i + 1;
            return (
              <div
                key={entry.sessionId}
                data-testid={`lb-entry-${i}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isMe ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                }`}
              >
                {/* Rank */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-none"
                  style={{
                    background: rank <= 3 ? `${MEDAL_COLORS[rank - 1]}25` : "hsl(var(--muted))",
                    color: rank <= 3 ? MEDAL_COLORS[rank - 1] : "hsl(var(--muted-foreground))",
                  }}>
                  {rank <= 3 ? (
                    <Medal size={18} />
                  ) : rank}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {isMe ? `${t.lbYou} 👤` : `Explorer #${entry.sessionId.slice(-4)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.visitCount} {t.visitedSites.toLowerCase()}
                  </div>
                </div>

                {/* Points */}
                <div className="points-badge flex-none">
                  <Star size={10} fill="currentColor" />
                  {entry.totalPoints}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How to climb */}
      <div className="rounded-xl bg-muted p-4 text-sm">
        <p className="font-semibold mb-2">How to earn more points:</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>🏛️ Archaeology sites — up to 150 pts</li>
          <li>🏰 Castles — up to 130 pts</li>
          <li>🏔️ Nature & mountains — up to 200 pts</li>
          <li>🎧 Complete the audio tour for bonus points</li>
        </ul>
      </div>
    </div>
  );
}
