import React, { useState, useEffect } from "react";
import { Bell, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { NotificationItem } from "../types";

interface NotificationsTabProps {
  notifications: NotificationItem[];
}

export default function NotificationsTab({
  notifications,
}: NotificationsTabProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated skeleton loader for professional vibe as seen in the video
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div
        className="flex-1 flex flex-col gap-5 select-none"
        id="notifications-skeleton"
      >
        <div className="flex flex-col gap-1">
          <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-zinc-900 rounded animate-pulse mt-1" />
        </div>
        <div className="flex flex-col gap-3 mt-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-9 h-9 rounded-xl bg-zinc-850 animate-pulse" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3 w-1/4 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-zinc-850 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-10 bg-zinc-900 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback notifications if none exist
  const displayNotifications =
    notifications.length > 0
      ? notifications
      : [
          {
            id: "n1",
            title: "Welcome to PumpForge!",
            message:
              "Explore the workspace, trade meme coins, and avoid being crashed!",
            timestamp: "Just now",
            type: "info" as const,
          },
          {
            id: "n2",
            title: "First Steps",
            message: "You received $5,000 startup credits. Go buy some ROAD!",
            timestamp: "2m ago",
            type: "info" as const,
          },
        ];

  const getIcon = (type: string) => {
    switch (type) {
      case "trade":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case "crash":
        return (
          <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
        );
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div
      className="flex-1 flex flex-col gap-6 animate-fade-in"
      id="notifications-tab-view"
    >
      <div className="flex flex-col">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Bell className="w-5 h-5 text-rose-500" /> Notifications
        </h2>
        <p className="text-xs text-zinc-400 font-mono tracking-wide mt-0.5">
          Stay updated with your activities
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {displayNotifications.map((n) => (
          <div
            key={n.id}
            className="glass-card border border-white/10 hover:border-white/20 p-4 rounded-2xl flex items-start justify-between gap-4 transition-all shadow-sm"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl glass-card border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                {getIcon(n.type)}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-zinc-100">
                  {n.title}
                </span>
                <span className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                  {n.message}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono shrink-0 pt-0.5">
              {n.timestamp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
