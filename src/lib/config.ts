// localStorage のキー。tenbi.github.io は全プロジェクトページで origin を共有するため、
// 他アプリと衝突しないよう固有のプレフィックスを付ける。
export const STORAGE_KEY = 'imakoko.access_token';

// 1ページの件数。「今いる場所をシェアする」用途なので最初は少なく出し、
// 遡りたいときだけ「もっと読む」で追加取得する。
// 1ページの読み込みで /checkins/{id} を PAGE_SIZE 回叩くため、
// この値がそのままレート制限の消費量に効く。
export const PAGE_SIZE = 5;

// Foursquare API のバージョン指定（この日付時点の仕様で応答が返る）
export const API_VERSION = '20230823';
