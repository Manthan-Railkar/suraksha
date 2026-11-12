"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Lock, ShieldCheck } from "lucide-react";
import { login } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/components/ui/Toast";

export default function LoginView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(username, password);
      refresh();
      notify({ title: "Signed in", description: "Welcome back to Suraksha.", type: "success" });
      router.replace("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center px-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="card w-full max-w-[360px] p-[28px]"
      >
        <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] bg-forest-2 dark:bg-mint text-white dark:text-forest">
          <ShieldCheck size={20} />
        </div>
        <h1 className="mt-[16px] font-display text-[22px] font-medium tracking-[-0.3px] text-ink">
          Sign in to Suraksha
        </h1>
        <p className="mt-[4px] text-[11px] text-muted">Monitor and arm your door from anywhere.</p>

        <div className="mt-[20px] flex flex-col gap-[10px]">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="h-[42px] rounded-[12px] bg-black/[.04] dark:bg-white/[.08] px-[14px] text-[13px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-mint/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-[42px] rounded-[12px] bg-black/[.04] dark:bg-white/[.08] px-[14px] text-[13px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-mint/60"
          />
        </div>

        {error && (
          <p className="mt-[12px] text-[11px] text-red-500 flex items-center gap-[6px]">
            <Lock size={12} /> {error}
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={pending}
          className="mt-[18px] h-[42px] w-full rounded-full bg-forest-2 dark:bg-mint text-[13px] font-medium text-white dark:text-forest disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </motion.button>
      </motion.form>
    </div>
  );
}
