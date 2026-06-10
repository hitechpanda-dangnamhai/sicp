/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IntentRequestDto = {
  modality: 'text' | 'image' | 'voice';
  content?: string;
  hint?: 'import' | 'buy' | 'search' | 'recommend' | 'cart_clear_confirm' | 'cart_view_with_stock_check' | 'analyze';
  mode?: 'ai_augmented' | 'basic_fallback';
  text_query?: string;
  filters?: {
    brand?: string;
    category?: string;
    attributes?: Record<string, string>;
  };
};

