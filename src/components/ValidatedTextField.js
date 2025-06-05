import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { TextField, InputAdornment } from '@mui/material';
import { sanitizeInput, sanitizeNumericInput } from '../utils/validation';

/**
 * Validated TextField component with built-in sanitization and validation
 * Provides real-time validation feedback and input sanitization
 */
const ValidatedTextField = ({
  label,
  value,
  onChange,
  onBlur,
  validator,
  sanitizer,
  type = 'text',
  required = false,
  disabled = false,
  fullWidth = true,
  multiline = false,
  rows = 1,
  placeholder,
  helperText,
  startAdornment,
  endAdornment,
  autoComplete = 'off',
  ...props
}) => {
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  // Determine which sanitizer to use
  const getSanitizer = useCallback(() => {
    if (sanitizer) return sanitizer;
    if (type === 'number') return sanitizeNumericInput;
    return sanitizeInput;
  }, [sanitizer, type]);

  // Handle input change with sanitization
  const handleChange = useCallback((event) => {
    const rawValue = event.target.value;
    const sanitizedValue = getSanitizer()(rawValue);
    
    // Validate if we have a validator and the field has been touched
    if (validator && touched) {
      const validationError = validator(sanitizedValue);
      setError(validationError || '');
    }
    
    // Call parent onChange with sanitized value
    if (onChange) {
      const syntheticEvent = {
        ...event,
        target: {
          ...event.target,
          value: sanitizedValue
        }
      };
      onChange(syntheticEvent);
    }
  }, [getSanitizer, validator, touched, onChange]);

  // Handle blur events
  const handleBlur = useCallback((event) => {
    setTouched(true);
    
    if (validator) {
      const validationError = validator(event.target.value);
      setError(validationError || '');
    }
    
    if (onBlur) {
      onBlur(event);
    }
  }, [validator, onBlur]);

  // Determine if field has error
  const hasError = Boolean(error && touched);

  // Prepare input props
  const inputProps = {
    startAdornment: startAdornment ? (
      <InputAdornment position="start">{startAdornment}</InputAdornment>
    ) : undefined,
    endAdornment: endAdornment ? (
      <InputAdornment position="end">{endAdornment}</InputAdornment>
    ) : undefined,
  };

  return (
    <TextField
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      type={type}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      multiline={multiline}
      rows={multiline ? rows : undefined}
      placeholder={placeholder}
      helperText={hasError ? error : helperText}
      error={hasError}
      autoComplete={autoComplete}
      InputProps={inputProps}
      variant="outlined"
      {...props}
    />
  );
};

ValidatedTextField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  validator: PropTypes.func,
  sanitizer: PropTypes.func,
  type: PropTypes.oneOf(['text', 'number', 'email', 'password']),
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  multiline: PropTypes.bool,
  rows: PropTypes.number,
  placeholder: PropTypes.string,
  helperText: PropTypes.string,
  startAdornment: PropTypes.node,
  endAdornment: PropTypes.node,
  autoComplete: PropTypes.string,
};

ValidatedTextField.defaultProps = {
  onBlur: undefined,
  validator: undefined,
  sanitizer: undefined,
  type: 'text',
  required: false,
  disabled: false,
  fullWidth: true,
  multiline: false,
  rows: 1,
  placeholder: undefined,
  helperText: undefined,
  startAdornment: undefined,
  endAdornment: undefined,
  autoComplete: 'off',
};

export default ValidatedTextField;