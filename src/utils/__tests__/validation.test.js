import {
  sanitizeInput,
  sanitizeNumericInput,
  validateRequired,
  validateEmail,
  validatePositiveNumber,
  validateWithdrawalAmount,
  validateTransactionDescription,
  parseAmount
} from '../validation';

describe('Input Sanitization', () => {
  test('sanitizeInput removes dangerous characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    expect(sanitizeInput('Normal text 123')).toBe('Normal text 123');
    expect(sanitizeInput('')).toBe('');
  });

  test('sanitizeNumericInput keeps only numbers and decimal', () => {
    expect(sanitizeNumericInput('123.45abc')).toBe('123.45');
    expect(sanitizeNumericInput('$100.00')).toBe('100.00');
    expect(sanitizeNumericInput('abc')).toBe('');
  });
});

describe('Validation Functions', () => {
  test('validateRequired works correctly', () => {
    expect(validateRequired('')).toBeTruthy();
    expect(validateRequired(null)).toBeTruthy();
    expect(validateRequired(undefined)).toBeTruthy();
    expect(validateRequired('test')).toBeNull();
    expect(validateRequired(0)).toBeNull();
  });

  test('validateEmail works correctly', () => {
    expect(validateEmail('test@example.com')).toBeNull();
    expect(validateEmail('invalid-email')).toBeTruthy();
    expect(validateEmail('')).toBeNull(); // Empty is allowed if not required
  });

  test('validatePositiveNumber works correctly', () => {
    expect(validatePositiveNumber('10')).toBeNull();
    expect(validatePositiveNumber('10.50')).toBeNull();
    expect(validatePositiveNumber('-5')).toBeTruthy();
    expect(validatePositiveNumber('abc')).toBeTruthy();
    expect(validatePositiveNumber('1000000000', { max: 1000 })).toBeTruthy();
  });

  test('validateWithdrawalAmount works correctly', () => {
    expect(validateWithdrawalAmount('100', 500)).toBeNull();
    expect(validateWithdrawalAmount('0.01')).toBeNull();
    expect(validateWithdrawalAmount('600', 500)).toBeTruthy(); // Exceeds balance
    expect(validateWithdrawalAmount('0')).toBeTruthy(); // Too small
    expect(validateWithdrawalAmount('2000000')).toBeTruthy(); // Too large
  });

  test('validateTransactionDescription works correctly', () => {
    expect(validateTransactionDescription('Valid description')).toBeNull();
    expect(validateTransactionDescription('Hi')).toBeTruthy(); // Too short
    expect(validateTransactionDescription('')).toBeTruthy(); // Required
    expect(validateTransactionDescription('a'.repeat(201))).toBeTruthy(); // Too long
  });

  test('parseAmount works correctly', () => {
    expect(parseAmount('123.45')).toBe(123.45);
    expect(parseAmount('$100.00')).toBe(100.00);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});