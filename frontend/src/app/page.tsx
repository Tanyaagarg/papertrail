"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PIPELINE_URL =
  process.env.NEXT_PUBLIC_PIPELINE_URL ?? "http://localhost:8000";
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

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Returns a clean URL string if valid, or null if it isn't a real web address.
function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  // If they didn't type http:// or https://, assume https://
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    const looksReal = u.hostname === "localhost" || u.hostname.includes(".");
    if ((u.protocol === "http:" || u.protocol === "https:") && looksReal) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState<Source | null>(null);

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

    if (!label.trim()) {
      setFormError("Please add a label.");
      return;
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      setFormError("Please enter a valid URL, like https://example.com");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_URL}/users/${USER_ID}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, url: normalized }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not add that page.");
      }
      setLabel("");
      setUrl("");
      await loadSources();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not add that page."
      );
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

  async function confirmDelete() {
    const source = deleteTarget;
    if (!source) return;
    try {
      const res = await fetch(
        `${API_URL}/users/${USER_ID}/sources/${source.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Bad response");
      setSources((s) => s.filter((x) => x.id !== source.id));
      setChecks((c) => {
        const next = { ...c };
        delete next[source.id];
        return next;
      });
    } catch {
      // if it fails, we just close the box
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf6ea] text-stone-800">
      {/* Header */}
      <header className="border-b border-dashed border-stone-300/80 bg-[#f6efe0]/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-800 font-serif text-lg font-bold text-amber-50 shadow-sm">
              P
            </span>
            <div className="leading-tight">
              <div className="font-serif text-lg font-semibold tracking-tight text-stone-900">
                PaperTrail
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-stone-500">
                the fine print, watched
              </div>
            </div>
          </div>
          <span className="rounded-full border border-stone-300 bg-[#fffdf7] px-3 py-1 text-xs font-medium text-stone-600">
            {sources.length} on file
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-14 pb-8">
        <h1 className="font-serif text-[2.6rem] leading-tight font-semibold tracking-tight text-stone-900">
          Your change <span className="italic text-amber-700">feed</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-600">
          Terms, policies, and rules change quietly. PaperTrail reads the fine
          print for you — and says, in plain words, what changed and how it
          touches your life.
        </p>
        <div className="mt-6 h-px w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,#d6c9ad_6px,#d6c9ad_12px)]" />
      </section>

      {/* Add-a-page form */}
      <section className="mx-auto max-w-4xl px-6 pb-10">
        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-stone-300 bg-[#fffdf7] p-6 shadow-[0_2px_10px_rgba(120,90,40,0.06)]"
        >
          <h2 className="font-serif text-base font-semibold text-stone-900">
            Add a page to watch
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Paste any link with fine print — a policy, terms, or rules page.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Netflix ToS)"
              className="flex-1 rounded-md border border-stone-300 bg-[#fbf8f0] px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:ring-4 focus:ring-amber-600/10"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="flex-[2] rounded-md border border-stone-300 bg-[#fbf8f0] px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:ring-4 focus:ring-amber-600/10"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-800 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-sm transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Spinner /> : null}
              {submitting ? "Filing…" : "Add page"}
            </button>
          </div>
          {formError && (
            <p className="mt-3 text-sm text-red-700">{formError}</p>
          )}
        </form>
      </section>

      {/* Feed */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Spinner /> Opening your files…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && sources.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-[#fffdf7]/70 p-12 text-center">
            <div className="mx-auto mb-3 text-4xl">📜</div>
            <p className="font-serif font-medium text-stone-700">
              Nothing on file yet
            </p>
            <p className="mt-1 text-sm text-stone-400">
              Add a page above to start watching its fine print.
            </p>
          </div>
        )}

        {!loading && !error && sources.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {sources.map((source) => {
              const check = checks[source.id];
              const host = hostnameOf(source.url);
              return (
                <article
                  key={source.id}
                  className="flex flex-col rounded-lg border border-stone-300 bg-[#fffdf7] p-5 shadow-[0_2px_10px_rgba(120,90,40,0.06)] transition hover:shadow-[0_6px_20px_rgba(120,90,40,0.12)]"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-300 bg-[#fbf8f0]">
                      {host ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
                          alt=""
                          className="h-5 w-5"
                        />
                      ) : (
                        <span className="text-sm">🔗</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif font-semibold leading-snug text-stone-900">
                        {source.label}
                      </h3>
                      <p className="truncate text-xs text-stone-500">
                        {source.url}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(source)}
                      title="Stop watching this page"
                      aria-label="Delete"
                      className="-mr-1 shrink-0 rounded-md p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs italic text-stone-400">
                      Filed {new Date(source.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleCheck(source)}
                      disabled={check?.loading}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {check?.loading && <Spinner />}
                      {check?.loading ? "Reading…" : "Check for changes"}
                    </button>
                  </div>

                  {check?.error && (
                    <p className="mt-4 text-sm text-red-700">{check.error}</p>
                  )}

                  {check && !check.loading && !check.error && (
                    <div className="mt-4 space-y-3 border-t border-dashed border-stone-300 pt-4">
                      {check.status === "first" && (
                        <StatusPill color="stone" label="📋 Key points" />
                      )}
                      {check.status === "no_change" && (
                        <StatusPill
                          color="green"
                          label="✅ No changes since last check"
                        />
                      )}
                      {check.status === "changed" && (
                        <StatusPill color="amber" label="🔔 Change detected" />
                      )}

                      {check.status === "changed" && check.explanation && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3.5 text-sm leading-relaxed text-stone-800 whitespace-pre-line">
                          {check.explanation}
                        </div>
                      )}

                      {check.summary && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                            {check.status === "changed"
                              ? "Current summary"
                              : "Summary"}
                          </p>
                          <div className="rounded-md border border-stone-200 bg-[#fbf8f0] p-3.5 text-sm leading-relaxed text-stone-700 whitespace-pre-line">
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

      <footer className="border-t border-dashed border-stone-300/80 py-6">
        <p className="text-center font-serif text-xs italic text-stone-400">
          PaperTrail — reads the fine print so you don&apos;t have to.
        </p>
      </footer>
      {/* Delete confirmation box */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-stone-300 bg-[#fffdf7] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-semibold text-stone-900">
              Stop watching this page?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              &ldquo;{deleteTarget.label}&rdquo; will be removed from your
              files. You can always add it again later.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusPill({
  color,
  label,
}: {
  color: "stone" | "green" | "amber";
  label: string;
}) {
  const styles = {
    stone: "bg-stone-200 text-stone-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-200 text-amber-900",
  }[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}
