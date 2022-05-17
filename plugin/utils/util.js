/**
 * 把一个时间戳（毫秒数），转成中文字符串
 */
 export function formatTime(timestamp, relativeTimestamp = true) {
  var currentDate = new Date();
  var current = currentDate.getTime();
  var diff = current - timestamp;
  if (relativeTimestamp) {
    if (diff <= (60 * 1000)) {
      return "刚刚";
    } else if (diff <= (60 * 60 * 1000)) {
      return "" + Math.floor(diff / (60 * 1000)) + " 分钟前";
    } else if (diff <= (24 * 60 * 60 * 1000)) {
      return "" + Math.floor(diff / (60 * 60 * 1000)) + " 小时前";
    } else if (diff <= (7 * 24 * 60 * 60 * 1000)) {
      return "" + Math.floor(diff / (24 * 60 * 60 * 1000)) + " 天前";
    }
  }
  var date = new Date(timestamp);
  var day = date.getDate();
  var month = date.getMonth() + 1;
  var year = date.getFullYear();

  if (!relativeTimestamp &&
    currentDate.getDate() === day &&
    (currentDate.getMonth() + 1) === month &&
    currentDate.getFullYear() === year) {
    var h = date.getHours() < 10 ? "0" + date.getHours() : "" + date.getHours();
    var m = date.getMinutes() < 10 ? "0" + date.getMinutes() : "" + date.getMinutes();
    return h + ":" + m;
  }
  if (year == currentDate.getFullYear()) {
    // 同一年.
    return "" + month + "月" + day + "日";
  }
  return "" + year + "年" + month + "月" + day + "日";
}

export function decodeParam(param) {
  return decodeURIComponent(param).replace("@html", ".html");
}

export const loadFont = async (fontFamily, filename = null) => {
  if (!fontFamily) {
    return
  }
  if (!filename) filename = `${fontFamily}.otf`
  try {
    await wx.loadFontFace({
      global: true,
      family: fontFamily,
      source: `url('https://ssupload.qingmang.mobi/${filename}?attname=${filename}')`,
    })
    console.log(`font ${fontFamily} loaded success`)
  } catch (error) {
    console.warn(`font ${fontFamily} loaded failed`, error)
  }
}
