// Sections fade up as they scroll into view.
//
// Rendered visible on the server (2026-11-18 review, item 17): it used to start
// at opacity 0 and wait for framer-motion to load, so a slow phone saw a blank
// page, and nothing at all showed if the scripts failed. Now the small inline
// script in app/layout.tsx marks the page and reveals each section as it comes
// into view; CSS in styles/globals.css does the fade, shows everything after 2.5
// seconds regardless, and skips it all with Reduce Motion.

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "none";
}

export default function FadeIn({ children, delay = 0, className, direction = "up" }: FadeInProps) {
  return (
    <div
      className={["fade-in", direction === "up" ? "fade-up" : "", className ?? ""].filter(Boolean).join(" ")}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      // The inline script adds "in" before React hydrates
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
