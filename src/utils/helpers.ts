/**
 * Funções auxiliares reutilizáveis
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata data para padrão dd/MM/yyyy
 */
export const formatDate = (date: string | Date, pattern: string = 'dd/MM/yyyy'): string => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, pattern, { locale: ptBR });
};

/**
 * Formata data e hora
 */
export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, "dd/MM/yyyy 'às' HH:mm");
};

/**
 * Formata tempo relativo (ex: "há 2 horas")
 */
export const formatRelativeTime = (date: string | Date): string => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(parsedDate, { locale: ptBR, addSuffix: true });
};

/**
 * Comprime imagem (placeholder para expo-image-manipulator)
 */
export const compressImage = async (uri: string, quality: number = 0.7): Promise<string> => {
  // Para compressão real, use expo-image-manipulator
  // Aqui retornamos a URI original por simplicidade
  return uri;
};

/**
 * Gera nome de arquivo único para armazenamento
 */
export const generateFileName = (userId: string, extension: string = 'jpg'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${userId}/${timestamp}_${random}.${extension}`;
};

/**
 * Obtém iniciais do nome
 */
export const getInitials = (name?: string): string => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Trunca texto com limite de caracteres
 */
export const truncateText = (text: string | null, maxLength: number = 100): string => {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
};

/**
 * Valida email
 */
export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Valida telefone (Formato Angola: 9XX XXX XXX)
 */
export const validatePhone = (phone: string): boolean => {
  const regex = /^9\d{8}$/;
  return regex.test(phone.replace(/\s/g, ''));
};
