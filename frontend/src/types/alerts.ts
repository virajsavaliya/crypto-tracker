// Alert Types for Telegram Integration

export type AlertType = 
  | 'pump'           // Price pump alert
  | 'dump'           // Price dump alert
  | 'price_target'   // Price target hit
  | 'rsi_overbought' // RSI overbought signal
  | 'rsi_oversold'   // RSI oversold signal
  | 'volume_spike'   // Volume spike alert
  | 'custom';        // Custom alert

export type NotificationChannel = 'email' | 'telegram' | 'both';

export type AlertCondition = 'above' | 'below';

export type TimeFrame = '1m' | '3m' | '5m' | '15m' | '1h' | '24h';

export interface Alert {
  id: number;
  user: number;
  symbol: string;
  alert_type: AlertType;
  threshold: number;
  condition?: AlertCondition;
  timeframe?: TimeFrame;
  notification_channels: NotificationChannel[];
  is_active: boolean;
  trigger_count: number;
  last_triggered?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateAlertPayload {
  symbol: string;
  alert_type: AlertType;
  threshold: number;
  condition?: AlertCondition;
  timeframe?: TimeFrame;
  notification_channels: NotificationChannel[];
  is_active?: boolean;
}

export interface TelegramStatus {
  connected: boolean;
  chat_id?: string;
  username?: string;
  bot_username?: string;
}

export interface TelegramSetupResponse {
  success: boolean;
  setup_token?: string;
  bot_link?: string;
  bot_username?: string;
  instructions?: string[];
  error?: string;
}

export interface AlertSettings {
  alerts: Alert[];
  telegram_connected: boolean;
  total_alerts: number;
  active_alerts: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
