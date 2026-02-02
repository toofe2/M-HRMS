import React, { useMemo, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const cx = (...classes: Array<string | false | undefined | null>) => classes.filter(Boolean).join(' ');

export const Card = ({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) => (
  <div className={cx('bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden', className)}>
    <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
      <div className="font-semibold text-gray-900">{title}</div>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

type ButtonBaseProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
  iconOnly?: boolean;
};

const ButtonBase = ({
  children,
  onClick,
  disabled,
  loading,
  type = 'button',
  className,
  title,
  iconOnly,
  variant,
}: ButtonBaseProps & { variant: 'primary' | 'secondary' | 'danger' }) => {
  const isDisabled = !!disabled || !!loading;

  const base =
    'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 disabled:opacity-60 disabled:cursor-not-allowed';

  const variantClass =
    variant === 'primary'
      ? 'bg-gray-900 text-white hover:bg-gray-800 border border-gray-900'
      : variant === 'secondary'
      ? 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
      : 'bg-white text-red-700 hover:bg-red-50 border border-red-200';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-busy={loading ? 'true' : undefined}
      className={cx(base, variantClass, iconOnly && 'px-2', className)}
    >
      {loading ? <ReloadIcon spinning /> : null}
      {children}
    </button>
  );
};

export const PrimaryButton = (props: ButtonBaseProps) => <ButtonBase {...props} variant="primary" />;
export const SecondaryButton = (props: ButtonBaseProps) => <ButtonBase {...props} variant="secondary" />;
export const DangerButton = (props: ButtonBaseProps) => <ButtonBase {...props} variant="danger" />;

export const InlineStatus = ({
  error,
  ok,
  className,
}: {
  error?: string | null;
  ok?: string | null;
  className?: string;
}) => {
  if (!error && !ok) return null;

  const isError = !!error;
  return (
    <div
      className={cx(
        'rounded-md border px-4 py-3',
        isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700',
        className
      )}
      role="status"
    >
      <div className="text-sm">{error || ok}</div>
    </div>
  );
};

export const ReloadIcon = ({ spinning }: { spinning?: boolean }) => (
  <RefreshCw className={cx('h-4 w-4', spinning ? 'animate-spin' : '')} />
);

/* -------------------------------------------------------
   Optional: Confirm dialog helpers (professional deletes)
   You can use ConfirmButton instead of DangerButton later.
-------------------------------------------------------- */

export const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-start gap-3">
            <div
              className={cx(
                'mt-0.5 p-2 rounded-md',
                danger ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{title}</div>
              <div className="text-sm text-gray-600 mt-1">{message}</div>
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-end gap-2">
            <SecondaryButton onClick={onClose}>{cancelText}</SecondaryButton>
            {danger ? (
              <DangerButton onClick={onConfirm}>{confirmText}</DangerButton>
            ) : (
              <PrimaryButton onClick={onConfirm}>{confirmText}</PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConfirmButton = ({
  children,
  confirmTitle = 'Confirm Action',
  confirmMessage = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  onConfirm,
  disabled,
  loading,
  className,
}: {
  children: React.ReactNode;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  const Button = useMemo(() => (danger ? DangerButton : PrimaryButton), [danger]);

  return (
    <>
      <Button
        className={className}
        disabled={disabled}
        loading={loading}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      <ConfirmDialog
        open={open}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText={cancelText}
        danger={danger}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
};
