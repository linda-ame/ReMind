import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      variant = 'primary',
      fullWidth = true,
      className = '',
      type = 'button',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`btn btn-${variant}${fullWidth ? ' btn-full' : ''} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
