"use client";

import React, { useState, forwardRef, useId } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "../../lib/app-i18n";

export interface FloatingLabelInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  helperText?: string | null;
  showPasswordToggle?: boolean;
  startIcon?: React.ReactNode;
  containerClassName?: string;
}

export const FloatingLabelInput = forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  (
    {
      id: explicitId,
      label,
      error,
      helperText,
      showPasswordToggle = false,
      startIcon,
      type = "text",
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      disabled,
      required,
      className = "",
      containerClassName = "",
      autoComplete,
      ...rest
    },
    ref,
  ) => {
    const { t } = useI18n();
    const generatedId = useId();
    const id = explicitId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Track internal value for uncontrolled inputs or empty checks
    const [internalValue, setInternalValue] = useState<string>(() => {
      if (value !== undefined) return String(value);
      if (defaultValue !== undefined) return String(defaultValue);
      return "";
    });

    const isControlled = value !== undefined;
    const currentValue = isControlled ? String(value ?? "") : internalValue;
    const hasValue = currentValue.length > 0;
    const isFloating = isFocused || hasValue;

    const resolvedType = showPasswordToggle
      ? showPassword
        ? "text"
        : "password"
      : type;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div
        className={`floating-fld ${isFloating ? "is-floating" : ""} ${
          isFocused ? "is-focused" : ""
        } ${error ? "has-error" : ""} ${disabled ? "is-disabled" : ""} ${containerClassName}`}
      >
        <div className="floating-input-wrap">
          {startIcon && (
            <span className="floating-start-icon" aria-hidden="true">
              {startIcon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={resolvedType}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            required={required}
            autoComplete={autoComplete}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`floating-input ${startIcon ? "has-start-icon" : ""} ${
              showPasswordToggle ? "has-end-action" : ""
            } ${className}`}
            placeholder=" "
            {...rest}
          />

          <label
            htmlFor={id}
            className={`floating-label ${startIcon ? "has-start-icon" : ""}`}
          >
            {label}
            {required && (
              <span className="floating-required" aria-hidden="true">
                {" "}
                *
              </span>
            )}
          </label>

          {showPasswordToggle && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="floating-pass-toggle"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              disabled={disabled}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {error ? (
          <span id={errorId} className="floating-error" role="alert">
            {error}
          </span>
        ) : helperText ? (
          <span id={helperId} className="floating-helper">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

FloatingLabelInput.displayName = "FloatingLabelInput";
