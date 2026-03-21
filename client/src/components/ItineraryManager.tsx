/**
 * ItineraryManager — Admin component for creating and editing tour itineraries.
 * Supports multiple itineraries per page. Each itinerary has named waypoints
 * placed interactively on a Leaflet map, with a start/end distinction.
 */
import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, MapPin, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RAILWAY_URL } from "@/lib/queryClient";

const ADMIN_TOKEN = "albatour-admin-secret-token";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Waypoint {
  order: number;
  lat: number;
  lng: number;
  title: string;
  description: string;
}

export interface Itinerary {
  id: number;
  siteSlug: string;
  entityType: string;
  name: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  distanceKm: number;
  difficulty: string;
  waypoints: string; // JSON string
  isPublished: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  instructions: "",
  durationMinutes: 60,
  distanceKm: 0,
  difficulty: "easy",
  isPublished: true,
};

// ── Leaflet map for placing / reordering waypoints ────────────────────────────
function WaypointMap({
  centerLat, centerLng, waypoints, onWaypointsChange,
}: {
  centerLat: number; centerLng: number;
  waypoints: Waypoint[]; onWaypointsChange: (wp: Waypoint[]) => void;
}) {
  const mapRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  // Load Leaflet lazily (already bundled in the app via MiniMap)
  useEffect(() => {
    if (!mapDivRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapDivRef.current, { zoomControl: true }).setView([centerLat, centerLng], 15);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© CartoDB",
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Click to add waypoint
      mapRef.current.on("click", (e: any) => {
        onWaypointsChange([
          ...waypoints,
          {
            order: waypoints.length + 1,
            lat: parseFloat(e.latlng.lat.toFixed(6)),
            lng: parseFloat(e.latlng.lng.toFixed(6)),
            title: waypoints.length === 0 ? "Start" : waypoints.length === 1 ? "End" : `Stop ${waypoints.length}`,
            description: "",
          },
        ]);
      });
    }

    // Redraw markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }

    waypoints.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === waypoints.length - 1 && waypoints.length > 1;
      const color = isStart ? "#22c55e" : isEnd ? "#ef4444" : "#3b82f6";
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">${idx + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([wp.lat, wp.lng], { icon, draggable: true })
        .addTo(mapRef.current)
        .bindTooltip(`${idx + 1}. ${wp.title}`, { permanent: false });

      marker.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const updated = waypoints.map((w, i) =>
          i === idx ? { ...w, lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) } : w
        );
        onWaypointsChange(updated);
      });

      markersRef.current.push(marker);
    });

    // Draw route polyline
    if (waypoints.length > 1) {
      polylineRef.current = L.polyline(waypoints.map(w => [w.lat, w.lng]), {
        color: "#6366f1", weight: 3, opacity: 0.7, dashArray: "6 4",
      }).addTo(mapRef.current);
    }

    // Fit bounds
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [waypoints, centerLat, centerLng]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Click the map to add waypoints in order. Drag markers to reposition. First = Start (green), Last = End (red).
      </p>
      <div ref={mapDivRef} style={{ height: 320, borderRadius: 8, border: "1px solid hsl(var(--border))", zIndex: 0 }} />
    </div>
  );
}

// ── Waypoint list editor ──────────────────────────────────────────────────────
function WaypointList({ waypoints, onChange }: { waypoints: Waypoint[]; onChange: (wp: Waypoint[]) => void }) {
  if (waypoints.length === 0) return (
    <p className="text-xs text-muted-foreground italic">No waypoints yet. Click the map above to add stops.</p>
  );

  return (
    <div className="space-y-2">
      {waypoints.map((wp, idx) => (
        <div key={idx} className="flex gap-2 items-start rounded-lg border border-border bg-muted/30 p-2">
          <div className="flex items-center gap-1 pt-1">
            <GripVertical size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold w-5 text-center"
              style={{ color: idx === 0 ? "#22c55e" : idx === waypoints.length - 1 ? "#ef4444" : "#3b82f6" }}>
              {idx + 1}
            </span>
          </div>
          <div className="flex-1 space-y-1">
            <Input
              value={wp.title}
              onChange={e => onChange(waypoints.map((w, i) => i === idx ? { ...w, title: e.target.value } : w))}
              placeholder={idx === 0 ? "Start point name" : idx === waypoints.length - 1 ? "End point name" : `Stop ${idx + 1} name`}
              className="h-7 text-xs"
            />
            <Input
              value={wp.description}
              onChange={e => onChange(waypoints.map((w, i) => i === idx ? { ...w, description: e.target.value } : w))}
              placeholder="Brief description (optional)"
              className="h-7 text-xs"
            />
          </div>
          <button
            onClick={() => onChange(waypoints.filter((_, i) => i !== idx).map((w, i) => ({ ...w, order: i + 1 })))}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive mt-1"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main ItineraryManager component ──────────────────────────────────────────
interface Props {
  siteSlug: string;
  entityType?: string;
  centerLat?: number;
  centerLng?: number;
}

export default function ItineraryManager({ siteSlug, entityType = "site", centerLat = 41.3275, centerLng = 19.8187 }: Props) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | "new" | null>(null); // id or "new"
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const headers = { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN };

  // Fetch itineraries
  const fetchItineraries = async () => {
    try {
      setLoading(true);
      const r = await fetch(`${RAILWAY_URL}/api/admin/itineraries/${siteSlug}`, { headers: { "x-admin-token": ADMIN_TOKEN } });
      if (r.ok) setItineraries(await r.json());
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchItineraries(); }, [siteSlug]);

  const startNew = () => {
    setForm({ ...EMPTY_FORM });
    setWaypoints([]);
    setEditing("new");
    setError(null);
  };

  const startEdit = (it: Itinerary) => {
    setForm({
      name: it.name, description: it.description, instructions: it.instructions,
      durationMinutes: it.durationMinutes, distanceKm: it.distanceKm || 0,
      difficulty: it.difficulty, isPublished: it.isPublished,
    });
    try { setWaypoints(JSON.parse(it.waypoints) || []); } catch { setWaypoints([]); }
    setEditing(it.id);
    setError(null);
  };

  const cancelEdit = () => { setEditing(null); setError(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        siteSlug,
        entityType,
        durationMinutes: Number(form.durationMinutes),
        distanceKm: Number(form.distanceKm),
        waypoints: JSON.stringify(waypoints),
      };
      const url = editing === "new"
        ? `${RAILWAY_URL}/api/admin/itineraries`
        : `${RAILWAY_URL}/api/admin/itineraries/${editing}`;
      const method = editing === "new" ? "POST" : "PUT";
      const r = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Save failed"); }
      await fetchItineraries();
      setEditing(null);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this itinerary?")) return;
    await fetch(`${RAILWAY_URL}/api/admin/itineraries/${id}`, { method: "DELETE", headers });
    setItineraries(prev => prev.filter(i => i.id !== id));
    if (editing === id) setEditing(null);
  };

  const togglePublish = async (it: Itinerary) => {
    const r = await fetch(`${RAILWAY_URL}/api/admin/itineraries/${it.id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ isPublished: !it.isPublished }),
    });
    if (r.ok) setItineraries(prev => prev.map(i => i.id === it.id ? { ...i, isPublished: !i.isPublished } : i));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Route size={15} className="text-primary" /> Tour Itineraries
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create one or more self-guided tour routes for visitors. Each itinerary has a start point, end point, and stops along the way.
          </p>
        </div>
        {editing === null && (
          <Button size="sm" onClick={startNew} className="gap-1.5 text-xs h-8">
            <Plus size={13} /> New Itinerary
          </Button>
        )}
      </div>

      {/* ── Editor form ── */}
      {editing !== null && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                {editing === "new" ? "New Itinerary" : "Edit Itinerary"}
              </span>
              <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                <X size={15} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Itinerary Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Historic Tirana Walking Tour" className="text-sm" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Short Description</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="What will visitors see and experience on this route?" className="text-sm resize-none" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Visitor Instructions</label>
                <Textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={2} placeholder="e.g. Start at Skanderbeg Square. Follow the route in order. Allow 2 hours. Wear comfortable shoes." className="text-sm resize-none" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (minutes)</label>
                <Input type="number" min={5} value={form.durationMinutes}
                  onChange={e => setForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))} className="text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Distance (km)</label>
                <Input type="number" min={0} step={0.1} value={form.distanceKm}
                  onChange={e => setForm(f => ({ ...f, distanceKm: parseFloat(e.target.value) || 0 }))} className="text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Difficulty</label>
                <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v }))}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="published" checked={form.isPublished}
                  onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="accent-primary" />
                <label htmlFor="published" className="text-xs text-muted-foreground">Published (visible to visitors)</label>
              </div>
            </div>

            {/* Map waypoint picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Route Waypoints</label>
              <WaypointMap
                centerLat={centerLat}
                centerLng={centerLng}
                waypoints={waypoints}
                onWaypointsChange={setWaypoints}
              />
            </div>

            {/* Waypoint list editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Waypoint Labels ({waypoints.length})
                </label>
                {waypoints.length > 0 && (
                  <button onClick={() => setWaypoints([])} className="text-xs text-muted-foreground hover:text-destructive">
                    Clear all
                  </button>
                )}
              </div>
              <WaypointList waypoints={waypoints} onChange={setWaypoints} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 min-w-24">
                {saving ? "Saving…" : <><Save size={13} /> Save Itinerary</>}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Itinerary list ── */}
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading itineraries…</p>
      ) : itineraries.length === 0 && editing === null ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Route size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm text-muted-foreground">No itineraries yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Click "New Itinerary" to create a self-guided walking route.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itineraries.map(it => {
            const wps: Waypoint[] = (() => { try { return JSON.parse(it.waypoints) || []; } catch { return []; } })();
            const isOpen = expandedId === it.id;
            return (
              <Card key={it.id} className={`border-border/60 ${!it.isPublished ? "opacity-60" : ""}`}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <button className="flex-1 flex items-center gap-2 text-left" onClick={() => setExpandedId(isOpen ? null : it.id)}>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Route size={13} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{it.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1"><Clock size={10} /> {it.durationMinutes} min</span>
                          {it.distanceKm ? <span className="flex items-center gap-1">· {it.distanceKm} km</span> : null}
                          <span>· {wps.length} stops</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            it.difficulty === "easy" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                            it.difficulty === "moderate" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                            "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                          }`}>{it.difficulty}</span>
                        </p>
                      </div>
                      {isOpen ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => togglePublish(it)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title={it.isPublished ? "Unpublish" : "Publish"}>
                        {it.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button onClick={() => startEdit(it)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent className="pt-0 pb-4 px-4 space-y-2 border-t border-border/40">
                    {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                    {it.instructions && (
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-xs font-medium mb-1">Visitor instructions</p>
                        <p className="text-xs text-muted-foreground">{it.instructions}</p>
                      </div>
                    )}
                    {wps.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Stops</p>
                        {wps.map((wp, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                              style={{ background: i === 0 ? "#22c55e" : i === wps.length - 1 ? "#ef4444" : "#3b82f6" }}>
                              {i + 1}
                            </span>
                            <div>
                              <span className="font-medium">{wp.title}</span>
                              {wp.description && <span className="text-muted-foreground ml-1">— {wp.description}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
