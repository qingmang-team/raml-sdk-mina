import { decodeParam } from './util'

export const parseRAML = (ramlStr) => {
  let content = JSON.parse(ramlStr)
  // 重新调整部分参数，更适合小程序展示
  if (!Array.isArray(content)) {
    content = [content]
  }
  for (let i = 0; i < content.length; i++) {
    const paragraph = content[i]
    buildParagraph(paragraph)
  }
  return content
}

const genThumbUrl = (url, maxWidth, maxHeight) => {
  if (url === undefined || url.length === 0) {
    return url
  }

  const reg = /(?:^|\s)(.*?.qingmang.mobi\/image\/orion\/[^_]*)_([0-9]*)_([0-9]*)(.*?)(?:\s|$)/g
  const match = reg.exec(url)

  if (!match) {
    return url
  }

  const width = parseInt(match[2])
  const height = parseInt(match[3])
  const mw = maxWidth || 375 * 2
  const mh = maxHeight || 667 * 2

  if (width > mw || height > mh) {
    const scale = Math.min(mw / width, mh / height)
    const targetWidth = parseInt(width * scale)
    // const targetHeight = parseInt(height * scale)
    return url + '?imageView2/2/w/' + targetWidth
  }
  return url
}

/**
 * 应该要把 text + notes 拆分成一个多级的 sentence 结构.
 * 一般而言，是 自然句 -> (笔记句) -> 样式句
 *
 * 每个 sentence 的结构是：
 * index. 相对位置，自然句是段落间的，笔记句是相对一个笔记的（用来只展示一次头像）
 * start.
 * end.
 * tag/class. 样式，必须是单数. 可以是 a, small 之类的，也可以是 highlight, markable 之类的
 * text. 这个句子包含的具体文本，它和 sentences 至少有一个.
 * sentences. 它的子句.
 * source/myself/... 其它和 tag 相关的字段.
 *
 * 只处理 text 的逻辑, notes 也需要过滤为 text 的 note
 */
const buildTextParagraph = (paragraph, highlights = []) => {
  var text = paragraph.text.text
  var sentencesStr = text.match(/[^。？！?!\n]*[。？！?!\n]/g)
  // 切分成自然句 sentences
  var sentences = []
  if (sentencesStr) {
    var start = 0
    for (var i = 0; i < sentencesStr.length; i++) {
      var t = sentencesStr[i].replace(/\n/, ' ')
      sentences.push({
        sentenceIndex: i,
        start: start,
        end: start + t.length,
        text: t,
        paragraphId: paragraph.id,
      })
      start += t.length
    }
    if (start < text.length) {
      // 最后还剩一部分文字
      sentences.push({
        sentenceIndex: sentencesStr.length,
        start: start,
        end: text.length,
        text: text.substring(start, text.length),
        paragraphId: paragraph.id,
      })
    }
  } else {
    sentences.push({
      sentenceIndex: 0,
      start: 0,
      end: text.length,
      text: text,
      paragraphId: paragraph.id,
    })
  }
  // breaks 一定是从 0 开始到 paragrah 的最后一个字结束
  var breaks = getAllBreaks(
    [sentences, paragraph.text.markups, highlights],
    0,
    text.length,
  )
  var words = extractTextParagraphWords2(
    breaks,
    paragraph.text.markups,
    highlights,
    sentences,
  )
  // 然后对相同 attrs 的进行合并，如果直接用 highlights(merged notes) 按道理是不需要做合并的
  return buildTextDomTree(paragraph, sentences, words)
}

const buildTextDomTree = function(paragraph, sentences, words) {
  // 最外层，段落，由自然句构成
  var text = paragraph.text.text
  var view = {
    sentences: [],
    class: null,
  }
  if (paragraph.blockquote === 1) {
    view.class = 'paragraph__blockquote'
  } else if (text.linetype === 'aside') {
    view.class = 'paragraph__aside'
  } else {
    view.class = 'paragraph__text'
  }

  // 计算每个句子
  // 因为两层嵌套的 text 会导致内层的事件无法响应，所以拍平为一层
  var sentence = null
  for (var i = 0; i < words.length; i++) {
    var word = words[i]
    if (sentence == null || sentence.sentenceIndex !== word.sentenceIndex) {
      sentence = sentences[word.sentenceIndex]
      sentence.class = 'sentence' // 自然句，处理 touch add note 事件，由 word 构成
      sentence.sentences = []
      view.sentences.push(sentence)
    }
    sentence.sentences.push(word)
    buildMarkupWord(word.markups, text.substring(word.start, word.end), word, 0)
  }
  return view
}

// word classes 组合
const buildMarkupWord = function(markups, text, word) {
  word.class = getMarkupsClass(markups)
  word.text = text
}

const getMarkupsClass = function(markups) {
  var classes = []
  for (var i = 0; i < markups.length; i++) {
    classes.push(getMarkupClass(markups[i]))
  }
  return classes.join(' ')
}

const getMarkupClass = function(markup) {
  var tag = markup.tag
  if (tag === 'a') {
    return 'sentence__link'
  } else if (tag === 'strong') {
    return 'sentence__bold'
  } else if (tag === 'em' || tag === 'i') {
    return 'sentence__em'
  } else if (tag === 'sub') {
    // TODO
    return 'sentence__sub'
  } else if (tag === 'sup') {
    // TODO
    return 'sentence__sup'
  }
}

/**
 * 做了个表作位置查询，比比哪个好
 */
const extractTextParagraphWords2 = function(
  breaks,
  markups,
  highlights,
  sentences,
) {
  // linetype 是在 paragrah 上
  var words = [] // breaks 的样式集合，包括 markups，和 highlight, sentence index
  var positionMap = {}
  positionMap[breaks[0]] = 0
  // console.log("position map: ", positionMap)
  // console.log("markups: ", markups)
  // console.log("highlights: ", highlights)
  // console.log("sentences: ", sentences)
  for (var i = 1; i < breaks.length; i++) {
    words.push({
      start: breaks[i - 1],
      end: breaks[i],
      markups: [],
    })
    positionMap[breaks[i]] = i
  }
  // handle markup
  if (markups) {
    for (let j = 0; j < markups.length; j++) {
      let markup = markups[j]
      let start = positionMap[markup.start]
      let end = positionMap[markup.end]
      for (let i = start; i < end; ++i) {
        words[i].markups.push(markup)
      }
    }
  }
  // handle highlights
  if (highlights) {
    for (var j = 0; j < highlights.length; j++) {
      let highlight = highlights[j]
      let start = positionMap[highlight.start]
      let end = positionMap[highlight.end]
      for (let i = start; i < end; ++i) {
        var note = highlight.notes[0]
        if (!note) {
          break
        }
        var number = 0
        for (var c = 0; c < highlight.notes.length; c++) {
          number += highlight.notes[c].similarCount
        }
        words[i].highlight = {
          nid: note.nid,
          user: {
            avatar: note.user.avatar,
            name: note.user.name,
          },
          number: number,
          start: highlight.start,
        }
        if (highlight.myself) {
          words[i].highlight.myself = true
        } else {
          words[i].highlight.others = true
        }
      }
    }
  }

  // handle sentence
  for (let j = 0; j < sentences.length; j++) {
    var sentence = sentences[j]
    var start = positionMap[sentence.start]
    var end = positionMap[sentence.end]
    for (let i = start; i < end; ++i) {
      words[i].sentenceIndex = j
    }
  }
  return words
}

const getAllBreaks = function(arrays, min, max) {
  var breaks = []
  for (var i = 0; i < arrays.length; ++i) {
    var array = arrays[i]
    if (array === undefined) {
      // TODO check is array?
      continue
    }
    for (var j = 0; j < array.length; ++j) {
      if (array[j].start >= min && array[j].start <= max) {
        breaks.push(array[j].start)
      }
      if (array[j].end >= min && array[j].end <= max) {
        breaks.push(array[j].end)
      }
    }
  }
  // 排序并且去掉重复的
  breaks = breaks.sort(function(x, y) {
    if (x > y) {
      return 1
    } else {
      return -1
    }
  })
  if (breaks.length === 0) {
    return breaks
  }
  var filtered = [breaks[0]]
  for (let i = 1; i < breaks.length; i++) {
    if (breaks[i] !== filtered[filtered.length - 1]) {
      filtered.push(breaks[i])
    }
  }
  return filtered
}

const buildParagraph = (paragraph) => {
  switch (paragraph.type) {
    case 0:
      // 计算样式标签
      const text = paragraph.text
      // blockquote 的样式
      if (paragraph.blockquote === 1) {
        text.class = 'paragraph__blockquote'
      } else {
        switch (text.linetype) {
          case 'aside':
            text.class = 'paragraph__text style_aside'
            break
          case 'h1':
            text.class = 'paragraph__title style_h1'
            break
          case 'h2':
            text.class = 'paragraph__title style_h2'
            break
          case 'h3':
            text.class = 'paragraph__title style_h3'
            break
          case 'pre':
            text.class = 'paragraph__text style_pre'
            break
          default:
            text.class = 'paragraph__text'
            break
        }
      }
      if (paragraph.li) {
        const dict = {
          ul() {
            if (paragraph.li.level < 3) {
              text.class = `paragraph__list style_ul`
            } else {
              text.class = 'paragraph__list style_ul'
            }
          },
          ol() {
            text.class = `paragraph__list style_ol`
            const ORDER_LIST = ' abcdefghijklmnopqrstuvwxyz'
            if (paragraph.li.level === 1) {
              paragraph.li.displayOrder = paragraph.li.order
            } else if (paragraph.li.level === 2) {
              paragraph.li.displayOrder = ORDER_LIST[paragraph.li.order]
            } else {
              text.class = 'paragraph__list style_ol'
            }
          },
        }
        if (typeof dict[paragraph.li.type] === 'function') {
          dict[paragraph.li.type]()
        }
      }
      // if (paragraph.text.markups) {
      const view = buildTextParagraph(paragraph)
      paragraph.text.sentences = view.sentences
      // }
      break
    case 1:
      // 调整图片，把图片大小算对
      var image = paragraph.image
      image.thumb_source = genThumbUrl(image.source)
      if (image.width > 0) {
        const fullWidth = 750 // 按照微信的设计，屏幕宽度保持为 750rpx
        if (image.width * 4 < fullWidth) {
          image.height = image.height * 2
          image.width = image.width * 2
        } else {
          image.height = (image.height * fullWidth) / image.width
          image.width = fullWidth
        }
      }
      break
    case 3: // audio
      if (paragraph.media && paragraph.media.title) {
        paragraph.media.title = decodeParam(paragraph.media.title)
      }
      break
  }
}

/**
 * 新版本的重建 paragraph
 */
export const attachAllHighlights = function(paragraphs, highlights) {
  for (let i = 0; i < paragraphs.length; i++) {
    let paragraph = paragraphs[i]
    let paragraphHighlights = highlights[paragraph.id]
    // 如果是文字，highlight 具体的句子.
    if (paragraph.type === 0) {
      const view = buildTextParagraph(paragraph, highlights[paragraph.id])
      paragraph.text.sentences = view.sentences
    }
    // 同时都 highlight 段落
    if (paragraphHighlights) {
      let number = 0
      let users = []
      let myself = false
      let annotationList = []
      for (let paragraphHighlight of paragraphHighlights) {
        for (let note of paragraphHighlight.notes) {
          number += note.similarCount
          if (note.myself) {
            myself = true
          }
          // 判断是否关联人的信息.
          if (!myself && !note.user.avatar) {
            continue
          }
          let lastId = note.content[note.content.length - 1].id
          if (lastId !== paragraph.id) {
            // 只在最后一段显示 annotation
            continue
          }
          // 计算该段 mark 的用户信息
          if (users.length < 3) {
            let existed = false
            for (let user of users) {
              if (user.uid === note.user.uid) {
                existed = true
              }
            }
            if (!existed) {
              users.push(note.user)
            }
          }
          // 计算该段出现的评论信息.
          if (
            note.annotation &&
            note.annotation.trim().length > 0 &&
            note.content
          ) {
            annotationList.push(note)
          }
        }
      }
      paragraph.highlight = {
        users: users,
        annotationList: annotationList,
        myself: myself,
        number: number,
      }
    } else {
      // clear highlights
      delete highlights[paragraph.id]
      paragraph.highlight = null
    }
  }
}

/**
 * 把 Notes 列表，转移成一个 highlight 表.
 *
 * highlights 表 key 是 paragraph id, value 是一个 highlight 包含区间和相关笔记.
 */
export const convertNotesToHighlights = function(notes) {
  const highlights = {}
  for (let i = 0; i < notes.length; i++) {
    addNoteToHighlights(notes[i], highlights)
  }
  return highlights
}

/**
 * 把一个 Note 添加到 highlights 里面去.
 */
const addNoteToHighlights = function(note, highlights) {
  if (note.content === undefined) {
    return
  }
  let myself = note.myself
  for (let i = 0; i < note.content.length; i++) {
    const paragraph = note.content[i]
    const id = paragraph.id
    let highlight = highlights[id]
    if (highlight === undefined) {
      highlight = []
      highlights[id] = highlight
    }
    // 文字段落内部的 highlight
    if (paragraph.type === 0) {
      // 针对文字笔记
      // 做一个插入排序，如果用 myself 的，必然添加到列表，否则，放到 highlight 里面.
      let current = {
        tag: 'highlight',
        myself: myself,
        start: paragraph.text.sentences[0].start,
        end: paragraph.text.sentences[0].end,
        sentences: [],
        notes: [note],
      }
      let index = 0
      while (index < highlight.length) {
        if (current.end <= highlight[index].start) {
          // 在前，添加.
          break
        } else if (current.start < highlight[index].end) {
          // 相交.
          // TODO 简单的合并一下.
          if (myself) {
            highlight[index].myself = true
            highlight[index].notes.splice(0, 0, note)
          } else if (!highlight[index].myself && note.user.avatar) {
            highlight[index].notes.splice(0, 0, note)
          } else {
            highlight[index].notes.push(note)
          }
          return
        }
        index++
      }
      highlight.splice(index, 0, current)
    } else {
      if (highlight.length === 0) {
        highlight.push({
          tag: 'highlight',
          myself: myself,
          notes: [note],
        })
      } else {
        if (myself) {
          highlight[0].myself = true
          highlight[0].notes.splice(0, 0, note)
        } else if (!highlight[0].myself && note.user.avatar) {
          highlight[0].notes.splice(0, 0, note)
        } else {
          highlight[0].notes.push(note)
        }
      }
    }
  }
}
