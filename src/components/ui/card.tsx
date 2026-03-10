interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient?: boolean;
}

export function Card({ gradient, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border ${
        gradient
          ? "border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
          : "border-zinc-800 bg-zinc-900"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
