const API_BASE_URL = process.env.MMT_HYGIENE_API_BASE_URL;
const API_KEY = process.env.MMT_HYGIENE_API_KEY;

type Endpoint = {
  title: string;
  path: string;
  params?: Record<string, string>;
  description: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    title: "Guest reviews (list)",
    path: "/api/reviews/reviews.php",
    params: { action: "list", limit: "10" },
    description: "Recent guest feedback filtered by MMT filters (optional query keys such as hotel_code, rating).",
  },
  {
    title: "Review stats",
    path: "/api/reviews/reviews.php",
    params: { action: "stats" },
    description: "Totals and average rating, scoped by hotel_code when present.",
  },
  {
    title: "Rating summary",
    path: "/api/reviews/ratings.php",
    params: { action: "summary" },
    description: "Latest rating snapshots broken down by hotel and platform (filter by city when needed).",
  },
  {
    title: "Analytics overview",
    path: "/api/analytics/summary.php",
    params: { action: "overview" },
    description: "High-level MMT analytics overview.",
  },
];

async function callMMTApi(endpoint: Endpoint) {
  if (!API_BASE_URL) return null;

  const url = new URL(`${API_BASE_URL}${endpoint.path}`);
  Object.entries(endpoint.params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString(), {
    cache: "no-cache",
    headers: {
      Accept: "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${endpoint.title}: ${response.status} ${response.statusText} — ${body}`);
  }

  return response.json();
}

function trimJson(value: unknown) {
  try {
    const raw = JSON.stringify(value, null, 2) ?? "";
    if (raw.length <= 1200) return raw;
    return `${raw.slice(0, 1200)}\n…(truncated)`;
  } catch {
    return "";
  }
}

export default async function Page() {
  const data = await Promise.all(
    ENDPOINTS.map(async (endpoint) => {
      try {
        return {
          endpoint,
          payload: await callMMTApi(endpoint),
        };
      } catch (error) {
        return { endpoint, error: error instanceof Error ? error.message : "Unknown error" };
      }
    }),
  );

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }}>MMT Hygiene · Review snapshots</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
          Calls the three review endpoints and surfaces the overall listing + stats payloads for quick debugging.
          {" "}
          {API_BASE_URL ? "Uses the configured base URL." : "Set `MMT_HYGIENE_API_BASE_URL` to enable the live call."}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#94A3B8" }}>
          Authorization {" "}
          <strong style={{ color: API_KEY ? "#047857" : "#DC2626" }}>
            {API_KEY ? "configured" : "missing"}
          </strong>
        </div>
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        {data.map(({ endpoint, payload, error }) => (
          <section
            key={endpoint.title}
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #E2E8F0",
              padding: "18px 22px",
              boxShadow: "0 12px 38px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{endpoint.title}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{endpoint.description}</div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: payload ? "#047857" : error ? "#DC2626" : "#94A3B8",
                }}
              >
                {payload ? "Success" : error ? "Error" : "Skipped"}
              </span>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 12,
                color: "#0F172A",
                whiteSpace: "pre-wrap",
                fontFamily: "Consolas, Menlo, monospace",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {error ? error : payload ? trimJson(payload) : "Call skipped (missing base URL)"}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
