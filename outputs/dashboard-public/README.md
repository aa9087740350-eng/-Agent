# 空白网页复核台发布目录

这个目录只包含可公开部署的空白复核台框架，不包含任何默认线索数据。

发布目录内容：

```text
index.html
app.js
style.css
```

客户经理打开页面后，需要手动导入主控编排 agent 生成的运行结果 JSON，才会看到线索、联系方式、证据链和话术。

不要把真实 `latest-run.js`、`latest-run.json`、Excel 或客户联系方式文件放进这个目录。

## 部署后访问路径

如果使用 GitHub Pages，并把本目录作为站点根目录，访问地址通常是：

```text
https://<github-username>.github.io/<repo-name>/
```

如果不是站点根目录，而是随整个仓库一起发布，访问地址通常是：

```text
https://<github-username>.github.io/<repo-name>/outputs/dashboard-public/
```
