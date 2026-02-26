/**
 * Utilitários para geração de senhas
 */

/**
 * Gera uma senha temporária segura
 * Contém: Maiúscula, número, caractere especial e 10 caracteres de comprimento
 */
export const gerarSenhaTemporaria = (): string => {
  const maiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros = '0123456789';
  const especiais = '!@#$%^&*';

  let senha = '';
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += numeros[Math.floor(Math.random() * numeros.length)];
  senha += especiais[Math.floor(Math.random() * especiais.length)];

  const todosOsCaracteres = maiusculas + minusculas + numeros + especiais;
  for (let i = 3; i < 10; i++) {
    senha += todosOsCaracteres[Math.floor(Math.random() * todosOsCaracteres.length)];
  }

  // Embaralhar a senha
  return senha
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Valida requisitos mínimos de senha
 */
export const validarSenha = (senha: string): {
  valido: boolean;
  erros: string[];
} => {
  const erros: string[] = [];

  if (!senha || senha.length === 0) {
    erros.push('Senha é obrigatória');
    return { valido: false, erros };
  }

  if (senha.length < 8) {
    erros.push('Senha deve ter no mínimo 8 caracteres');
  }

  if (!/[A-Z]/.test(senha)) {
    erros.push('Senha deve conter uma letra maiúscula');
  }

  if (!/[a-z]/.test(senha)) {
    erros.push('Senha deve conter uma letra minúscula');
  }

  if (!/[0-9]/.test(senha)) {
    erros.push('Senha deve conter um número');
  }

  if (!/[!@#$%^&*]/.test(senha)) {
    erros.push('Senha deve conter um caractere especial (!@#$%^&*)');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
};

/**
 * Copia texto para área de transferência
 */
export const copiarParaAreaDeTransferencia = async (texto: string): Promise<boolean> => {
  try {
    // Para web
    if (typeof window !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao copiar para área de transferência:', error);
    return false;
  }
};
