import React from "react";
import PumpForgeLoadingScreen from "./PumpForgeLoadingScreen";

export function SkeletonLoader({ type }: { type?: "list" | "portfolio" | "chart" | "dashboard" }) {
  const labelMap = {
    list: "Loading live market items...",
    portfolio: "Retrieving user portfolio & balances...",
    chart: "Streaming candlestick intervals...",
    dashboard: "Loading terminal data...",
  };

  return (
    <PumpForgeLoadingScreen
      variant="inline"
      message={type ? labelMap[type] : "Loading live data..."}
    />
  );
}


