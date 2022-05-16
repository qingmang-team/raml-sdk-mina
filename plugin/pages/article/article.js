const util = require('../../utils/util.js')

Page({
  /**
   * 初始化，加载数据
   */
  onLoad: function (options) {
    // 读取文章 id
    var id = options.id;
    if (id === undefined) {
      // 默认测试使用的 doc id
      id = '-2132495101603821140';
    }
    console.log('load article started, ', id);
    // 请求文章数据
    var that = this;
    var payloads = {
      doc_id: id,
      // token: '92f136746dd34370a71363f6b66a3e01', // 测试 token 请替换
      template: 'raml'
    }
    wx.request({
      url: 'https://api.qingmang.mobi/v2/pool.article.fetchEvent',
      data: payloads,
      fail: function (res) {
        console.log("load article fail, ", res);
      },
      success: function (res) {
        console.log("load article success, ", res);
        let event = res.data.events[0];
        let listInfo = event.listsInfo[0];
        var article = event.article;
        article.date = util.formatTime(article.publishDate)

        // 重新调整部分参数，更适合小程序展示
        var articleContent = JSON.parse(article.contentHtml);
        for (let paragraph of articleContent) {
          switch (paragraph.type) {
            case 0:
              {
                // 调整文本，依照 markups 把一段切分成若干 sentences
                var text = paragraph.text;
                var markups = text.markups;
                var sentences = [];
                var pos = 0;
                if (markups != undefined) {
                  for (var m = 0; m < markups.length; m++) {
                    var markup = markups[m];
                    if (pos < markup.start) {
                      sentences.push({
                        "text": text.text.substring(pos, markup.start)
                      });
                    }
                    sentences.push({
                      "text": text.text.substring(markup.start, markup.end),
                      "tag": markup.tag,
                      "source": markup.source
                    });
                    pos = markup.end;
                  }
                }
                if (pos < text.text.length) {
                  sentences.push({
                    "text": text.text.substring(pos, text.text.length)
                  });
                }
                text.sentences = sentences;
                // 计算样式标签
                if (paragraph.blockquote == 1) {
                  text.class = "paragraph__blockquote"
                } else if (text.linetype == "aside") {
                  text.class = "paragraph__aside"
                } else {
                  text.class = "paragraph__text"
                }
                if (paragraph.blockquote == 1) {
                  text.class = "paragraph__blockquote"
                } else {
                  switch (text.linetype) {
                    case "aside":
                      text.class = "paragraph__aside"
                      break
                    case "h1":
                      text.class = "paragraph__h1"
                      break
                    case "h2":
                      text.class = "paragraph__h2"
                      break
                    case "h3":
                      text.class = "paragraph__h3"
                      break
                    default:
                      text.class = "paragraph__text"
                      break
                  }
                }
              }
              break;
            case 1:
              {
                // 调整图片，把图片大小算对
                var image = paragraph.image;
                var fullWidth = 750; // 按照微信的设计，屏幕宽度保持为 750rpx
                if (image.width * 4 < fullWidth) {
                  image.height = image.height * 2;
                  image.width = image.width * 2;
                } else {
                  image.height = (image.height * fullWidth) / image.width;
                  image.width = fullWidth;
                }
              }
              break;
            case 2: // video
              {
                if (paragraph.media && paragraph.media.source) {
                  paragraph.media.source = paragraph.media.source.replace("qingmang.me", "qingmang.mobi");
                  console.log("replace video url ", paragraph.media.source);
                }
              }
            case 3: // audio
              {
                if (paragraph.media && paragraph.media.title) {
                  paragraph.media.title = util.decodeParam(paragraph.media.title)
                }
              }
          }
          console.log(paragraph);
        }
        that.setData({
          article: {
            title: article.title,
            author: article.author,
            provider: {
              title: listInfo.name,
              icon: listInfo.icon,
            },
            date: article.date
          },
          content: articleContent
        });
      }
    })
  },
  /**
   * 跳转链接
   */
  openLink: function (event) {
    console.log(event)
  },
  /**
   * 播放视频
   */
  playVideo: function (event) {
    console.log(event)
  }
})