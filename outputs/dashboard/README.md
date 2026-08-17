# 网页输出层

这是“清研霍格精工拓客智能体”的本地静态客户经理复核台。

入口文件：

```text
outputs/dashboard/index.html
```

直接用浏览器打开即可。页面默认读取：

```text
outputs/dashboard/data/latest-run.js
```

## 空白框架入口

如果要发布一个不包含任何线索数据的通用链接，使用：

```text
outputs/dashboard/public.html
```

这个入口不会加载 `data/latest-run.js`，打开后只显示复核台框架和“导入 JSON”按钮。客户经理需要在浏览器里手动导入运行结果 JSON 后才能看到线索内容。

适合公开部署的最小文件：

```text
outputs/dashboard/public.html
outputs/dashboard/app.js
outputs/dashboard/style.css
```

不要把 `outputs/dashboard/data/latest-run.js` 或真实 `latest-run.json` 一起公开部署，除非已经确认其中没有敏感联系方式或客户线索。

主控编排 agent 后续完成一次流水线后，应把结果写成同名 JavaScript 数据文件：

```javascript
window.QH_LATEST_RUN = {
  run_id: "RUN-2026-08-17-001",
  run_mode: "真实运行结果",
  generated_at: "2026-08-17 18:00",
  status: "待人工确认",
  workflow: [],
  leads: []
};
```

同时建议保留同结构 JSON：

```text
outputs/dashboard/data/latest-run.json
```

## 联系方式字段要求

客户经理复核结果中，`status = 公开确认` 的联系方式可以明文展示，但每条联系方式必须包含：

```text
type
value
status
display_status
source_url
source_title
evidence_snippet
collected_at
public_location
same_source_confirmed
```

`未公开` 或 `待人工确认` 的联系方式不得填入推测值。

## 边界

- 页面只展示、筛选、导入 JSON、保存本地复核状态。
- 页面不采集网页。
- 页面不发送邮件、微信、短信或电话。
- 复核状态保存在浏览器本地存储中，导出后才会成为文件。
