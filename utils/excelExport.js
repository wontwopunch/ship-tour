const ExcelJS = require('exceljs');

/**
 * 데이터를 엑셀 파일로 내보내는 함수
 * @param {Array} data - 엑셀에 포함될 데이터 배열
 * @param {Array} columns - 엑셀 파일의 헤더 컬럼 정보
 * @param {String} fileName - 클라이언트에 제공될 파일 이름
 * @param {Object} res - Express.js 응답 객체
 */
const exportToExcel = async (data, columns, fileName, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    // 헤더 컬럼 설정
    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // 데이터 추가
    sheet.addRows(data);

    // 파일 반환
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).send('Error exporting data to Excel.');
  }
};

module.exports = exportToExcel;
