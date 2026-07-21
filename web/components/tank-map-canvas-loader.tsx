"use client";

// next/dynamic with { ssr: false } is only allowed inside a Client
// Component in this Next.js version — app/tank/[id]/page.tsx is a Server
// Component, so the dynamic() call has to live here instead and get
// imported as a normal (server-importable) client component.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TankMapCanvas as TankMapCanvasType } from "@/components/tank-map-canvas";

const TankMapCanvas = dynamic(
  () => import("@/components/tank-map-canvas").then((m) => m.TankMapCanvas),
  { ssr: false, loading: () => <p className="muted">Loading map…</p> },
);

export function TankMapCanvasLoader(props: ComponentProps<typeof TankMapCanvasType>) {
  return <TankMapCanvas {...props} />;
}
