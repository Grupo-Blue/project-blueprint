import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "lg";
  glow?: "cyan" | "amber" | "mint" | "none";
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", glow = "none", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "lg" ? "glass-card-lg" : "glass-card",
          glow === "cyan" && "glow-cyan",
          glow === "amber" && "glow-amber",
          glow === "mint" && "glow-mint",
          "p-5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
