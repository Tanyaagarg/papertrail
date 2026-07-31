"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";
const USER_ID = 1;

type Source = {
  id: number;
  label: string;
  url: string;
  createdAt: string;
};

type CheckResult = {
  loading?: boolean;
  error?: string;
  status?: "first" | "no_change" | "changed";
  summary?: string;
  explanation?: string | null;
};

export default function Home() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<string>("");

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [checks, setChecks] = useState<Record<number, CheckResult>>({});

  async function loadSources() {
    try {
      const res = await fetch(`${API_URL}/users/${USER_ID}/sources`);
      if (!res.ok) throw new Error("Bad response");
      setSources(await res.json());
      setError(null);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const res = await fetch(`${API_URL}/users/${USER_ID}/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.description ?? "");
      }
    } catch {
      // no profile yet — fine
    }
  }

  useEffect(() => {
    loadSources();
    loadProfile();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !url.trim()) {
      setFormError("Please fill in both a label and a URL.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_URL}/users/${USER_ID}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url }),
      });
      if (!res.ok) throw new Error("Bad response");
      setLabel("");
      setUrl("");
      await loadSources();
    } catch {
      setFormError("Could not add that page. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheck(source: Source) {
    setChecks((c) => ({ ...c, [source.id]: { loading: true } }));
    try {
      const res = await fetch(`${PIPELINE_URL}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: source.url, profile }),
      });
      const data = await res.json();
      setChecks((c) => ({ ...c, [source.id]: { loading: false, ...data } }));
    } catch {
      setChecks((c) => ({
        ...c,
        [source.id]: {
          loading: false,
          error: "Check failed. Are the pipeline and Docker running?",
        },
      }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="text-lg font-semibold tracking-tight">PaperTrail</span>
          </div>
          <span className="hidden text-sm text-slate-500 sm:block">
            Watching your fine print
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Your change feed</h1>
        <p className="mt-2 text-slate-600">
          The fine print you follow — and what quietly changed.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-8">
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-medium text-slate-700">Watch a new page</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Netflix ToS)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="flex-[2] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Add page"}
            </button>
          </div>
          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}
        </form>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">No pages yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Add one above to start watching its fine print.
            </p>
          </div>
        )}

        {!loading && !error && sources.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {sources.map((source) => {
              const check = checks[source.id];
              return (
                <article
                  key={source.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug">{source.label}</h3>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">{source.url}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    Added {new Date(source.createdAt).toLocaleDateString()}
                  </p>

                  <button
                    onClick={() => handleCheck(source)}
                    disabled={check?.loading}
                    className="mt-4 self-start rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {check?.loading ? "Reading the page…" : "Check for changes"}
                  </button>

                  {check?.error && (
                    <p className="mt-3 text-sm text-red-600">{check.error}</p>
                  )}

                  {check && !check.loading && !check.error && (
                    <div className="mt-4 space-y-3">
                      {check.status === "first" && <StatusPill color="sky" label="📋 Key points" />}
                      {check.status === "no_change" && (
                        <StatusPill color="emerald" label="✅ No changes since last check" />
                      )}
                      {check.status === "changed" && (
                        <StatusPill color="amber" label="🔔 Change detected!" />
                      )}

                      {/* When changed, show the explanation prominently */}
                      {check.status === "changed" && check.explanation && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                          {check.explanation}
                        </div>
                      )}

                      {/* The page summary (always available) */}
                      {check.summary && (
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                            {check.status === "changed" ? "Current summary" : "Summary of this page"}
                          </p>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                            {check.summary}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

// A small colored status label.
function StatusPill({
  color,
  label,
}: {
  color: "sky" | "emerald" | "amber";
  label: string;
}) {
  const styles = {
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  }[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}