function addStatusDropdownToActiveSheet() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();
  
  // D列（4列目）に「未実行/実行済み」のプルダウンを設定
  const range = sheet.getRange('D2:D1000');
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['未実行', '実行済み'], true)
    .setAllowInvalid(false)
    .setHelpText('未実行 / 実行済み から選択')
    .build();
  range.setDataValidation(rule);
  
  SpreadsheetApp.getUi().alert(`シート「${sheetName}」のD列(D2:D1000)にプルダウンを設定しました`);
}
