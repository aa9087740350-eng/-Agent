# Streamlit 复核台

这是“清研霍格精工拓客智能体”的 Streamlit 空框架复核台。

Streamlit 版本直接嵌入 `streamlit_app/dashboard_assets/index.html`，并内联同目录下的 `style.css` 和 `app.js`，因此视觉和交互与本地静态复核台保持一致。

`dashboard_assets` 是 `outputs/dashboard-public` 的部署副本。Streamlit Community Cloud 运行时会优先读取这份随应用一起提交的静态资产，避免因为找不到 `outputs` 目录而退回到 Streamlit 原生界面。

## 本地运行

```text
streamlit run streamlit_app/app.py
```

请从项目根目录运行，保证本地路径和 Streamlit Community Cloud 一致。

## 部署到 Streamlit Community Cloud

1. 把项目上传到 GitHub。
2. 打开 Streamlit Community Cloud。
3. 选择 GitHub 仓库、分支和主文件：

```text
streamlit_app/app.py
```

4. 依赖文件已放在入口文件同目录：

```text
streamlit_app/requirements.txt
```

5. 静态复核台视觉资产必须一并提交：

```text
streamlit_app/dashboard_assets/index.html
streamlit_app/dashboard_assets/style.css
streamlit_app/dashboard_assets/app.js
```

6. 配置文件位于仓库根目录：

```text
.streamlit/config.toml
```

7. 部署完成后分享生成的 `*.streamlit.app` 链接。

## 同步本地静态页样式

如果后续修改了本地复核台 `outputs/dashboard-public` 的 HTML、CSS 或 JS，请同步复制到 Streamlit 资产目录：

```text
Copy-Item outputs/dashboard-public/index.html streamlit_app/dashboard_assets/index.html -Force
Copy-Item outputs/dashboard-public/style.css streamlit_app/dashboard_assets/style.css -Force
Copy-Item outputs/dashboard-public/app.js streamlit_app/dashboard_assets/app.js -Force
```

## 数据边界

- App 不内置任何线索数据。
- 客户经理需要在页面内部点击“导入 JSON”，上传主控生成的 `latest-run.json`。
- 不要把真实 `latest-run.json`、`latest-run.js`、Excel、联系人文件提交到 GitHub。
- JSON 在嵌入的前端页面中读取和展示，不通过 Streamlit 的 `st.file_uploader` 上传到后端。
- 涉及真实联系方式时，仍建议使用受限访问或私有部署。
