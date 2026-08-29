// localStorage のキー。tenbi.github.io は全プロジェクトページで origin を共有するため、
// 他アプリと衝突しないよう固有のプレフィックスを付ける。
export const STORAGE_KEY = 'imakoko.access_token';

// 「今いる場所をシェアする」用途なので直近ぶんだけあれば足りる
export const CHECKIN_LIMIT = 10;

// Foursquare API のバージョン指定（この日付時点の仕様で応答が返る）
export const API_VERSION = '20230823';
