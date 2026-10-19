# Mirai Journal(未来ジャーナル)

AIと音声で面談しながら1日を振り返り、目標への進捗・強み・キャリア候補・社会トレンドを蓄積していく個人用ジャーナルアプリ。

## 2026-10-04 全面改修: localStorage + API直呼び出し → JSON正本 + ビューアー

元々はブラウザのlocalStorageにデータを保存し、Gemini API/OpenRouter APIをブラウザから直接呼び出す構成だった。
この構成には以下の問題があった。

- APIキーをブラウザに保存・送信する必要があり、ユーザーが毎回APIキーを管理する手間があった
- データがブラウザのlocalStorageにしかなく、端末をまたいだ閲覧・バックアップができなかった
- Gemini/OpenRouterのAPI課金が発生しうる構成だった

これを、progress-tracker-dashboard管理下の他アプリ(claude-voice-bridge等)と同じ「JSON正本 + GitHub管理 + ビューアー」方式に合わせて全面改修した(経緯は`gurii-gabreh/progress-tracker-dashboard`の`data/tasks.json` MJ-001、`data/manager-room-log.json`の2026-10-04分を参照)。

### 記録フロー(2経路、2026-10-19に②を追加)

**①Gemini Live音声面談**
1. Geminiアプリの「Gemini Live」機能(Gem)で、1日の振り返り面談を行う
2. 面談終了時に自動保存されたトランスクリプトをコピーし、`claude-voice-bridge`サイドパネルの「📓 ジャーナル面談」タブへ貼り付けて保存する(生トランスクリプトは`claude-voice-bridge`側の`data/journal.json`へ保存される)
3. 同じ内容をClaude Codeのチャットへ貼り付けて分析を依頼する

**②日報(テキスト、手書き問わず)**
1. その日の日報をClaude Codeのチャットへ直接貼り付けて記録を依頼する(claude-voice-bridgeは経由しない)

いずれの経路でも、以降は共通:
1. Claudeが`codex exec`で分析をCodexへ委任し、結果をレビューする
2. Claudeが`data/journals.json`・`data/profile.json`へ直接commit・pushする(同じ日に①②両方あれば同一エントリに統合)

詳しくはアプリ内の「このアプリについて」ページ(`pages/settings.html`)を参照。

### データ構成

- **`data/journals.json`**: 日々のジャーナル本文(`rawTranscript`または`dailyReport`)+AI分析結果。高頻度で追記される。各エントリには`habits`(その日本文中で言及された習慣項目の実施有無を○×で記録する配列、固定マスタ無し、2026-10-19追加)も含む。
- **`data/profile.json`**: 目標・強み・キャリア候補・トレンド・週次レポート・自己分析などの集計データ。低頻度で、分析のたびにまとめて更新される。

この2分割は、更新頻度・GAS書き込み方式との相性・破損時の被害範囲・git差分の見やすさを基準にした設計原則に基づく(詳細: `progress-tracker-dashboard`の`data/claude-core-rules.md`ルール29、`data/ai-config.json`の`management.jsonSplittingPrinciple`)。

### 書き込みの方針

このリポジトリへの書き込み(`data/journals.json`・`data/profile.json`の更新)は、**常にClaude Codeセッションが直接commitする**。サイト側(index.html・pages/*.html)にはデータの保存・編集・削除機能を一切持たせず、JSONを読んで表示するだけのビューアーとした。新規GASデプロイ・APIキー設定は不要。

### 旧構成からの変更点

- 削除: `js/storage.js`(localStorage)、`js/gemini.js`(Gemini API直接呼び出し)、`js/openrouter.js`(OpenRouter API直接呼び出し)、`js/sheets.js`(Googleスプレッドシート連携)、`js/journal.js`(旧パイプライン)
- 新設: `js/data.js`(JSON正本からの読み取り専用フェッチモジュール)
- `pages/settings.html`: API設定ページから「このアプリについて」(新しい記録フローの説明)ページへ作り替え
- 各ページから保存・分析実行・追加編集削除のボタン/モーダルを撤去し、閲覧専用に変更
