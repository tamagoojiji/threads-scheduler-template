// ==========
// 画像アップロード（Drive自動保存方式）
// 利用者は設定不要。画像は利用者自身のDriveに保存され、tamago側を経由しない。
// ==========

const IMAGE_FOLDER_ID_KEY = 'IMAGE_FOLDER_ID';
const IMAGE_FOLDER_NAME = 'スレッズ画像';
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];

// 実行者ごとのフォルダIDを保持するため UserProperties を使用
// （Script Properties は同スプシを編集する全Googleアカウント間で共有されるため、
//  「あなた自身のDrive」の所有モデルが崩れる）
const USER_PROPS_FOR_IMAGE = PropertiesService.getUserProperties();

/**
 * 画像保存用フォルダを取得（無ければ新規作成）
 * - フォルダIDは Script Properties に保存し、ID参照のみで再利用
 * - 名前一致での既存フォルダ再利用はしない（既存無関係フォルダの誤公開を防ぐ）
 * - 同名フォルダがDrive内に既にある場合、新規作成側に "(投稿予約用)" を付ける
 * - 公開設定失敗は throw（呼び出し側でユーザーに明示）
 */
function getOrCreateImageFolder() {
  const cachedId = USER_PROPS_FOR_IMAGE.getProperty(IMAGE_FOLDER_ID_KEY);
  if (cachedId) {
    try {
      const folder = DriveApp.getFolderById(cachedId);
      if (!folder.isTrashed()) {
        ensureFolderPubliclyShared(folder);
        return folder;
      }
    } catch (e) {
      // ID失効/権限なし → 新規作成へフォールスルー
    }
    USER_PROPS_FOR_IMAGE.deleteProperty(IMAGE_FOLDER_ID_KEY);
  }
  // 同名フォルダが既にあれば名前衝突を避ける（既存無関係フォルダを公開化しないため）
  let name = IMAGE_FOLDER_NAME;
  if (DriveApp.getFoldersByName(name).hasNext()) {
    name = IMAGE_FOLDER_NAME + ' (投稿予約用)';
    let suffix = 2;
    while (DriveApp.getFoldersByName(name).hasNext()) {
      name = IMAGE_FOLDER_NAME + ' (投稿予約用 ' + suffix + ')';
      suffix++;
      if (suffix > 100) throw new Error('フォルダ名の衝突を解決できませんでした');
    }
  }
  const folder = DriveApp.createFolder(name);
  ensureFolderPubliclyShared(folder);
  USER_PROPS_FOR_IMAGE.setProperty(IMAGE_FOLDER_ID_KEY, folder.getId());
  return folder;
}

/**
 * フォルダを「リンクを知っている人は閲覧可」に設定し、適用結果を検証
 * - 失敗時は throw（Workspaceポリシーや共有ドライブ制限の事前検出）
 */
function ensureFolderPubliclyShared(folder) {
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    throw new Error(
      'フォルダの公開設定に失敗しました（' + (e.message || e) + '）。\n' +
      'Workspaceの共有ポリシーや共有ドライブの制限で「リンクを知っている人は閲覧可」が禁止されている可能性があります。\n' +
      '個人Driveで実行するか、管理者に外部共有許可を確認してください。'
    );
  }
  // 適用結果を検証
  const access = folder.getSharingAccess();
  if (access !== DriveApp.Access.ANYONE_WITH_LINK && access !== DriveApp.Access.ANYONE) {
    throw new Error(
      'フォルダの公開設定が適用されませんでした（current=' + access + '）。\n' +
      'Workspaceポリシーで外部共有が制限されている可能性があります。'
    );
  }
}

/**
 * Blob を Drive に保存して公開URLを返す
 * 注: lh3.googleusercontent.com 形式は実機検証で Threads API 互換性が確認されている前提
 */
function saveImageBlobToDrive(blob, originalName) {
  const folder = getOrCreateImageFolder();
  const ext = inferExtension(blob, originalName);
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  const rand = Utilities.getUuid().slice(0, 6);
  const filename = ts + '-' + rand + '.' + ext;
  const file = folder.createFile(blob).setName(filename);
  // ファイル単位の公開も明示適用し、結果を検証（フォルダ継承で十分でも保険）
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    throw new Error(
      'ファイルの公開設定に失敗しました（' + (e.message || e) + '）。\n' +
      '管理者ポリシーで外部共有が制限されている可能性があります。'
    );
  }
  const fileAccess = file.getSharingAccess();
  if (fileAccess !== DriveApp.Access.ANYONE_WITH_LINK && fileAccess !== DriveApp.Access.ANYONE) {
    throw new Error(
      'ファイルの公開設定が適用されませんでした（current=' + fileAccess + '）。\n' +
      'Threads API が画像を取得できないため処理を中止しました。'
    );
  }
  const id = file.getId();
  const url = 'https://lh3.googleusercontent.com/d/' + id + '=w1440';
  return { url: url, fileId: id, filename: filename };
}

function inferExtension(blob, originalName) {
  const ct = (blob.getContentType() || '').toLowerCase();
  if (ct === 'image/jpeg' || ct === 'image/jpg') return 'jpg';
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  if (originalName) {
    const m = originalName.match(/\.([a-zA-Z0-9]+)$/);
    if (m) {
      const e = m[1].toLowerCase().replace('jpeg', 'jpg');
      if (IMAGE_ALLOWED_EXT.indexOf(e) >= 0) return e;
    }
  }
  return 'jpg';
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
    ui.alert('「' + HEADERS.IMAGE + '」列のセルを選択してから実行してください');
    return;
  }
  if (cell.getRow() < 2) {
    ui.alert('データ行（2行目以降）のセルを選択してください');
    return;
  }
  const html = HtmlService.createHtmlOutputFromFile('image-upload-dialog')
    .setWidth(440)
    .setHeight(340);
  ui.showModalDialog(html, '📷 画像をアップロード');
}

/**
 * HTMLダイアログから呼ばれる: base64→Blob→Drive保存→アクティブセルへURL書き込み
 */
function uploadImageFromDialog(payload) {
  if (!payload || !payload.base64 || !payload.filename) {
    throw new Error('ファイル情報が不正です');
  }
  const sizeBytes = Math.ceil(payload.base64.length * 3 / 4);
  if (sizeBytes > IMAGE_MAX_BYTES) {
    throw new Error('ファイルサイズ超過（8MBまで）');
  }
  const ct = (payload.contentType || 'image/jpeg').toLowerCase();
  const allowedCts = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedCts.indexOf(ct) < 0) {
    throw new Error('対応していない形式: ' + ct);
  }
  const bytes = Utilities.base64Decode(payload.base64);
  const blob = Utilities.newBlob(bytes, ct, payload.filename);
  const result = saveImageBlobToDrive(blob, payload.filename);
  // アクティブセルに書き込み
  const sheet = SpreadsheetApp.getActiveSheet();
  const cell = sheet.getActiveCell();
  cell.setValue(result.url);
  return { url: result.url };
}

/**
 * B方式: D列のセル内画像（ドラッグ＆ドロップで配置されたもの）を一括でURL化
 * - getValue() が CellImage を返すセルを検出
 * - contentUrl から Blob 取得 → Drive保存 → URLでセル置換
 */
function convertCellImagesToUrls() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    ui.alert('「' + SHEET_NAME + '」シートが見つかりません');
    return;
  }
  let colMap;
  try {
    colMap = getColMap(sheet);
  } catch (err) {
    ui.alert('シート構造エラー\n\n' + err.message);
    return;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('データ行がありません');
    return;
  }
  const range = sheet.getRange(2, colMap.IMAGE, lastRow - 1, 1);
  const values = range.getValues();
  const token = ScriptApp.getOAuthToken();
  let converted = 0;
  let failed = 0;
  const errors = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i][0];
    // CellImage 判定（getContentUrl メソッドを持つオブジェクト）
    if (!v || typeof v !== 'object' || typeof v.getContentUrl !== 'function') continue;
    const rowIdx = i + 2;
    try {
      const contentUrl = v.getContentUrl();
      const res = UrlFetchApp.fetch(contentUrl, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() !== 200) {
        throw new Error('HTTP ' + res.getResponseCode());
      }
      const blob = res.getBlob();
      const result = saveImageBlobToDrive(blob, 'cell-image-' + rowIdx);
      sheet.getRange(rowIdx, colMap.IMAGE).setValue(result.url);
      // 旧エラーが残っていればクリアして次回トリガーで再実行できるようにする
      // creation_id 等の旧状態も全部クリアし、新URLで新規コンテナ作成に進むよう保証する
      const oldStatus = sheet.getRange(rowIdx, colMap.STATUS).getValue();
      if (oldStatus === 'エラー') {
        sheet.getRange(rowIdx, colMap.STATUS).setValue('未投稿');
        sheet.getRange(rowIdx, colMap.ATTEMPT).setValue(0);
        sheet.getRange(rowIdx, colMap.ERROR_MSG).setValue('');
        sheet.getRange(rowIdx, colMap.CREATION).setValue('');
        sheet.getRange(rowIdx, colMap.POSTED_AT).setValue('');
        sheet.getRange(rowIdx, colMap.POST_ID).setValue('');
        sheet.getRange(rowIdx, colMap.STATE_AT).setValue(new Date().toISOString());
      }
      converted++;
    } catch (err) {
      failed++;
      errors.push('行' + rowIdx + ': ' + (err.message || err));
    }
  }
  let msg = converted + ' 件をURL化しました';
  if (failed > 0) {
    msg += '\n\n失敗: ' + failed + ' 件\n' + errors.slice(0, 5).join('\n');
  }
  if (converted === 0 && failed === 0) {
    msg = 'セル内画像が見つかりませんでした\n\n「' + HEADERS.IMAGE + '」列のセルに画像をドラッグして配置してから実行してください';
  }
  ui.alert(msg);
}

/**
 * 設定状況の確認（実質フォルダIDのみ）
 */
function checkImageUploadConfig() {
  const folderId = USER_PROPS_FOR_IMAGE.getProperty(IMAGE_FOLDER_ID_KEY) || '(未作成・初回アップロード時に自動生成)';
  let folderName = IMAGE_FOLDER_NAME;
  let folderUrl = '(未作成)';
  let sharing = '(未確認)';
  if (folderId && folderId !== '(未作成・初回アップロード時に自動生成)') {
    try {
      const folder = DriveApp.getFolderById(folderId);
      folderName = folder.getName();
      folderUrl = folder.getUrl();
      sharing = folder.getSharingAccess() === DriveApp.Access.ANYONE_WITH_LINK ? '✅ リンクを知っている人は閲覧可' : '⚠️ 公開設定要確認';
    } catch (e) {
      folderUrl = '(取得失敗)';
    }
  }
  SpreadsheetApp.getUi().alert(
    '画像保存設定\n\n' +
    '保存先フォルダ: ' + folderName + '\n' +
    'フォルダID: ' + folderId + '\n' +
    'フォルダURL: ' + folderUrl + '\n' +
    '共有設定: ' + sharing + '\n\n' +
    '※ 画像は利用者自身のGoogle Driveに保存され、tamago側を経由しません'
  );
}
