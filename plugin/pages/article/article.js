import { loadFont, formatTime, getFormatDateWithoutTime } from '../../utils/util.js';
import { parseRAML, convertNotesToHighlights, attachAllHighlights } from '../../utils/raml.js';

const apiDomain = 'https://api.readland.cn'
const commonPayloads = {
  platform: 'wechat'
}
const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const dynaimcIcons = {
  quote: '<?xml version="1.0" encoding="iso-8859-1"?><svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"	 viewBox="0 0 57 57" style="enable-background:new 0 0 57 57;" xml:space="preserve"><rect x="0" y="0" style="fill:none;" width="57" height="57"/><g>	<circle style="fill:#FFFFFF;" cx="18.5" cy="31.5" r="5.5"/>	<path style="fill:#FFFFFF;" d="M18.5,38c-3.584,0-6.5-2.916-6.5-6.5s2.916-6.5,6.5-6.5s6.5,2.916,6.5,6.5S22.084,38,18.5,38z		 M18.5,27c-2.481,0-4.5,2.019-4.5,4.5s2.019,4.5,4.5,4.5s4.5-2.019,4.5-4.5S20.981,27,18.5,27z"/></g><g>	<circle style="fill:#FFFFFF;" cx="35.5" cy="31.5" r="5.5"/>	<path style="fill:#FFFFFF;" d="M35.5,38c-3.584,0-6.5-2.916-6.5-6.5s2.916-6.5,6.5-6.5s6.5,2.916,6.5,6.5S39.084,38,35.5,38z		 M35.5,27c-2.481,0-4.5,2.019-4.5,4.5s2.019,4.5,4.5,4.5s4.5-2.019,4.5-4.5S37.981,27,35.5,27z"/></g><path style="fill:#FFFFFF;" d="M13,32c-0.553,0-1-0.447-1-1c0-7.72,6.28-14,14-14c0.553,0,1,0.447,1,1s-0.447,1-1,1	c-6.617,0-12,5.383-12,12C14,31.553,13.553,32,13,32z"/><path style="fill:#FFFFFF;" d="M30,32c-0.553,0-1-0.447-1-1c0-7.72,6.28-14,14-14c0.553,0,1,0.447,1,1s-0.447,1-1,1	c-6.617,0-12,5.383-12,12C31,31.553,30.553,32,30,32z"/></svg>'
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
    return {
      title: this.data.article ? `${this.data.article.provider.name} · ${this.data.article.title}` : '分享文章',
      imageUrl: this.data.article.cover,
      path: `plugin://read-plugin/article-page?id=${this.id}&list_id=${this.listId}`
    }
  },
  navigationBack: function () {
    let pageCount = getCurrentPages().length
    if (pageCount > 1) {
      wx.navigateBack({})
    } else {
      let appId = wx.getAccountInfoSync().miniProgram.appId
      let indexPath = '/pages/index/index'
      if (appId === 'wx0d2c6fc1dcfe24e3' || appId === 'wxe53fc874ec95d052') {
        indexPath = '/pages/main/index'
      }
      wx.redirectTo({
        url: indexPath
      })
    }
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

        let author = null
        let writers = article.writers || []
        if (writers.length > 0)  {
          author = {}
          author.names = writers.map(writer => writer.name).join(' ')
          if (writers[0].avatar !== 'http://statics04.qingmang.mobi/b33b994ed328.jpg') {
            author.avatar = writers[0].avatar
          }
        }
        if (!author && article.author) {
          author = {
            names: article.author
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