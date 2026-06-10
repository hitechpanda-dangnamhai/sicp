/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IntentActionDto = {
  card_id?: string;
  choice: 'accept' | 'reject' | 'retry_ai' | 'continue_basic' | 'add_to_cart' | 'skip' | 'confirm_clear' | 'cancel_clear' | 'resolve_remove' | 'resolve_replace' | 'clarify_pick';
  value?: Record<string, any>;
  _meta?: {
    attempt_n: number;
  };
};

