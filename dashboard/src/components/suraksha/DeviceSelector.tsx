"use client";
import { useState } from "react";
import { ChevronDown, Cpu, Laptop, Radio } from "lucide-react";
import { useActiveDevice } from "@/lib/device-context";
import { cn } from "@/lib/cn";

export default function DeviceSelector({ className }: { className?: string }) {
  const { deviceId, setDeviceId, devices } = useActiveDevice();
  const [open, setOpen] = useState(false);

  // Pre-seed known devices if not yet registered in DB
  const knownDevices = devices.length > 0 ? devices : [
    {
      device_id: "suraksha-esp32-01",
      device_name: "Physical ESP32 Board",
      firmware_version: "suraksha-fw-0.2.0",
      last_seen_at: null,
      is_online: false,
      seconds_since_seen: null,
      mode: null,
      door_state: null,
      vibration_state: null,
      alarm_active: false,
      proximity_cm: null,
      uv_index: null,
      updated_at: null,
    },
    {
      device_id: "suraksha-wokwi-01",
      device_name: "Wokwi Simulation",
      firmware_version: "suraksha-fw-0.2.0-wokwi",
      last_seen_at: null,
      is_online: false,
      seconds_since_seen: null,
      mode: null,
      door_state: null,
      vibration_state: null,
      alarm_active: false,
      proximity_cm: null,
      uv_index: null,
      updated_at: null,
    },
  ];

  const current = knownDevices.find((d) => d.device_id === deviceId) ?? {
    device_id: deviceId,
    device_name: deviceId.includes("wokwi") || deviceId.includes("sim") ? "Simulated ESP32" : "Physical ESP32",
    is_online: false,
  };

  const isSim = current.device_id.includes("wokwi") || current.device_id.includes("sim");

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-[32px] items-center gap-[8px] rounded-full border border-forest-border/40 bg-[#071f19]/80 px-[12px] py-[4px] text-[11px] font-medium text-white shadow-sm backdrop-blur-md transition-all hover:border-mint/40 dark:bg-[#03140f]/80"
      >
        <span className="flex h-2 w-2 relative">
          {current.is_online && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              current.is_online ? "bg-mint" : "bg-neutral-500"
            )}
          />
        </span>

        {isSim ? <Laptop size={13} className="text-mint" /> : <Cpu size={13} className="text-mint" />}

        <span className="font-semibold text-[#e8f6f1]">{current.device_id}</span>
        <span className="text-[10px] text-muted hidden sm:inline">
          ({isSim ? "Simulation" : "Physical"})
        </span>

        <ChevronDown size={12} className={cn("text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[240px] overflow-hidden rounded-[14px] border border-forest-border/50 bg-[#071f19]/95 p-1 shadow-2xl backdrop-blur-xl dark:bg-[#03140f]/95 dark:border-mint/30">
            <div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase tracking-wider text-muted font-medium">
              Connected Devices
            </div>
            <div className="py-1">
              {knownDevices.map((d) => {
                const sim = d.device_id.includes("wokwi") || d.device_id.includes("sim");
                const selected = d.device_id === deviceId;
                return (
                  <button
                    key={d.device_id}
                    onClick={() => {
                      setDeviceId(d.device_id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[11.5px] transition-colors",
                      selected ? "bg-forest-card text-white font-medium" : "text-[#86b0a3] hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          d.is_online ? "bg-mint" : "bg-neutral-500"
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{d.device_id}</span>
                          {selected && (
                            <span className="text-[9px] bg-mint/20 text-mint px-1.5 py-0.2 rounded">
                              active
                            </span>
                          )}
                        </div>
                        <p className="text-[9.5px] text-muted">
                          {sim ? "Virtual (Wokwi / Sim)" : "Physical Hardware"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

