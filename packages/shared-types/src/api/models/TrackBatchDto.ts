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
    event_type: 'nav.tile_clicked';
    properties: {
      tile_id: 'nhap_hang' | 'phan_tich' | 'tim_san_pham' | 'mua_hang' | 'goi_y_san_pham' | 'gio_hang';
      intent_id: 'intent-01' | 'intent-02' | 'intent-03' | 'intent-04' | 'intent-05' | 'intent-07';
      source: 'hero_tile' | 'list_tile';
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
    event_type: 'search.suggested_chip_tapped';
    properties: {
      query: string;
      chip_label: string;
      chip_position: number;
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
    event_type: 'search.followup_filter_tapped';
    properties: {
      query: string;
      filter_label: string;
      filter_position: number;
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
    event_type: 'search.typo_corrected';
    properties: {
      request_id: string;
      original_query: string;
      corrected_query: string;
      confidence: number;
      user_choice: 'accept' | 'reject';
      attempt_n: number;
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
    event_type: 'search.variant_degraded';
    properties: {
      request_id: string;
      from: 'ai_augmented';
      to: 'basic_fallback';
      reason: 'llm_timeout' | 'llm_error' | 'user_explicit';
      error_code?: string;
      trace_id?: string;
      user_choice: 'retry_ai' | 'continue_basic';
      attempt_n: number;
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
    event_type: 'search.first_card_rendered';
    properties: {
      request_id: string;
      time_to_first_card_ms: number;
      total_cards_expected: number;
      mode: 'ai_augmented' | 'basic_fallback';
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
    event_type: 'cart.viewed';
    properties: {
      item_count: number;
      total: number;
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
    event_type: 'cart.item_removed';
    properties: {
      product_id: string;
      qty_removed: number;
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
    event_type: 'cart.qty_changed';
    properties: {
      product_id: string;
      old_qty: number;
      new_qty: number;
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
    event_type: 'cart.cleared';
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
    event_type: 'cart.promo_applied';
    properties: {
      code: string;
      discount_amount: number;
      subtotal_before: number;
      subtotal_after: number;
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
    event_type: 'cart.promo_removed';
    properties: {
      code: string;
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
    event_type: 'product.import_started';
    properties: {
      source: 'home_tile' | 'direct_url' | 'chat_cta';
      referrer?: string;
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
    event_type: 'product.import_completed';
    properties: {
      request_id: string;
      product_id: string;
      category: string;
      final_price: number;
      elapsed_ms: number;
      cards_shown_count: number;
      cards_accepted_count: number;
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
    event_type: 'product.import_abandoned';
    properties: {
      request_id?: string;
      abandoned_at_state: 'state-0' | 'state-A' | 'state-B' | 'state-C-rising' | 'state-C-falling' | 'state-D' | 'state-E' | 'state-F' | 'state-G' | 'state-H' | 'cancelled';
      elapsed_ms: number;
      reason: 'browser_close' | 'in_app_navigation' | 'explicit_cancel';
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
    event_type: 'card.shown';
    properties: {
      request_id: string;
      card_id: string;
      policy_code: string;
      variant: 'SUGGEST_PRICE' | 'SUGGEST_ATTRS' | 'SUGGEST_ALTERNATIVES' | 'SUGGEST_CREDIT_LOAN' | 'SUGGEST_PROMOTION';
      position: number;
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
    event_type: 'card.accepted';
    properties: {
      request_id: string;
      card_id: string;
      policy_code: string;
      variant: 'SUGGEST_PRICE' | 'SUGGEST_ATTRS' | 'SUGGEST_ALTERNATIVES' | 'SUGGEST_CREDIT_LOAN' | 'SUGGEST_PROMOTION';
      applied_value?: Record<string, any>;
      decision_ms?: number;
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
    event_type: 'card.rejected';
    properties: {
      request_id: string;
      card_id: string;
      policy_code: string;
      variant: 'SUGGEST_PRICE' | 'SUGGEST_ATTRS' | 'SUGGEST_ALTERNATIVES' | 'SUGGEST_CREDIT_LOAN' | 'SUGGEST_PROMOTION';
      reason?: 'not_relevant' | 'already_optimal' | 'too_aggressive' | 'unclear' | 'other';
      decision_ms?: number;
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
    event_type: 'recommendation.shown';
    properties: {
      source: 'image' | 'product' | 'cart';
      seed_product_id?: string | null;
      products: Array<{
        position: number;
        product_id: string;
        reason: string;
        match_type: 'visual' | 'collab' | 'trending';
      }>;
      request_id: string;
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
    event_type: 'recommendation.clicked';
    properties: {
      position: number;
      product_id: string;
      match_type: 'visual' | 'collab' | 'trending';
      active_signal_filter: 'visual' | 'collab' | 'trending';
      request_id: string;
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
    event_type: 'recommendation.dismissed';
    properties: {
      from_signal: 'visual' | 'collab' | 'trending';
      to_signal: 'visual' | 'collab' | 'trending';
      request_id: string;
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
    event_type: 'intent.first_card_emitted';
    properties: {
      request_id: string;
      time_to_first_card_ms: number;
      total_cards_expected: number;
      source: 'image';
    };
  })>;
};

