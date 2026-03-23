import React from "react";

export enum ButtonVariant {
  Primary = "primary",
  Secondary = "secondary",
  Tertiary = "tertiary",
  Danger = "danger",
  Warning = "warning",
}

// Fix: Explicitly added className, type, and onClick to interface to resolve TS errors where extends might be insufficient
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  icon?: React.ReactNode; // New prop for icons
  disabled?: boolean;
}

export default function Button({
  text,
  variant = ButtonVariant.Primary,
  isLoading,
  className,
  disabled = false,
  icon = null,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  let variantStyles = "";
  switch (variant) {
    case ButtonVariant.Primary:
      variantStyles = "bg-primary text-white hover:bg-secondary";
      break;
    case ButtonVariant.Secondary:
      variantStyles = "bg-secondary text-text hover:bg-opacity-80";
      break;
    case ButtonVariant.Tertiary:
      variantStyles = "bg-ui text-text border border-gray-200 hover:bg-gray-200";
      break;
    case ButtonVariant.Danger:
      variantStyles = "bg-red-500 text-white hover:bg-red-600";
      break;
    case ButtonVariant.Warning:
      variantStyles = "bg-amber-500 text-white hover:bg-amber-600";
      break;
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className || ""}`} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-5 w-5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : icon ? (
        <span className={`${text ? "mr-2" : ""} flex items-center`}>{icon}</span>
      ) : null}
      {text}
    </button>
  );
}