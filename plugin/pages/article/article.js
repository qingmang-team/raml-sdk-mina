import { loadFont, formatTime, getFormatDateWithoutTime } from '../../utils/util.js';
import { parseRAML, convertNotesToHighlights, attachAllHighlights } from '../../utils/raml.js';

const apiDomain = 'https://api.readland.cn'
const commonPayloads = {
  platform: 'wechat'
}
const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const dynaimcIcons = {
  quote: '<?xml version="1.0" encoding="iso-8859-1"?><svg width="34" height="26" viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M33.1 1.5L32.5 0C23.9 3.1 17.1 10.2 17.1 18.3C17.1 22.8 19.7 25.6 23.5 25.6C26.8 25.6 29.3 23.3 29.3 20C29.3 16.8 27 15.2 24.4 15.2C23.4 15.2 22.6 15.5 22 15.5C21.2 15.5 20.9 15.1 20.9 14.1C20.9 10.6 25.7 4.2 33.1 1.5ZM16 1.5L15.4 0C6.8 3.1 0 10.2 0 18.3C0 22.8 2.6 25.6 6.4 25.6C9.7 25.6 12.2 23.3 12.2 20C12.2 16.8 9.9 15.2 7.3 15.2C6.3 15.2 5.5 15.5 4.9 15.5C4.1 15.5 3.8 15.1 3.8 14.1C3.8 10.6 8.6 4.2 16 1.5Z" fill="#FFFFFF"/></svg>'
}

Page({
  /**
   * 初始化，加载数据
   */
  onLoad: function (options) {
    // 初始化 theme
    this.initTheme()

    // 加载文章数据
    this.id = options.id;
    this.listId = options.list_id
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
  onShareAppMessage: function (res) {
    this.logShareEvent(res.from)
    let title = this.data.article ? `${this.data.article.provider.name} · ${this.data.article.title.replace('\n', '')}` : '分享文章'
    if (this.isSumatra()) {
      title = this.data.article ? `邀请你阅读星球读本：${this.data.article.title.replace('\n', '')} ｜ ${this.data.article.provider.name}` : '邀请你阅读星球读本'
    }
    return {
      title: title,
      imageUrl: this.data.article.cover,
      path: `plugin://read-plugin/article-page?id=${this.id}&list_id=${this.listId}`
    }
  },
  navigationBack: function () {
    let pageCount = getCurrentPages().length
    if (pageCount > 1) {
      wx.navigateBack({})
    } else {
      let indexPath = this.isSumatra() ? '/pages/main/index' : '/pages/index/index'
      wx.redirectTo({
        url: indexPath
      })
    }
  },
  isSumatra: function () {
    let appId = wx.getAccountInfoSync().miniProgram.appId
    return appId === 'wx0d2c6fc1dcfe24e3' || appId === 'wxe53fc874ec95d052' || appId === 'wx13a6db3ed7ec76d1'
  },
  /**
   * 跳转链接
   */
  openLink: function (event) {
    let word = event.currentTarget.dataset.word
    if (!word) {
      return
    }

    for (var i = 0; i < word.markups.length; i++) {
      if (word.markups[i].tag === 'a') {
        wx.showModal({
          content: '小程序内不能打开外部链接，你可以复制链接地址后到外部浏览器打开。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '复制链接',
          success: (res) => {
            if (res.confirm) {
              const url = word.markups[i].source
              wx.setClipboardData({
                data: url
              })
            }
          }
        })
        break
      }
    }
  },
  /**
   * 播放视频
   */
  playVideo: function (event) {
  },

  initTheme: function() {
    // 计算导航栏位置
    let menuBarRect = wx.getMenuButtonBoundingClientRect()
    let systemInfo = wx.getSystemInfoSync()
    let totalWindowHeight = systemInfo.windowHeight
    let coverHeight = 100
    let contentHeight = totalWindowHeight - coverHeight
    let contentHeaderHeight = 800 - coverHeight
    this.setData({
      navigation: {
        top: menuBarRect.top,
        bottom: menuBarRect.bottom,
        height: menuBarRect.height,
        coverHeight: coverHeight,
        contentHeight: contentHeight,
        headerHeight: contentHeaderHeight
      }
    })

    // 配置分享
    wx.showShareMenu({
      menus: ['shareAppMessage']
    })

    // 加载所需字体
    loadFont('qingmang-text-font', 'qingmang_text_light_v1.otf')
    loadFont('qingmang-display-font', 'qingmang-display-thin_v1.otf')  
  },

  fetchArticle: function() {
    // TODO 展示 loading
    var that = this;
    var payloads = {
      // token: 'MzE0ZmUxZGUtYzUwYi0xMWVjLWIyODMtMDAxNjNlMTBiYjdh',
      doc_id: this.id,
      list_id: this.listId,
      template: 'raml',
      ...commonPayloads
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
        let from = that.generateFrom(that.event)
        let provider = that.generateProvider(that.event)

        let article = that.event.article;
        let articleDate = getFormatDateWithoutTime(article.publishDate);

        let authorNames = []
        let authorAvatar = null
        let writers = article.writers || []
        if (writers.length > 0)  {
          authorNames = writers.map(writer => writer.name)

          let avatars = writers.filter(writer => {
            return writer.avatar !== 'http://statics04.qingmang.mobi/b33b994ed328.jpg'
          })
          if (avatars.length > 0) {
            authorAvatar = avatars[0].avatar
          }
          console.log('avatar ', writers)
        }
        if (article.author) {
          authorNames.push(article.author)
        }
        let author = null
        if (authorNames.length > 0) {
          author = {
            names: authorNames.join(' '),
            avatar: authorAvatar
          }
        }
        let color = (from && from.color) ? from.color : '#000000'

        that.generateIcon('quote', color);
        that.setData({
          article: {
            id: that.id,
            title: article.title,
            intro: article.snippet,
            images: article.images,
            cover: article.cover,
            author: author,
            from: from,
            provider: provider,
            date: articleDate,
            textLength: article.textLength,
            readCount: that.event.readCount,
            markCount: that.event.markCount,
            shareCount: that.event.shareCount,
            readMinutes: Math.round(that.event.allUserReadSeconds / 60),
            markers: (that.event.markUsers || []).slice(0, 3)
          },
          'theme.style': `--secondary-color:${color};`,
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
      ...commonPayloads
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
          that.formatNotes(notes)
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
      doc_id: this.id,
      list_id: this.listId,
      ...commonPayloads
    }
    wx.request({
      url: `${apiDomain}/v2/pool.article.relatedEvents`,
      data: payloads,
      fail: function (res) {
        console.log("load relative articles fail, ", res);
      },
      success: function (res) {
        console.log("load relative articles success, ", res);

        let events = res.data.events
        if (events && events.length > 0) {
          const articles = events.map(event => {
            return {
              id: event.article.docIdString,
              title: event.article.title,
              weekDay: weekDays[new Date(event.timestamp).getDay()],
              provider: that.generateProvider(event),
              from: that.generateFrom(event)
            }
          })
          console.log("relative articles, ", articles);
          that.setData({
            relativeArticles: {
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
  onParagraphClicked: function(event) {
    const id = event.currentTarget.id
    const paragraph = this.data.content.find( item => {
      return item.id === id
    })
    if (paragraph.type === 1) {
      let imageUrl = paragraph.image.source
      let allImages = this.data.article.images.map( imageItem => {
        return imageItem.url
      })
      wx.previewImage({
        urls: allImages,
        current: imageUrl
      })
    }
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
  },
  generateIcon: function (name, color) {
    let baseSvg = dynaimcIcons[name]
    let colorSvg = 'data:image/svg+xml,' + encodeURIComponent(baseSvg.replace(/#FFFFFF/g, color));
    this.setData({
      [`${name}Icon`]: colorSvg
    })
  },
  generateFrom: function (event) {
    let listInfo = event.listsInfo.find(listInfo => listInfo.type === 'magazine' && listInfo.contentType === 'collection')
    if (!listInfo) {
      return null
    }
    return {
      ...listInfo,
      color: listInfo.color ? `#${listInfo.color}` : '#000'
    }
  },
  generateProvider: function (event) {
    let listInfo = event.listsInfo.find(listInfo => listInfo.type === 'publication' || listInfo.type === 'app_timeline')
    if (listInfo) return listInfo
    return event.listsInfo[event.listsInfo.length - 1]
  },
  formatNotes: function (notes) {
    for (let note of notes) {
      note.date = formatTime(note.createdTime)
      if (note.source == 2) note.reason = '精选'
      else if (note.source == 3) note.reason = '先锋读者'
    }
  },
  logShareEvent: function (from) {
    this.logEvent('share', {
      item_id: this.id,
      item_type: 'article',
      list_id: this.listId,
      network: 'wechat',
      content: from
    })
  },
  logEvent: function (action, parameters) {
    let event = {
      event: action,
      ...parameters
    }
    wx.request({
      method: 'GET',
      url: `https://api.qingmang.mobi/v1/log.send`,
      data: {
        product: 'magazine',
        events: JSON.stringify([event]),
        ...commonPayloads
      },
      header: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      fail: function (res) {
        console.log("send log fail, ", res);
      },
      success: function (res) {
        console.log("send log success, ", res);
      }
    })
  }
})