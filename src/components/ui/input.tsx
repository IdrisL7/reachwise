import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-sm text-zinc-400 mb-1.5">{label}</label>
        )}
        <input
          ref={ref}
          className={`w-full bg-black border rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors ${
            error ? "border-red-600 focus:border-red-500 focus:ring-red-500/40" : "border-zinc-700"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
