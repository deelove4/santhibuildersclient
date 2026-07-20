import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, ShieldCheck, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo className="h-9" />

        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-16 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" /> Enterprise Client Portal
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tighter md:text-6xl">
            Every stage of your build,
            <br />
            <span className="text-primary">in one calm workspace.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Track site progress, review drone photography, share documents and message your engineer — all
            from a private, secure portal built for Santhi Builders clients.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/auth">
                Access your project <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </motion.section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Building2,
              title: "12-stage timeline",
              body: "From site preparation to handover, every milestone updated live by your on-site engineer.",
            },
            {
              icon: LineChart,
              title: "Live progress",
              body: "Overall completion, stage-level progress, and health signals surfaced at a glance.",
            },
            {
              icon: ShieldCheck,
              title: "Private & secure",
              body: "Row-level security means clients only ever see their own villa, documents and updates.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Santhi Builders</span>
          <span className="font-mono uppercase tracking-widest">Client Portal v1.0</span>
        </div>
      </footer>
    </div>
  );
}
