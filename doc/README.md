# 基本信息

## 插件 ID
`wx13a6db3ed7ec76d1`

# 使用介绍

## 配置

在配置文件中进行声明，其中 version 发布后为具体的版本，目前最新的版本是 `1.0.0`。`read-plugin` 为一个自定义的名字，引用时使用。
插件使用的更多配置细节可以参考文档： https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html

```
"plugins": {
    "read-plugin": {
        "version": "1.0.0",
        "provider": "wx13a6db3ed7ec76d1"
    }
}
```

## 跳转文章

可以在 wxml 文件中通过 <navigator> 组件跳转到具体文章页面，其中 `read-plugin` 为自定义的名字，和配置中保持一致；而具体跳转到哪个文章，可以通过 `id` 进行声明，而具体的文章 id，可以在运营后台获得。可以用来测试的 id 包括 `6737622617909653306` 这是一个包含笔记的测试文章；`-2132495101603821140` 这是一个样式齐全的样文。而 `list_id` 为所属列表 id，可以用 `m1` 或者 `m2` 进行测试。

```
<navigator class="action" url="plugin://read-plugin/article-page?id=6737622617909653306&list_id=m1">
  打开文章（含笔记）
</navigator>
```

此外，还可以通过 `wx.navigateTo` 函数进行跳转，url 规范如上。
