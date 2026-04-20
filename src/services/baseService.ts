/**
 * Serviço base que encapsula chamadas Supabase
 * Proporciona tratamento de erros consistente e logging
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: HandledError;
}

export interface ServiceListResult<T> {
  success: boolean;
  data?: T[];
  error?: HandledError;
}

class BaseService<T extends Record<string, unknown>> {
  constructor(protected tableName: string) {}

  /**
   * Buscar todos os registos
   */
  async getAll(conditions: Record<string, unknown> = {}): Promise<ServiceListResult<T>> {
    try {
      let query = supabase.from(this.tableName).select('*');

      // Aplicar filtros
      Object.entries(conditions).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;

      if (error) throw error;

      logger.info(`Fetched all records from ${this.tableName}`);
      return { success: true, data: (data as T[]) || [] };
    } catch (error) {
      const handledError = handleError(error, `BaseService.getAll(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }

  /**
   * Buscar um registo por ID
   */
  async getById(id: string): Promise<ServiceResult<T>> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      logger.info(`Fetched record from ${this.tableName} with id: ${id}`);
      return { success: true, data: data as T };
    } catch (error) {
      const handledError = handleError(error, `BaseService.getById(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }

  /**
   * Buscar com múltiplos filtros
   */
  async find(conditions: Record<string, unknown>): Promise<ServiceListResult<T>> {
    try {
      let query = supabase.from(this.tableName).select('*');

      Object.entries(conditions).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      logger.info(`Found records in ${this.tableName}`, conditions);
      return { success: true, data: (data as T[]) || [] };
    } catch (error) {
      const handledError = handleError(error, `BaseService.find(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }

  /**
   * Criar novo registo
   */
  async create(data: T): Promise<ServiceResult<T>> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .insert([data])
        .select()
        .single();

      if (error) throw error;

      logger.info(`Created record in ${this.tableName}`);
      return { success: true, data: result as T };
    } catch (error) {
      const handledError = handleError(error, `BaseService.create(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }

  /**
   * Atualizar registo
   */
  async update(id: string, data: Partial<T>): Promise<ServiceResult<T>> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Updated record in ${this.tableName} with id: ${id}`);
      return { success: true, data: result as T };
    } catch (error) {
      const handledError = handleError(error, `BaseService.update(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }

  /**
   * Deletar registo
   */
  async delete(id: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      logger.info(`Deleted record from ${this.tableName} with id: ${id}`);
      return { success: true, data: null };
    } catch (error) {
      const handledError = handleError(error, `BaseService.delete(${this.tableName})`);
      return { success: false, error: handledError };
    }
  }
}

export default BaseService;
