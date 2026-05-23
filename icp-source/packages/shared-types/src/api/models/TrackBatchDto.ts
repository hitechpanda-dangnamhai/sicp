/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TrackBatchDto = {
  events: Array<({
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'session.started';
    properties: {
      source: 'web' | 'mobile';
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'product.viewed';
    properties: {
      product_id: string;
      source: 'search' | 'reco' | 'cart' | 'direct';
      dwell_ms?: number;
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'cart.item_added';
    properties: {
      product_id: string;
      qty: number;
      unit_price: number;
      source: 'search' | 'reco' | 'voice' | 'direct';
      from_query?: string;
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'auth.signed_in';
    properties: {
      method: 'password';
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'auth.signed_out';
    properties: any;
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'auth.password_reset_requested';
    properties: {
      email_hash: string;
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'nav.settings_section_opened';
    properties: {
      section: 'notifications' | 'security' | 'help';
    };
  } | {
    event_id: string;
    occurred_at: string;
    received_at?: string;
    user_id?: string;
    session_id: string;
    device_id?: string;
    intent?: string;
    modality?: 'text' | 'voice' | 'image';
    request_id?: string;
    subject_type?: 'product' | 'cart' | 'order' | 'category' | 'query' | 'card';
    subject_id?: string;
    user_agent?: string;
    ip_hash?: string;
    app_version: string;
    event_type: 'error.report_requested';
    properties: {
      trace_id: string;
      error_code: string;
    };
  })>;
};

