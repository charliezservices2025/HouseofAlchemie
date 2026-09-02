import Link from "next/link";

/**
 * The House wordmark. The macron on the final e is part of the brand and is
 * rendered as text so it scales with the user's chosen type.
 */
export function Wordmark({ href = "/advisors", size = "md", className = "" }: { href?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" } as const;
  return (
    <Link href={href} className={`font-display ${sizes[size]} tracking-tight text-ink no-underline ${className}`} aria-label="House of Alchemie">
      House of Alchemi<span aria-hidden="true">ē</span>
    </Link>
  );
}
