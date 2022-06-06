import { loadFont, formatTime, decodeParam } from '../../utils/util.js';
import { parseRAML, convertNotesToHighlights, attachAllHighlights } from '../../utils/raml.js';

const apiDomain = 'https://api.readland.cn'
const weekDays = ['一', '二', '三', '四', '五', '六', '日']

Page({
  /**
   * 初始化，加载数据
   */
  onLoad: function (options) {
    // 初始化 theme
    this.initTheme()

    // 加载文章数据
    this.id = options.id;
    // 请求文章数据
    
    this.fetchArticle()
    this.fetchNotes()
    this.fetchRelativeArticles()
  },
  onShow: function (options) {
    this.startTracking()
  },
  onHide: function () {
    this.stopTracking()
  },
  onUnload: function () {
    this.stopTracking()
  },
  /**
   * 跳转链接
   */
  openLink: function (event) {
    console.log(event)
    let word = event.currentTarget.dataset.word
    if (!word) {
      return
    }

    for (var i = 0; i < word.markups.length; i++) {
      if (word.markups[i].tag === 'a') {
        const url = word.markups[i].source
        wx.setClipboardData({
          data: url
        })
        break
      }
    }
  },
  /**
   * 播放视频
   */
  playVideo: function (event) {
    console.log(event)
  },

  initTheme: function() {
    loadFont('quote-font', 'ninz-dev-FZXBSJT.ttf')
  },

  fetchArticle: function() {
    // TODO 展示 loading
    var that = this;
    var payloads = {
      doc_id: this.id,
      template: 'raml'
    }
    wx.request({
      url: `${apiDomain}/v2/pool.article.fetchEvent`,
      data: payloads,
      fail: function (res) {
        // TODO 展示失败页面
        console.log("load article fail, ", res);
      },
      success: function (res) {
        console.log("load article success, ", res);

        that.event = res.data.events[0];
        let listInfo = that.event.listsInfo[0];
        let article = that.event.article;
        let articleDate = formatTime(article.publishDate);

        that.setData({
          article: {
            id: that.id,
            title: article.title,
            intro: article.snippet,
            author: {
              names: '书韵',
              avatar: 'http://statics04.qingmang.mobi/456a83aec821.jpg'
            },
            from: {
              icon: "http://statics04.qingmang.mobi/0fb54c6ede68.jpg"
            },
            provider: {
              title: listInfo.name,
              icon: listInfo.icon,
            },
            date: articleDate,
            textLength: article.textLength,
            readCount: that.event.readCount,
            readMinutes: Math.round(that.event.allUserReadSeconds / 60),
            markers: [{
              uid: 2651,
              avatar: 'http://statics04.qingmang.mobi/15501c8ed2c0.jpg',
              name: 'Pennyfu'
            }, {
              uid: 2006,
              avatar: 'http://statics04.qingmang.mobi/456a83aec821.jpg',
              name: '书韵'
            }, {
              uid: 1730,
              avatar: 'http://statics04.qingmang.mobi/8ec0618ac0a2.jpg',
              name: '宽治'
            }]
          },
          'theme.style': '--secondary-color:#E9D8B8;',
          readMinutes: 0
        });
        that.updateContent();
      }
    })
  },
  fetchNotes: function() {
    var that = this;
    var payloads = {
      doc_id: this.id,
      group: 'paragraph',
      max: 100,
    }
    wx.request({
      url: `${apiDomain}/v2/note.groupInDoc`,
      data: payloads,
      fail: function (res) {
        console.log("load notes fail, ", res);
      },
      success: function (res) {
        console.log("load notes success, ", res);

        let notes = res.data.notes
        if (notes && notes.length > 0) {
          let highlights = convertNotesToHighlights(notes)
          console.log("convert notes to highlights, ", notes, highlights);
          that.highlights = highlights
          that.updateContent()
        }
      }
    })
  },
  fetchRelativeArticles: function() {
    var that = this;
    var payloads = {
      token: 'MzE0ZmUxZGUtYzUwYi0xMWVjLWIyODMtMDAxNjNlMTBiYjdh',
      max: 1,
    }
    wx.request({
      url: `${apiDomain}/v2/daily.event.list`,
      data: payloads,
      fail: function (res) {
        console.log("load relative articles fail, ", res);
      },
      success: function (res) {
        console.log("load relative articles success, ", res);

        let events = res.data.events[0].section.events
        if (events && events.length > 0) {
          const articles = events.map(event => {
            return {
              id: event.article.docIdString,
              title: event.article.title,
              provider: event.listsInfo[event.listsInfo.length - 1].name,
              weekDay: weekDays[new Date(event.article.docDate).getDay()]
            }
          })
          console.log("relative articles, ", articles);
          that.setData({
            relativeArticles: {
              title: '更多来自 HALO 每日星球读本',
              articles: articles
            }
          })
        }
      }
    })
  },
  updateContent: function() {
    if (!this.event || !this.event.article || !this.event.article.contentHtml) {
      return
    }
    let content = parseRAML(this.event.article.contentHtml)
    if (this.highlights) {
      attachAllHighlights(content, this.highlights)
    }
    this.setData({
      content: content
    })
    this.startTracking()
  },
  startTracking: function() {
    if (this.readingTickTimer) {
      console.log(`[reading] timer repeated, ignore`)
      return
    }
    if (!this.data.content) {
      console.log(`[reading] content not read, ignore`)
      return
    }

    let readSeconds = 0
    try {
      readSeconds = parseFloat(wx.getStorageSync(`${this.id}-reading`))
    } catch (e) {
    }
    if (!readSeconds) {
      readSeconds = 0
    }

    // 开始更新
    if (!this.readingTickTimer) {
      this.readingDuration = readSeconds
      this.readingStarted = new Date().getTime()
      this.readingTickTimer = setInterval(async () => {
        this.updateTracking()
      }, 5000)
    }
    this.setData({
      readMinutes: Math.round(readSeconds / 60)
    })
    console.log(`[reading] start tracking, last read ${readSeconds}`)
  },
  stopTracking: function() {
    if (this.readingTickTimer) {
      this.updateTracking()
      clearInterval(this.readingTickTimer)
      this.readingTickTimer = null

      console.log(`[reading] stop tracking`)
    }
  },
  updateTracking: function() {
    let current = new Date().getTime()
    this.readingDuration += Math.round((current - this.readingStarted) / 1000)
    try {
      wx.setStorageSync(`${this.id}-reading`, this.readingDuration)
    } catch (e) {
      console.log(`[reading] record tracking failed, error ${e}`)
    }
    this.readingStarted = current
    this.setData({
      readMinutes: Math.round(this.readingDuration / 60)
    })
    console.log(`[reading] update tracking, read ${this.readingDuration}`)
  }
})