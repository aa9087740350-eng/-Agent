from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


st.set_page_config(
    page_title="清研霍格精工拓客智能体 - 复核台",
    layout="wide",
    initial_sidebar_state="collapsed",
)


ROOT_DIR = Path(__file__).resolve().parents[1]
DASHBOARD_DIR = ROOT_DIR / "outputs" / "dashboard-public"
INDEX_PATH = DASHBOARD_DIR / "index.html"
STYLE_PATH = DASHBOARD_DIR / "style.css"
APP_JS_PATH = DASHBOARD_DIR / "app.js"


def main():
    hide_streamlit_chrome()
    html = build_embedded_dashboard()
    if html is None:
        return

    components.html(html, height=1600, scrolling=True)


def hide_streamlit_chrome():
    st.markdown(
        """
<style>
html, body, [data-testid="stAppViewContainer"], .stApp {
  margin: 0;
  padding: 0;
  background: #f5f7fb;
}

[data-testid="stHeader"],
[data-testid="stSidebar"],
[data-testid="stToolbar"],
[data-testid="stDecoration"],
#MainMenu,
footer {
  display: none !important;
  visibility: hidden !important;
}

.block-container {
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

iframe {
  display: block;
  width: 100%;
  border: 0;
}
</style>
        """,
        unsafe_allow_html=True,
    )


def build_embedded_dashboard():
    missing = [path for path in [INDEX_PATH, STYLE_PATH, APP_JS_PATH] if not path.exists()]
    if missing:
        st.error("缺少静态复核台文件，无法加载与本地部署一致的界面。")
        for path in missing:
            st.code(str(path))
        return None

    index_html = INDEX_PATH.read_text(encoding="utf-8")
    style_css = STYLE_PATH.read_text(encoding="utf-8")
    app_js = APP_JS_PATH.read_text(encoding="utf-8")

    html = index_html.replace(
        '<link rel="stylesheet" href="./style.css" />',
        f"<style>\n{style_css}\n</style>",
    )
    html = html.replace(
        '<script src="./app.js"></script>',
        f"<script>\n{app_js}\n</script>",
    )
    html = html.replace(
        "</head>",
        """
<style>
html, body {
  margin: 0;
  min-height: 100vh;
  overflow-x: hidden;
}
</style>
</head>""",
    )
    return html


if __name__ == "__main__":
    main()
