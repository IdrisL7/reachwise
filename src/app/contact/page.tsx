"use client";

import { useState } from "react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mqedoejr";

export default function ContactPage() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (res.ok) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-[family-name:var(--font-geist-sans)]">
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-bold text-white">Get started with GetSignalHooks</h1>
        <p className="mt-4 text-zinc-400">
          Tell us a bit about how you&apos;re doing outbound today and we&apos;ll follow up with access
          and examples tailored to you.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {/* Formspree metadata */}
          <input
            type="hidden"
            name="_subject"
            value="New GetSignalHooks access request"
          />
          <input type="hidden" name="source" value="getsignalhooks-landing" />

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Name
              <input
                name="name"
                required
                className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Email
              <input
                type="email"
                name="email"
                required
                className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Role
              <select
                name="role"
                className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select one</option>
                <option>SDR</option>
                <option>BDR</option>
                <option>Founder</option>
                <option>Agency</option>
                <option>Other</option>
              </select>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Company / website
              <input
                name="company"
                className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              How are you doing outbound today?
              <textarea
                name="outbound_notes"
                rows={4}
                className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex h-[3rem] items-center justify-center rounded-lg bg-violet-600 px-6 text-sm font-semibold text-white shadow-[0_0_24px_rgba(139,92,246,0.25)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_36px_rgba(139,92,246,0.35)] disabled:opacity-60"
          >
            {status === "submitting" ? "Sending..." : "Get access"}
          </button>

          {status === "success" && (
            <p className="text-sm text-emerald-400 mt-2">
              Thanks for reaching out. We&apos;ll get back to you soon.
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-400 mt-2">
              Something went wrong sending your request. You can also email hello@getsignalhooks.com.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
