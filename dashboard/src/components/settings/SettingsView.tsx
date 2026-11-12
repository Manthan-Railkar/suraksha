"use client";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Settings,
  User,
  Moon,
  Sun,
  Bell,
  ShieldCheck,
  Check,
  Cpu,
  Laptop,
  Sliders,
  Terminal,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Split from "@/components/ui/Split";
import Avatar from "@/components/ui/Avatar";
import { usePageEntrance } from "@/lib/entrance";
import { useTheme } from "@/lib/theme-context";
import { useActiveDevice } from "@/lib/device-context";
import { notify } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

export default function SettingsView() {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref);
  const { theme, toggleTheme } = useTheme();
  const { deviceId } = useActiveDevice();

  const [soundAlerts, setSoundAlerts] = useState(true);
  const [criticalPush, setCriticalPush] = useState(true);
  const [autoAckNormal, setAutoAckNormal] = useState(false);

  const handleSave = () => {
    notify({
      title: "Settings synchronized",
      description: "Suraksha system preferences saved.",
      type: "success",
    });
  };

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[16px] w-full">
          <div>
            <h1 className="font-display text-[31px] font-normal leading-none tracking-[-0.8px] text-ink">
              <Split label="System Settings">System Settings</Split>
            </h1>
            <p data-fill className="mt-[10px] text-[11px] text-muted">
              Configure Suraksha hardware parameters, monitoring thresholds, operator profile and display preferences.
            </p>
          </div>

          <div data-fill className="flex items-center gap-[10px]">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSave}
              className="flex h-[32px] items-center gap-[6px] rounded-full bg-forest-2 dark:bg-mint px-[16px] text-[11px] font-medium text-white dark:text-forest shadow-sm"
            >
              <Check size={13} />
              <span>Save Changes</span>
            </motion.button>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {/* Section 1: Appearance & Theme */}
          <Card className="p-[20px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-[10px] mb-[14px]">
                <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-mint-2/70 dark:bg-mint-3/20 text-forest-2 dark:text-mint">
                  <Sun size={16} />
                </span>
                <div>
                  <h3 className="text-[13.5px] font-medium text-ink">Appearance & Theme</h3>
                  <p className="text-[10px] text-muted">Choose your preferred visual aesthetic</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-[12px] mt-[16px]">
                {/* Light Mode Option */}
                <button
                  onClick={() => {
                    if (theme === "dark") {
                      toggleTheme();
                      notify({ title: "Light mode enabled", type: "info" });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-[10px] rounded-[14px] p-[16px] border text-center transition-all",
                    theme === "light"
                      ? "border-forest-2 dark:border-mint bg-mint-2/30 shadow-sm"
                      : "border-black/[.08] dark:border-white/[.1] hover:bg-black/[.02]"
                  )}
                >
                  <Sun size={24} className={theme === "light" ? "text-forest" : "text-muted"} />
                  <div>
                    <p className="text-[12px] font-medium text-ink">Light Mode</p>
                    <p className="text-[9.5px] text-muted">Crisp mint & paper white</p>
                  </div>
                  {theme === "light" && (
                    <span className="h-[6px] w-[6px] rounded-full bg-forest-2" />
                  )}
                </button>

                {/* Dark Mode Option */}
                <button
                  onClick={() => {
                    if (theme === "light") {
                      toggleTheme();
                      notify({ title: "Dark mode enabled", type: "info" });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-[10px] rounded-[14px] p-[16px] border text-center transition-all",
                    theme === "dark"
                      ? "border-mint bg-mint-3/15 shadow-sm"
                      : "border-black/[.08] dark:border-white/[.1] hover:bg-white/[.04]"
                  )}
                >
                  <Moon size={24} className={theme === "dark" ? "text-mint" : "text-muted"} />
                  <div>
                    <p className="text-[12px] font-medium text-ink">Dark Mode</p>
                    <p className="text-[9.5px] text-muted">Deep emerald & forest glow</p>
                  </div>
                  {theme === "dark" && (
                    <span className="h-[6px] w-[6px] rounded-full bg-mint" />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-[18px] text-[10.5px] text-muted">
              Theme can also be toggled instantly with the sun/moon icon in the left sidebar or the search palette (Ctrl+K).
            </p>
          </Card>

          {/* Section 2: Operator Identity */}
          <Card className="p-[20px]">
            <div className="flex items-center gap-[10px] mb-[16px]">
              <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-mint-2/70 dark:bg-mint-3/20 text-forest-2 dark:text-mint">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-medium text-ink">Security Operator Identity</h3>
                <p className="text-[10px] text-muted">Session credentials for dashboard authentication</p>
              </div>
            </div>

            <div className="flex items-center gap-[14px] p-[12px] rounded-[12px] bg-black/[.03] dark:bg-white/[.05] mb-[16px]">
              <Avatar name="Admin Operator" size={46} />
              <div>
                <h4 className="text-[13px] font-medium text-ink">Security Administrator</h4>
                <p className="text-[10.5px] text-muted">Active Role: System Controller & Incident Response</p>
                <p className="text-[10px] text-mint">Primary Device: {deviceId}</p>
              </div>
            </div>

            <div className="space-y-[10px]">
              <div>
                <label className="text-[10.5px] font-medium text-muted">Operator Username</label>
                <input
                  readOnly
                  value="admin"
                  className="mt-[4px] w-full rounded-[10px] bg-white/70 dark:bg-white/[.08] px-[12px] py-[8px] text-[11.5px] text-ink outline-none border border-black/[.08] dark:border-white/[.1] cursor-not-allowed opacity-80"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-medium text-muted">Authentication Mode</label>
                <input
                  readOnly
                  value="HMAC-SHA256 Token Session (12h TTL)"
                  className="mt-[4px] w-full rounded-[10px] bg-white/70 dark:bg-white/[.08] px-[12px] py-[8px] text-[11.5px] text-ink outline-none border border-black/[.08] dark:border-white/[.1] cursor-not-allowed opacity-80"
                />
              </div>
            </div>
          </Card>

          {/* Section 3: Sensor Parameters & Firmware Tunables */}
          <Card className="p-[20px]">
            <div className="flex items-center gap-[10px] mb-[16px]">
              <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-mint-2/70 dark:bg-mint-3/20 text-forest-2 dark:text-mint">
                <Sliders size={16} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-medium text-ink">Security Logic & Tunables</h3>
                <p className="text-[10px] text-muted">Active logic parameters running on Core 1 firmware</p>
              </div>
            </div>

            <div className="space-y-[9px] text-[11.5px]">
              <div className="flex justify-between border-b border-black/[.05] dark:border-white/[.07] pb-2">
                <span className="text-muted">Door Debounce Filter</span>
                <span className="font-mono text-ink">50 ms</span>
              </div>
              <div className="flex justify-between border-b border-black/[.05] dark:border-white/[.07] pb-2">
                <span className="text-muted">Knock Detection Window</span>
                <span className="font-mono text-ink">10,000 ms</span>
              </div>
              <div className="flex justify-between border-b border-black/[.05] dark:border-white/[.07] pb-2">
                <span className="text-muted">Repeated Vibration Threshold</span>
                <span className="font-mono text-ink">3 knocks (Warning)</span>
              </div>
              <div className="flex justify-between border-b border-black/[.05] dark:border-white/[.07] pb-2">
                <span className="text-muted">Vibration-Then-Door Combo Window</span>
                <span className="font-mono text-ink">10,000 ms (High Alert)</span>
              </div>
              <div className="flex justify-between border-b border-black/[.05] dark:border-white/[.07] pb-2">
                <span className="text-muted">Alarm Auto-Silence Timeout</span>
                <span className="font-mono text-ink">60,000 ms</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted">Heartbeat & Status Interval</span>
                <span className="font-mono text-ink">5,000 ms (15s offline trigger)</span>
              </div>
            </div>
          </Card>

          {/* Section 4: Hardware & Simulation Pinout */}
          <Card className="p-[20px]">
            <div className="flex items-center gap-[10px] mb-[16px]">
              <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-mint-2/70 dark:bg-mint-3/20 text-forest-2 dark:text-mint">
                <Cpu size={16} />
              </span>
              <div>
                <h3 className="text-[13.5px] font-medium text-ink">ESP32 Pinout & Sensor Wiring</h3>
                <p className="text-[10px] text-muted">Hardware mapping for physical & Wokwi simulation</p>
              </div>
            </div>

            <div className="space-y-[8px] text-[11px]">
              <div className="flex justify-between items-center rounded-lg bg-black/[.03] dark:bg-white/[.04] p-2">
                <div>
                  <span className="font-semibold text-ink">Reed Switch (Door)</span>
                  <p className="text-[9.5px] text-muted">Contact closed = LOW (Closed), Open = HIGH</p>
                </div>
                <span className="font-mono text-mint bg-mint/10 px-2 py-0.5 rounded text-[11px]">GPIO 32</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-black/[.03] dark:bg-white/[.04] p-2">
                <div>
                  <span className="font-semibold text-ink">Vibration Sensor (Knock)</span>
                  <p className="text-[9.5px] text-muted">SW-420 digital pulse trigger (Active HIGH)</p>
                </div>
                <span className="font-mono text-mint bg-mint/10 px-2 py-0.5 rounded text-[11px]">GPIO 23</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-black/[.03] dark:bg-white/[.04] p-2">
                <div>
                  <span className="font-semibold text-ink">Analog UV Sensor (Telemetry)</span>
                  <p className="text-[9.5px] text-muted">Environmental ADC input (0-3.3V, 0-15 Index)</p>
                </div>
                <span className="font-mono text-mint bg-mint/10 px-2 py-0.5 rounded text-[11px]">GPIO 35</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-black/[.03] dark:bg-white/[.04] p-2">
                <div>
                  <span className="font-semibold text-ink">Active Buzzer</span>
                  <p className="text-[9.5px] text-muted">Alarm and chirp patterns (Active HIGH)</p>
                </div>
                <span className="font-mono text-mint bg-mint/10 px-2 py-0.5 rounded text-[11px]">GPIO 15</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-black/[.03] dark:bg-white/[.04] p-2">
                <div>
                  <span className="font-semibold text-ink">Armed LED / Alarm LED</span>
                  <p className="text-[9.5px] text-muted">Armed indicator (Green) / Alarm active (Red)</p>
                </div>
                <span className="font-mono text-mint bg-mint/10 px-2 py-0.5 rounded text-[11px]">GPIO 27 / 14</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
