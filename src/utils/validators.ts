/**
 * Validadores reutilizáveis para toda a aplicação
 * Centraliza lógica de validação
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{9,}$/;

export interface ValidationRule {
  validator: (value: unknown) => boolean;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export const validators = {
  /**
   * Valida email
   */
  isValidEmail: (email: unknown): boolean => {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_REGEX.test(email.trim());
  },

  /**
   * Valida password (mínimo 6 caracteres)
   */
  isValidPassword: (password: unknown): boolean => {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 6;
  },

  /**
   * Valida nome
   */
  isValidName: (name: unknown): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 100;
  },

  /**
   * Valida telefone
   */
  isValidPhone: (phone: unknown): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    return PHONE_REGEX.test(phone.trim());
  },

  /**
   * Valida se campo não está vazio
   */
  isNotEmpty: (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== null && value !== undefined;
  },

  /**
   * Validação em lote com mensagens
   */
  validate: (
    data: Record<string, unknown>,
    rules: Record<string, ValidationRule[]>
  ): ValidationResult => {
    const errors: Record<string, string[]> = {};

    Object.entries(rules).forEach(([field, ruleFunctions]) => {
      const value = data[field];

      ruleFunctions.forEach(({ validator, message }) => {
        if (!validator(value)) {
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(message);
        }
      });
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

export default validators;
