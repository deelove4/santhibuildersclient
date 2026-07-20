import logo from "@/assets/santhi-logo.png.asset.json";
import favicon from "@/assets/favicon.jpeg.asset.json";
import { cn } from "@/lib/utils";

/** Full horizontal logo (icon + wordmark). */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Santhi Builders — Idea to Identity"
      className={cn("h-8 w-auto object-contain select-none", className)}
      draggable={false}
    />
  );
}

/** Square icon mark only (uses the standalone building icon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={favicon.url}
      alt="Santhi Builders"
      className={cn("h-8 w-8 rounded-lg object-contain select-none", className)}
      draggable={false}
    />
  );
}
