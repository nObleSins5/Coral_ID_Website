import "./tailwind.css";

export default function RedesignLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="redesign-root">{children}</div>;
}
