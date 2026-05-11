"use client";

import { useState } from "react";

type Format = 1 | 2;

interface FormData {
  ownerName: string;
  hotelName: string;
  address: string;
  city: string;
  authDate: string;
  ownerEmail: string;
  ownerPhone: string;
  emailSubject: string;
}

const today = new Date().toISOString().split("T")[0];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

function buildDates(authDate: Date) {
  const dateStr = `${pad2(authDate.getDate())}-${pad2(authDate.getMonth() + 1)}-${authDate.getFullYear()}`;
  const dateDisplay = `${DAYS[authDate.getDay()]}, ${MONTHS[authDate.getMonth()]} ${authDate.getDate()}, ${authDate.getFullYear()} at 1:16 PM`;
  const dateFwd = `${DAYS[authDate.getDay()]}, ${authDate.getDate()} ${MONTHS[authDate.getMonth()].substring(0, 3)} ${authDate.getFullYear()} 18:10:52 +0530`;
  return { dateStr, dateDisplay, dateFwd };
}

async function generatePdf(format: Format, form: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = await import("jspdf") as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new jsPDF();

  const authDate = new Date(form.authDate + "T00:00:00");
  const { dateStr, dateDisplay, dateFwd } = buildDates(authDate);

  if (format === 1) {
    generateFormat1(doc, { ...form, dateStr, dateDisplay, authDateObj: authDate });
  } else {
    generateFormat2(doc, { ...form, dateStr, dateDisplay, dateFwd });
  }

  doc.save(`FabHotel ${form.hotelName} OCM.pdf`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFormat1(doc: any, d: FormData & { dateStr: string; dateDisplay: string; authDateObj: Date }) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const topDateStr = `${pad2(d.authDateObj.getDate())}/${pad2(d.authDateObj.getMonth() + 1)}/${d.authDateObj.getFullYear()}, 1:16 PM`;
  doc.text(topDateStr, 10, 12);
  doc.text(`FabHotels Mail - ${d.emailSubject} Date: ${d.dateStr}`, 200, 12, { align: "right" });

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 78);
  doc.text("fabHOTELS", 10, 28);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Abhijeet Yadav <abhijeet.yadav@fabhotels.com>", 200, 28, { align: "right" });

  doc.line(10, 33, 200, 33);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${d.emailSubject} Date: ${d.dateStr}`, 10, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("1 message", 10, 48);

  doc.setFont("helvetica", "bold");
  doc.text(`${d.hotelName}<${d.ownerEmail}>`, 10, 56);
  doc.setFont("helvetica", "normal");
  doc.text(d.dateDisplay, 200, 56, { align: "right" });
  doc.text('To: "abhijeet.yadav@fabhotels.com"<abhijeet.yadav@fabhotels.com>', 10, 62);

  let y = 74;
  doc.setFontSize(11);
  doc.text("To Whom It May Concern,", 10, y);
  y += 10;

  const body1 = `I, ${d.ownerName} owner of ${d.hotelName}, ${d.address}, hereby declare and authorize the appointment of Fabhotels (TRAVELSTACK TECH LIMITED) as the exclusive manager for the distribution of our inventory, rates, and hotel information on online sales channels in India, effective from the date of this letter.`;
  const lines1 = doc.splitTextToSize(body1, 180);
  doc.text(lines1, 10, y); y += lines1.length * 6 + 6;

  const body2 = "I confirm that I have terminated all contracts with any other Property Management Companies (PMCs) regarding the management of our online distribution.";
  const lines2 = doc.splitTextToSize(body2, 180);
  doc.text(lines2, 10, y); y += lines2.length * 6 + 6;

  const body3 = "Furthermore, I consent and agree that Fabhotels has the right to migrate reviews and ratings from any previous listings on Online Travel Agencies (OTAs) to new listings created under their management.";
  const lines3 = doc.splitTextToSize(body3, 180);
  doc.text(lines3, 10, y); y += lines3.length * 6 + 6;

  const body4 = `I hereby authorize Fabhotels to onboard ${d.hotelName} located in ${d.city} under their chain. This authorization is effective immediately and supersedes any prior agreements or arrangements.`;
  const lines4 = doc.splitTextToSize(body4, 180);
  doc.text(lines4, 10, y); y += lines4.length * 6 + 12;

  doc.text("Sincerely,", 10, y); y += 10;
  doc.text(d.ownerName, 10, y); y += 8;
  doc.text(d.ownerPhone, 10, y);

  doc.setFontSize(7);
  doc.line(10, 280, 200, 280);
  doc.text("https://mail.google.com/mail/u/1/?ik=4686ac7f4a&view=pt&search=all&permthid=thread-f:184261171941040118 4&simpl=msg-f:1832641951487446364   1/1", 10, 284);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFormat2(doc: any, d: FormData & { dateStr: string; dateDisplay: string; dateFwd: string }) {
  const fwdDateTime = `${d.dateDisplay.replace(" at 1:16 PM", "")} 3:59:35 PM +0530`;
  const topLeft = `${d.dateStr.split("-").reverse().join("/")}, 3:59 PM`;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(topLeft, 10, 12);
  doc.text(`Fwd: ${d.emailSubject}`, 105, 12, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Fwd: ${d.emailSubject}`, 10, 26);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Abhijeet Yadav", 200, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("< abhijeet.yadav@fabhotels.com >", 200, 28, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.rect(14, 36, 182, 50);

  let y = 44;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Abhijeet Yadav < abhijeet.yadav@fabhotels.com >", 18, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(fwdDateTime, 18, y); y += 8;
  doc.text('To "otateam"<otateam@fabhotels.com>', 22, y); y += 8;
  doc.text("Fyi", 18, y); y += 6;
  doc.text("Abhijeet Yadav", 18, y);

  y = 94;
  doc.text("============ Forwarded Message ============", 10, y); y += 6;
  doc.text(`From : ${d.ownerEmail}`, 10, y); y += 5;
  doc.text("To : abhijeet.yadav@fabhotels.com", 10, y); y += 5;
  doc.text(`Date : ${fwdDateTime}`, 10, y); y += 5;
  doc.text(`Subject : ${d.emailSubject}`, 10, y); y += 5;
  doc.text("============ Forwarded Message ============", 10, y); y += 8;

  doc.text("Subject: Authorization for Listing on OTA'S under FabHotels", 10, y); y += 6;
  doc.text("To Whom It May Concern,", 10, y); y += 8;

  doc.setFontSize(11);
  const body1 = `I, ${d.ownerName}, owner of ${d.hotelName}, located at ${d.address}, hereby confirm my association with FabHotels and list my property exclusively on OTA'S under FabHotels' management. FabHotels will handle the distribution of our inventory, rates, and hotel information on the OTA'S platform.`;
  const lines1 = doc.splitTextToSize(body1, 180);
  doc.text(lines1, 10, y); y += lines1.length * 6 + 6;

  const body2 = "I also request the removal of any parallel listings of my property on OTA'S, whether standalone or associated with other chains such as OYO or Treebo. Additionally, I request you to list my property under FabHotels on priority.";
  const lines2 = doc.splitTextToSize(body2, 180);
  doc.text(lines2, 10, y); y += lines2.length * 6 + 6;

  const body3 = "Furthermore, I consent to FabHotels migrating reviews and ratings from any previous listings on OTA'S to the new listing created under their management.";
  const lines3 = doc.splitTextToSize(body3, 180);
  doc.text(lines3, 10, y); y += lines3.length * 6 + 6;

  const body4 = "This authorization is effective immediately and supersedes any prior agreements or arrangements.";
  const lines4 = doc.splitTextToSize(body4, 180);
  doc.text(lines4, 10, y); y += lines4.length * 6 + 8;

  doc.setFont("helvetica", "bold");
  doc.text(d.ownerName, 10, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(d.ownerPhone, 10, y); y += 6;
  doc.text(d.hotelName, 10, y);

  doc.setFontSize(7);
  doc.line(10, 280, 200, 280);
  doc.text("about:blank   1/1", 10, 284);
}

export default function OcmGeneratorPage() {
  const [format, setFormat] = useState<Format>(1);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState<FormData>({
    ownerName: "",
    hotelName: "",
    address: "",
    city: "",
    authDate: today,
    ownerEmail: "",
    ownerPhone: "",
    emailSubject: "Letter of Authorization",
  });

  function set(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      await generatePdf(format, form);
    } finally {
      setGenerating(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0",
    borderRadius: 6, fontSize: 14, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", background: "#fff", color: "#1E293B",
  };
  const label: React.CSSProperties = {
    display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13, color: "#374151",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F6FA", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 40, maxWidth: 600, width: "100%" }}>

        {/* Header */}
        <div style={{ fontWeight: 800, fontSize: 28, color: "#1a1a4e", marginBottom: 2 }}>fabHOTELS</div>
        <h1 style={{ color: "#1a1a4e", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>OCM Generator</h1>
        <p style={{ color: "#64748B", fontSize: 13, marginBottom: 28 }}>Generate Owner Confirmation Mail (Letter of Authorization) PDFs</p>

        {/* Format selector */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {([1, 2] as Format[]).map(f => (
            <div
              key={f}
              onClick={() => setFormat(f)}
              style={{
                flex: 1, padding: "12px 14px", border: `2px solid ${format === f ? "#1a1a4e" : "#E2E8F0"}`,
                borderRadius: 8, cursor: "pointer", background: format === f ? "#f0f0ff" : "#fff",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a4e", marginBottom: 3 }}>Format {f}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                {f === 1 ? "Direct mail to FabHotels (TRAVELSTACK TECH LIMITED)" : "Forwarded mail (OTA listing, remove parallel listings)"}
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Owner Name</label>
            <input style={inp} placeholder="e.g. AJAY BASUDEO YADAV" value={form.ownerName} onChange={e => set("ownerName", e.target.value)} required />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Hotel Name</label>
            <input style={inp} placeholder="e.g. Hotel Byland International" value={form.hotelName} onChange={e => set("hotelName", e.target.value)} required />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={label}>Full Address</label>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 70 }} placeholder="Street, Area, City, State, Pincode" value={form.address} onChange={e => set("address", e.target.value)} required />
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>City (for onboarding)</label>
              <input style={inp} placeholder="e.g. Mumbai" value={form.city} onChange={e => set("city", e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Authorization Date</label>
              <input type="date" style={inp} value={form.authDate} onChange={e => set("authDate", e.target.value)} required />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Owner Email</label>
              <input type="email" style={inp} placeholder="owner@gmail.com" value={form.ownerEmail} onChange={e => set("ownerEmail", e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Owner Phone</label>
              <input type="tel" style={inp} placeholder="9987743404" value={form.ownerPhone} onChange={e => set("ownerPhone", e.target.value)} required />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={label}>Email Subject</label>
            <input style={inp} placeholder="e.g. Letter of Authorization" value={form.emailSubject} onChange={e => set("emailSubject", e.target.value)} required />
          </div>

          <button
            type="submit"
            disabled={generating}
            style={{
              width: "100%", padding: "14px", background: generating ? "#6B7280" : "#1a1a4e",
              color: "#fff", border: "none", borderRadius: 6, fontSize: 15,
              fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {generating ? "Generating..." : "Generate OCM PDF"}
          </button>
        </form>
      </div>
    </div>
  );
}
