// ==========
// 画像アップロード（GitHub Contents API → GitHub Pages URL）
// 利用者自身のリポジトリにcommitし、tamago側はストレージを保持しない設計
// ==========

const IMAGE_KEYS = {
  PAT: 'GITHUB_PAT',
  OWNER: 'GITHUB_OWNER',
  REPO: 'GITHUB_REPO',
  BRANCH: 'GITHUB_BRANCH',
  IMAGE_DIR: 'GITHUB_IMAGE_DIR',
};

const IMAGE_DEFAULTS = {
  BRANCH: 'main',
  IMAGE_DIR: 'assets/images',
};

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const IMAGE_DIR_PREFIX = 'assets'; // assets/ 配下のみ許可（書き込み先制限）

/**
 * 画像ディレクトリの安全性検証
 * - assets/ 配下のみ許可（.github/workflows等への書き込み防止）
 * - ".." / 先頭スラッシュ / 先頭ドット / 制御文字 / バックスラッシュ を拒否
 * - 各セグメントは英数字・ハイフン・アンダースコアのみ
 */
function sanitizeImageDir(rawDir) {
  if (!rawDir) return IMAGE_DEFAULTS.IMAGE_DIR;
  var normalized = String(rawDir).trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return IMAGE_DEFAULTS.IMAGE_DIR;
  if (/[\x00-\x1f]/.test(normalized)) {
    throw new Error('画像ディレクトリに制御文字が含まれています');
  }
  var segments = normalized.split('/');
  for (var i = 0; i < segments.length; i++) {
    var s = segments[i];
    if (!s) throw new Error('画像ディレクトリに空セグメントがあります');
    if (s === '.' || s === '..') throw new Error('相対パス指定（. / ..）は禁止: ' + s);
    if (s.charAt(0) === '.') throw new Error('先頭がドットのディレクトリは禁止: ' + s);
    if (!/^[a-zA-Z0-9_-]+$/.test(s)) {
      throw new Error('画像ディレクトリは英数字・ハイフン・アンダースコアのみ: ' + s);
    }
  }
  if (segments[0] !== IMAGE_DIR_PREFIX) {
    throw new Error('画像ディレクトリは ' + IMAGE_DIR_PREFIX + '/ 配下を指定してください: ' + normalized);
  }
  return normalized;
}

function getImageConfig() {
  var rawDir = PROPS.getProperty(IMAGE_KEYS.IMAGE_DIR);
  return {
    pat: PROPS.getProperty(IMAGE_KEYS.PAT) || '',
    owner: PROPS.getProperty(IMAGE_KEYS.OWNER) || '',
    repo: PROPS.getProperty(IMAGE_KEYS.REPO) || '',
    branch: PROPS.getProperty(IMAGE_KEYS.BRANCH) || IMAGE_DEFAULTS.BRANCH,
    imageDir: sanitizeImageDir(rawDir),
  };
}

/**
 * 列番号を列記号に変換（1→A, 2→B, ..., 27→AA）
 */
function colNumberToLetter(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

function assertImageConfigured() {
  const c = getImageConfig();
  const missing = [];
  if (!c.pat) missing.push('GITHUB_PAT');
  if (!c.owner) missing.push('GITHUB_OWNER');
  if (!c.repo) missing.push('GITHUB_REPO');
  if (missing.length > 0) {
    throw new Error('画像アップロード設定が未完了: ' + missing.join(', '));
  }
  return c;
}

/**
 * メニューから呼ばれる: アクティブセル検証→ダイアログ表示
 */
function openImageUploadDialog() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) {
    ui.alert('「' + SHEET_NAME + '」シートで実行してください');
    return;
  }
  let colMap;
  try {
    colMap = getColMap(sheet);
  } catch (err) {
    ui.alert('シート構造エラー\n\n' + err.message);
    return;
  }
  const cell = sheet.getActiveCell();
  if (cell.getColumn() !== colMap.IMAGE) {
    ui.alert('「画像URL」列のセルを選択してから実行してください\n\n（' + colNumberToLetter(colMap.IMAGE) + '列＝「' + HEADERS.IMAGE + '」）');
    return;
  }
  if (cell.getRow() < 2) {
    ui.alert('データ行（2行目以降）のセルを選択してください');
    return;
  }
  try {
    assertImageConfigured();
  } catch (err) {
    ui.alert(
      '画像アップロード設定が未完了\n\n' +
      err.message + '\n\n' +
      'メニュー「🖼️ 画像アップロード設定」から登録してください。'
    );
    return;
  }
  const html = HtmlService.createHtmlOutputFromFile('image-upload-dialog')
    .setWidth(440)
    .setHeight(300);
  ui.showModalDialog(html, '📷 画像をアップロード');
}

/**
 * HTMLダイアログから呼ばれる: GitHub Contents APIへPUT
 */
function uploadImageFromDialog(payload) {
  const config = assertImageConfigured();
  if (!payload || !payload.base64 || !payload.filename) {
    throw new Error('ファイル情報が不正です');
  }
  const sizeBytes = Math.ceil(payload.base64.length * 3 / 4);
  if (sizeBytes > IMAGE_MAX_BYTES) {
    throw new Error('ファイルサイズ超過（8MBまで）');
  }
  const extMatch = payload.filename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  if (IMAGE_ALLOWED_EXT.indexOf(ext) < 0) {
    throw new Error('対応していない形式: ' + ext);
  }
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  const rand = Utilities.getUuid().slice(0, 6);
  const newName = ts + '-' + rand + '.' + ext;
  const path = (config.imageDir + '/' + newName).replace(/\/+/g, '/').replace(/^\/+/, '');

  const url = 'https://api.github.com/repos/' + config.owner + '/' + config.repo + '/contents/' + path;
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: {
      'Authorization': 'token ' + config.pat,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    payload: JSON.stringify({
      message: 'feat: upload image ' + newName,
      content: payload.base64,
      branch: config.branch,
    }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 201 && code !== 200) {
    throw new Error('GitHubアップロード失敗 ' + code + ': ' + res.getContentText().slice(0, 300));
  }

  const publicUrl = 'https://' + config.owner + '.github.io/' + config.repo + '/' + path;

  // アクティブセルにURLを書き込む
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  cell.setValue(publicUrl);

  return { url: publicUrl, path: path };
}

/**
 * 画像アップロード設定（PAT / Owner / Repo / Branch / Dir）
 */
function setupImageUpload() {
  const ui = SpreadsheetApp.getUi();
  const fields = [
    { key: IMAGE_KEYS.PAT, label: 'GitHub PAT (contents:write 権限)', mask: true },
    { key: IMAGE_KEYS.OWNER, label: 'GitHub Owner（ユーザー名）', mask: false },
    { key: IMAGE_KEYS.REPO, label: 'GitHub Repo 名', mask: false },
    { key: IMAGE_KEYS.BRANCH, label: 'ブランチ（空欄でmain。GitHub Pages の公開元と一致させること）', mask: false },
    { key: IMAGE_KEYS.IMAGE_DIR, label: '画像ディレクトリ（空欄で assets/images。assets/ 配下のみ可）', mask: false },
  ];
  for (const f of fields) {
    const current = PROPS.getProperty(f.key);
    const display = !current ? '(未設定)'
      : (f.mask && current.length > 8 ? current.slice(0, 4) + '...' + current.slice(-4) : current);
    const res = ui.prompt(f.label, '現在: ' + display + '\n\n新しい値（変更しない場合は空欄でOK）:', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    const v = res.getResponseText().trim();
    if (!v) continue;
    if (f.key === IMAGE_KEYS.IMAGE_DIR) {
      try {
        sanitizeImageDir(v);
      } catch (err) {
        ui.alert('保存中止: ' + err.message);
        return;
      }
    }
    PROPS.setProperty(f.key, v);
  }
  let c;
  try {
    c = getImageConfig();
  } catch (err) {
    ui.alert('保存後の検証エラー: ' + err.message);
    return;
  }
  ui.alert(
    '画像アップロード設定を保存しました\n\n' +
    'Owner: ' + (c.owner || '❌') + '\n' +
    'Repo: ' + (c.repo || '❌') + '\n' +
    'Branch: ' + c.branch + '\n' +
    'Dir: ' + c.imageDir + '\n' +
    'PAT: ' + (c.pat ? '✅' : '❌') + '\n\n' +
    '※ Branch は GitHub Pages の公開元ブランチと一致している必要があります'
  );
}

/**
 * 設定状況の確認
 */
function checkImageUploadConfig() {
  let c;
  try {
    c = getImageConfig();
  } catch (err) {
    SpreadsheetApp.getUi().alert('画像アップロード設定エラー\n\n' + err.message);
    return;
  }
  SpreadsheetApp.getUi().alert(
    '画像アップロード設定\n\n' +
    'GITHUB_PAT: ' + (c.pat ? '✅ ' + c.pat.slice(0, 4) + '...' + c.pat.slice(-4) : '❌ 未設定') + '\n' +
    'GITHUB_OWNER: ' + (c.owner || '❌ 未設定') + '\n' +
    'GITHUB_REPO: ' + (c.repo || '❌ 未設定') + '\n' +
    'GITHUB_BRANCH: ' + c.branch + '\n' +
    'GITHUB_IMAGE_DIR: ' + c.imageDir + '\n\n' +
    '公開URL形式:\n' +
    'https://{OWNER}.github.io/{REPO}/{IMAGE_DIR}/{ファイル名}\n\n' +
    '※ Branch は GitHub Pages の公開元ブランチと一致している必要があります'
  );
}
