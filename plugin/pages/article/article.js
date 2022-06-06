import { loadFont, formatTime, decodeParam } from '../../utils/util.js';
import { parseRAML, convertNotesToHighlights, attachAllHighlights } from '../../utils/raml.js';

const apiDomain = 'https://api.readland.cn'
const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const magazineLists = {
  m1: {
    listId: 'm1',
    icon: "http://statics04.qingmang.mobi/0fb54c6ede68.jpg",
    color: '#E9D8B8',
    name: 'HALO'
  }, 
  m2: {
    listId: 'm2',
    icon: "http://statics04.qingmang.mobi/d7d28918e567.jpg",
    color: '#C0CAC3',
    name: 'ALIA'
  }}
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
        let from = magazineLists[that.listId]
        let listInfo = that.event.listsInfo[0];
        let article = that.event.article;
        let articleDate = formatTime(article.publishDate);

        that.generateIcon('quote', from.color);
        that.setData({
          article: {
            id: that.id,
            title: article.title,
            intro: article.snippet,
            images: article.images,
            author: {
              names: '书韵',
              avatar: 'http://statics04.qingmang.mobi/456a83aec821.jpg'
            },
            from: from,
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
          'theme.style': `--secondary-color:${from.color};`,
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
              weekDay: weekDays[new Date(event.article.docDate).getDay()],
              from: magazineLists[that.listId]
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

    // this.setData({
    //   quoteIcon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pg0KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPg0KPHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJDYXBhXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4Ig0KCSB2aWV3Qm94PSIwIDAgNTcgNTciIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDU3IDU3OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+DQo8cmVjdCB4PSIwIiB5PSIwIiBzdHlsZT0iZmlsbDpub25lOyIgd2lkdGg9IjU3IiBoZWlnaHQ9IjU3Ii8+DQo8Zz4NCgk8Y2lyY2xlIHN0eWxlPSJmaWxsOiNCREMzQzc7IiBjeD0iMTguNSIgY3k9IjMxLjUiIHI9IjUuNSIvPg0KCTxwYXRoIHN0eWxlPSJmaWxsOiNCREMzQzc7IiBkPSJNMTguNSwzOGMtMy41ODQsMC02LjUtMi45MTYtNi41LTYuNXMyLjkxNi02LjUsNi41LTYuNXM2LjUsMi45MTYsNi41LDYuNVMyMi4wODQsMzgsMTguNSwzOHoNCgkJIE0xOC41LDI3Yy0yLjQ4MSwwLTQuNSwyLjAxOS00LjUsNC41czIuMDE5LDQuNSw0LjUsNC41czQuNS0yLjAxOSw0LjUtNC41UzIwLjk4MSwyNywxOC41LDI3eiIvPg0KPC9nPg0KPGc+DQoJPGNpcmNsZSBzdHlsZT0iZmlsbDojQkRDM0M3OyIgY3g9IjM1LjUiIGN5PSIzMS41IiByPSI1LjUiLz4NCgk8cGF0aCBzdHlsZT0iZmlsbDojQkRDM0M3OyIgZD0iTTM1LjUsMzhjLTMuNTg0LDAtNi41LTIuOTE2LTYuNS02LjVzMi45MTYtNi41LDYuNS02LjVzNi41LDIuOTE2LDYuNSw2LjVTMzkuMDg0LDM4LDM1LjUsMzh6DQoJCSBNMzUuNSwyN2MtMi40ODEsMC00LjUsMi4wMTktNC41LDQuNXMyLjAxOSw0LjUsNC41LDQuNXM0LjUtMi4wMTksNC41LTQuNVMzNy45ODEsMjcsMzUuNSwyN3oiLz4NCjwvZz4NCjxwYXRoIHN0eWxlPSJmaWxsOiNCREMzQzc7IiBkPSJNMTMsMzJjLTAuNTUzLDAtMS0wLjQ0Ny0xLTFjMC03LjcyLDYuMjgtMTQsMTQtMTRjMC41NTMsMCwxLDAuNDQ3LDEsMXMtMC40NDcsMS0xLDENCgljLTYuNjE3LDAtMTIsNS4zODMtMTIsMTJDMTQsMzEuNTUzLDEzLjU1MywzMiwxMywzMnoiLz4NCjxwYXRoIHN0eWxlPSJmaWxsOiNCREMzQzc7IiBkPSJNMzAsMzJjLTAuNTUzLDAtMS0wLjQ0Ny0xLTFjMC03LjcyLDYuMjgtMTQsMTQtMTRjMC41NTMsMCwxLDAuNDQ3LDEsMXMtMC40NDcsMS0xLDENCgljLTYuNjE3LDAtMTIsNS4zODMtMTIsMTJDMzEsMzEuNTUzLDMwLjU1MywzMiwzMCwzMnoiLz4NCjwvc3ZnPg0K'
    // })
  }
})