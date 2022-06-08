
const apiDomain = 'https://api.readland.cn'

Page({
  /**
   * 初始化，加载数据
   */
  onLoad: function (options) {
    // 加载文章数据
    this.listId = options.list_id
    
    this.fetchArticles()
  },

  fetchArticles: function() {
    var that = this;
    var payloads = {
      max: 100,
      list_id: this.listId,
    }
    wx.request({
      url: `${apiDomain}/v2/pool.article.events`,
      data: payloads,
      fail: function (res) {
        console.log("load magazine articles fail, ", res);
      },
      success: function (res) {
        console.log("load magazine articles success, ", res);

        let events = res.data.events
        if (events && events.length > 0) {
          const articles = events.map(event => {
            return {
              id: event.article.docIdString,
              title: event.article.title,
            }
          })
          console.log("magazine articles, ", articles);
          that.setData({
            articles: articles,
            listId: that.listId
          })
        }
      }
    })
  },
})