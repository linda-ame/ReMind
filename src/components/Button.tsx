import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant =
  | 'primary'
  | 'secondary'
  | 'selected'
  | 'success'
  | 'help'
  | 'danger'
  | 'neutral';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  fullWidth = true,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${fullWidth ? ' btn-full' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
