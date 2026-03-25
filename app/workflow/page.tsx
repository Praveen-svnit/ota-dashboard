"use client";

import { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   TEAM REGISTRY (for MemberChip colors)
══════════════════════════════════════════════════════════════ */
const TEAM_REGISTRY: Record<string, { color: string; role: "lead" | "intern" | "external" }> = {
  // Team Leads
  "Jyoti":  { color: "#E83F6F", role: "lead" }, "Gourav": { color: "#F59E0B", role: "lead" },
  "Ajay":   { color: "#10B981", role: "lead" }, "Salim":  { color: "#8B5CF6", role: "lead" },
  // Jyoti's team
  "Rudra":      { color: "#E83F6F", role: "intern" }, "Mohit":    { color: "#E83F6F", role: "intern" },
  "Karan (CT)": { color: "#E83F6F", role: "intern" }, "Abhishek": { color: "#E83F6F", role: "intern" },
  "Umesh":      { color: "#E83F6F", role: "intern" }, "Rahul":    { color: "#E83F6F", role: "intern" },
  // Gourav's team
  "Aman":     { color: "#F59E0B", role: "intern" }, "Ajeet":    { color: "#F59E0B", role: "intern" },
  "Shrishti": { color: "#F59E0B", role: "intern" }, "Joti":     { color: "#F59E0B", role: "intern" },
  "Vipul":    { color: "#F59E0B", role: "intern" },
  // Ajay's team
  "Gaurav Pandey": { color: "#10B981", role: "intern" },
  "Sadik":         { color: "#10B981", role: "intern" },
  "Sajjak":        { color: "#10B981", role: "intern" },
  // Salim's team
  "Karan":      { color: "#8B5CF6", role: "intern" }, "Vishal":     { color: "#8B5CF6", role: "intern" },
  "Ajay Dhama": { color: "#8B5CF6", role: "intern" }, "Yash":       { color: "#8B5CF6", role: "intern" },
  "Gunjan":     { color: "#8B5CF6", role: "intern" }, "Vanshika":   { color: "#8B5CF6", role: "intern" },
  // External teams
  "Supply Team": { color: "#0EA5E9", role: "external" }, "Revenue Team": { color: "#F97316", role: "external" },
  "Legal Team":  { color: "#6B7280", role: "external" }, "Finance Team": { color: "#14B8A6", role: "external" },
  "Photoshoot Team": { color: "#EC4899", role: "external" },
};

/* ══════════════════════════════════════════════════════════════
   WORKFLOW DATA
══════════════════════════════════════════════════════════════ */
interface WorkflowStep { id: number; title: string; desc?: string; owners: string[]; track?: "A" | "B" }
interface WorkflowPhase { id: string; label: string; icon: string; color: string; bg: string; steps: WorkflowStep[] }

const WORKFLOW: WorkflowPhase[] = [
  {
    id: "onboarding", label: "Onboarding", icon: "①", color: "#6366F1", bg: "#EEF2FF",
    steps: [
      { id: 1, title: "Property Onboarding Form Submitted", desc: "Supply team fills in all property details — name, location, room types, contracts, and supporting documents.", owners: ["Supply Team"] },
      { id: 2, title: "Form Review — Revenue & Legal", desc: "Revenue team validates commercial terms; Legal team verifies contracts and compliance.", owners: ["Revenue Team", "Legal Team"] },
      { id: 3, title: "Final Approval — Property Good to Go", desc: "All stakeholders aligned. Property is approved and handed over to the Listing team.", owners: ["Revenue Team", "Legal Team"] },
    ],
  },
  {
    id: "listing-prep", label: "Listing Prep", icon: "②", color: "#8B5CF6", bg: "#F3E8FF",
    steps: [
      { id: 4, title: "Form Audit & Verification", desc: "Karan (FH Onboarding) reviews and audits all submitted forms for completeness and accuracy.", owners: ["Salim", "Karan"] },
      { id: 5, title: "Contract Details Entered to Tracking Sheet", owners: ["Karan"] },
      { id: 6, title: "Details Shared with Finance Team", owners: ["Karan", "Finance Team"] },
      { id: 7, title: "Listing Details Handed to Listing Team", owners: ["Salim", "Karan", "Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    ],
  },
  {
    id: "fh-shell", label: "FH Shell", icon: "③", color: "#0EA5E9", bg: "#E0F2FE",
    steps: [
      { id: 8, title: "Property Shell Created on FH Platform", desc: "FH Listing team builds the property shell — room types, amenities, pricing structure, and content.", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
      { id: 9, title: "Property Goes Live on FH", desc: "Shell is reviewed and published. OTA listing and Photoshoot tracks begin in parallel.", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    ],
  },
  {
    id: "ota-listing", label: "OTA Listing", icon: "④", color: "#F59E0B", bg: "#FFF7ED",
    steps: [
      { id: 10, title: "OTA Stakeholders Raise Listing Requests", owners: ["Jyoti", "Rudra", "Mohit", "Karan (CT)", "Abhishek", "Gourav", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Ajay", "Gaurav Pandey", "Sajjak"] },
      { id: 11, title: "Property Listed & Live on OTAs", owners: ["Rudra", "Mohit", "Karan (CT)", "Abhishek", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Gaurav Pandey", "Sajjak"] },
      { id: 12, title: "OTA Mapping — All Platforms", owners: ["Rudra", "Mohit", "Karan (CT)", "Abhishek", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Gaurav Pandey", "Sajjak"] },
    ],
  },
  {
    id: "post-live", label: "Post Live", icon: "⑤", color: "#10B981", bg: "#D1FAE5",
    steps: [
      { id: 13, title: "Ops Visit — Room Level Data Captured", track: "A", owners: ["Salim", "Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
      { id: 14, title: "RLD Updated on FH Web / App Portal", track: "A", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
      { id: 15, title: "RLD Updated on OTA Portals", track: "A", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
      { id: 16, title: "Photoshoot Conducted at Property", track: "B", owners: ["Photoshoot Team"] },
      { id: 17, title: "Photos Processed & Uploaded to FH Portal", track: "B", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
      { id: 18, title: "Photos Updated on OTA Portals", track: "B", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
   MINI COMPONENTS
══════════════════════════════════════════════════════════════ */
function MemberChip({ name }: { name: string }) {
  const m = TEAM_REGISTRY[name];
  const color = m?.color ?? "#64748B";
  const isExt = m?.role === "external";
  const isLead = m?.role === "lead";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px 2px 3px", borderRadius: 20, background: color + "15", border: `1px solid ${color}35`, fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap" }}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: isExt ? "transparent" : color, color: isExt ? color : "#FFF", border: isExt ? `1.5px dashed ${color}` : "none", fontSize: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {name[0]}
      </span>
      {name}
      {isLead && <span style={{ fontSize: 6, opacity: 0.55, letterSpacing: "0.04em", textTransform: "uppercase" }}>TL</span>}
      {isExt  && <span style={{ fontSize: 6, opacity: 0.55, letterSpacing: "0.04em", textTransform: "uppercase" }}>EXT</span>}
    </span>
  );
}

function StepCard({ step, color, bg, isLast }: { step: WorkflowStep; color: string; bg: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDesc = !!step.desc;
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {/* line + dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: color, color: "#FFF", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 6px ${color}55`, flexShrink: 0, zIndex: 1 }}>
          {step.id}
        </div>
        {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 8, background: `linear-gradient(${color}60, ${color}10)`, marginTop: 3 }} />}
      </div>
      {/* card */}
      <div style={{ flex: 1, marginBottom: isLast ? 0 : 8, marginLeft: 8, border: `1px solid ${color}22`, borderLeft: `3px solid ${color}`, borderRadius: 8, overflow: "hidden", background: "#FAFBFF" }}>
        <div style={{ padding: "7px 10px", background: open ? bg : "#FAFBFF", cursor: hasDesc ? "pointer" : "default", transition: "background 0.15s" }}
          onClick={() => hasDesc && setOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#0F172A", lineHeight: 1.4 }}>{step.title}</span>
            {hasDesc && <span style={{ fontSize: 9, color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{open ? "▲" : "▼"}</span>}
          </div>
          {step.owners.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
              {step.owners.map((o) => <MemberChip key={o} name={o} />)}
            </div>
          )}
        </div>
        {open && step.desc && (
          <div style={{ padding: "7px 10px", borderTop: `1px solid ${color}18`, background: bg }}>
            <p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.65 }}>{step.desc}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
export default function WorkflowPage() {
  const [activePhase, setActivePhase] = useState("all");
  const totalSteps = WORKFLOW.reduce((n, p) => n + p.steps.length, 0);

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Property Workflow</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 20, padding: "2px 9px" }}>
          {totalSteps} steps · {WORKFLOW.length} phases
        </span>
        <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>Click any step to expand details</span>
      </div>

      {/* Phase progress bar */}
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", marginBottom: 14, height: 5, gap: 2 }}>
        {WORKFLOW.map((ph) => (
          <div key={ph.id} title={ph.label}
            style={{ flex: ph.steps.length, background: activePhase === "all" || activePhase === ph.id ? ph.color : ph.color + "30", cursor: "pointer", transition: "background 0.2s" }}
            onClick={() => setActivePhase(activePhase === ph.id ? "all" : ph.id)} />
        ))}
      </div>

      {/* Phase filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={() => setActivePhase("all")} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid #C7D2FE", background: activePhase === "all" ? "#6366F1" : "#EEF2FF", color: activePhase === "all" ? "#FFF" : "#6366F1", transition: "all 0.15s" }}>
          All phases
        </button>
        {WORKFLOW.map((ph) => (
          <button key={ph.id} onClick={() => setActivePhase(activePhase === ph.id ? "all" : ph.id)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${ph.color}50`, background: activePhase === ph.id ? ph.color : ph.bg, color: activePhase === ph.id ? "#FFF" : ph.color, transition: "all 0.15s" }}>
            {ph.icon} {ph.label}
          </button>
        ))}
      </div>

      {/* Phases */}
      {WORKFLOW.filter((ph) => activePhase === "all" || activePhase === ph.id).map((phase, phIdx, arr) => {
        const nonParallel = phase.steps.filter((s) => !s.track);
        const trackA      = phase.steps.filter((s) => s.track === "A");
        const trackB      = phase.steps.filter((s) => s.track === "B");
        const hasParallel = trackA.length > 0 && trackB.length > 0;
        const isLastPhase = phIdx === arr.length - 1;

        return (
          <div key={phase.id} style={{ marginBottom: isLastPhase ? 0 : 24 }}>
            {/* Phase label */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", background: phase.bg, border: `1px solid ${phase.color}35`, borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: phase.color }}>{phase.label}</span>
                <span style={{ fontSize: 9, color: phase.color, opacity: 0.55 }}>{phase.steps.length} steps</span>
              </div>
              <div style={{ flex: 1, height: 1, background: `${phase.color}18` }} />
            </div>

            <div style={{ paddingLeft: 4 }}>
              {nonParallel.map((step, i) => (
                <StepCard key={step.id} step={step} color={phase.color} bg={phase.bg}
                  isLast={i === nonParallel.length - 1 && !hasParallel} />
              ))}

              {hasParallel && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 1, background: `${phase.color}25` }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: phase.color, background: phase.bg, border: `1px solid ${phase.color}35`, borderRadius: 20, padding: "2px 10px", letterSpacing: "0.06em" }}>PARALLEL TRACKS</span>
                    <div style={{ flex: 1, height: 1, background: `${phase.color}25` }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#0EA5E9", background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 20, padding: "2px 10px", display: "inline-flex", gap: 5, marginBottom: 8, letterSpacing: "0.04em" }}>
                        ◈ TRACK A · Room Level Data
                      </div>
                      {trackA.map((step, i) => <StepCard key={step.id} step={step} color="#0EA5E9" bg="#E0F2FE" isLast={i === trackA.length - 1} />)}
                    </div>
                    <div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#EC4899", background: "#FCE7F3", border: "1px solid #FBCFE8", borderRadius: 20, padding: "2px 10px", display: "inline-flex", gap: 5, marginBottom: 8, letterSpacing: "0.04em" }}>
                        ◈ TRACK B · Photoshoot
                      </div>
                      {trackB.map((step, i) => <StepCard key={step.id} step={step} color="#EC4899" bg="#FCE7F3" isLast={i === trackB.length - 1} />)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
