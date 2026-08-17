import json
from datetime import date

import streamlit as st


st.set_page_config(
    page_title="清研霍格精工拓客智能体 - 复核台",
    page_icon="📋",
    layout="wide",
)


REVIEW_STATUSES = ["待人工确认", "可联系", "暂缓", "需补证据"]
PRIORITIES = ["全部", "A+", "A", "B", "C", "D"]
STORAGE_KEY = "review_records"


def main():
    st.title("清研霍格精工拓客智能体")
    st.caption("客户经理复核台")

    if STORAGE_KEY not in st.session_state:
        st.session_state[STORAGE_KEY] = {}

    uploaded_file = st.sidebar.file_uploader(
        "导入运行结果 JSON",
        type=["json", "js"],
        accept_multiple_files=False,
    )

    run_data = parse_uploaded_run(uploaded_file) if uploaded_file else empty_run()
    run_data = normalize_run(run_data)
    validation = validate_run(run_data)

    render_run_header(run_data)
    render_validation(validation)
    render_metrics(run_data)
    render_workflow(run_data)

    leads = filter_leads(run_data)
    render_lead_list(leads)

    if not leads:
        st.info("等待导入运行结果。当前页面不包含任何默认线索数据。")
        return

    lead = select_lead(leads)
    render_detail(run_data, lead)


def empty_run():
    return {
        "run_id": "FRAMEWORK-ONLY",
        "run_mode": "空白框架 - 等待导入 JSON",
        "generated_at": "",
        "status": "等待导入",
        "workflow": [
            {"name": "目标画像", "status": "pending"},
            {"name": "公开采集", "status": "pending"},
            {"name": "信号识别", "status": "pending"},
            {"name": "动态评分", "status": "pending"},
            {"name": "联系人", "status": "pending"},
            {"name": "客户卡片", "status": "pending"},
            {"name": "人工复核", "status": "pending"},
        ],
        "leads": [],
    }


def parse_uploaded_run(uploaded_file):
    raw = uploaded_file.getvalue().decode("utf-8-sig")
    text = raw.strip()

    if text.startswith("window.QH_LATEST_RUN"):
        text = text.split("=", 1)[1].strip()
        if text.endswith(";"):
            text = text[:-1]

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        st.error(f"JSON 无法解析：{exc}")
        return empty_run()


def normalize_run(input_data):
    safe = input_data if isinstance(input_data, dict) else {}
    leads = safe.get("leads") if isinstance(safe.get("leads"), list) else []

    return {
        "run_id": safe.get("run_id") or "未载入",
        "run_mode": safe.get("run_mode") or "无数据",
        "generated_at": safe.get("generated_at") or "",
        "status": safe.get("status") or "待人工确认",
        "workflow": safe.get("workflow") if isinstance(safe.get("workflow"), list) else [],
        "leads": [normalize_lead(lead, index) for index, lead in enumerate(leads)],
    }


def normalize_lead(lead, index):
    item = lead if isinstance(lead, dict) else {}
    return {
        "lead_id": item.get("lead_id") or item.get("线索ID") or f"L{index + 1:03}",
        "collected_at": item.get("collected_at") or item.get("采集日期") or "",
        "institution": item.get("institution") or item.get("学校/机构") or "",
        "lab": item.get("lab") or item.get("学院/实验室") or "",
        "owner": item.get("owner") or item.get("负责人") or "",
        "title": item.get("title") or item.get("客户名称") or item.get("通告标题") or "",
        "research_direction": item.get("research_direction") or item.get("研究方向") or "",
        "potential_need": item.get("potential_need") or item.get("潜在加工需求") or "",
        "explicit_signals": as_list(item.get("explicit_signals") or item.get("显性需求信号")),
        "pain_signals": as_list(item.get("pain_signals") or item.get("痛点信号")),
        "urgency_signals": as_list(item.get("urgency_signals") or item.get("近期紧迫信号")),
        "budget_or_project": item.get("budget_or_project") or item.get("预算/项目线索") or "",
        "recommended_service": item.get("recommended_service") or item.get("推荐服务") or "",
        "entry_point": item.get("entry_point") or item.get("建议切入点") or "",
        "priority": item.get("priority") or item.get("优先级") or "待评估",
        "score": safe_number(item.get("score", item.get("评分", 0))),
        "score_reason": item.get("score_reason") or item.get("评分理由") or "",
        "source_url": item.get("source_url") or item.get("信息来源URL") or item.get("通告来源URL") or "",
        "follow_status": item.get("follow_status") or item.get("跟进状态") or "待人工确认",
        "contact": item.get("contact") if isinstance(item.get("contact"), dict) else {},
        "contact_methods": item.get("contact_methods") if isinstance(item.get("contact_methods"), list) else [],
        "evidence": item.get("evidence") if isinstance(item.get("evidence"), list) else [],
        "outreach": item.get("outreach") if isinstance(item.get("outreach"), dict) else {},
        "notes": item.get("notes") or item.get("备注") or "",
    }


def validate_run(run_data):
    errors = []
    warnings = []

    for field in ["run_id", "run_mode", "status", "workflow", "leads"]:
        if field not in run_data:
            errors.append(f"缺少顶层字段：{field}")

    for lead in run_data.get("leads", []):
        lead_id = lead.get("lead_id", "未知线索")
        for field in ["lead_id", "collected_at", "institution", "title", "source_url", "score_reason"]:
            if not lead.get(field):
                warnings.append(f"{lead_id} 缺少字段：{field}")

        if lead.get("priority") in ["A+", "A"] and not (lead.get("explicit_signals") or lead.get("pain_signals")):
            errors.append(f"{lead_id} 为 A/A+，但缺少显性需求信号或痛点信号。")

        if not (lead.get("explicit_signals") or lead.get("pain_signals")) and lead.get("priority") not in ["C", "D"]:
            errors.append(f"{lead_id} 无显性需求和痛点信号，优先级必须锁定为 C 或 D。")

        for index, method in enumerate(lead.get("contact_methods", [])):
            status = method.get("status", "")
            label = f"{lead_id}.contact_methods[{index}]"
            if status == "公开确认":
                for field in ["type", "value", "source_url", "source_title", "evidence_snippet", "collected_at"]:
                    if not method.get(field):
                        errors.append(f"{label} 公开确认联系方式缺少字段：{field}")
            elif method.get("value") not in [None, "", "未识别", "未公开", "待人工确认", "无"]:
                errors.append(f"{label} 非公开联系方式不应包含具体值。")

    return {"errors": errors, "warnings": warnings}


def render_run_header(run_data):
    cols = st.columns([1.2, 1.2, 1.2, 2])
    cols[0].metric("运行模式", run_data["run_mode"])
    cols[1].metric("运行 ID", run_data["run_id"])
    cols[2].metric("运行状态", run_data["status"])
    cols[3].metric("生成时间", run_data["generated_at"] or "未生成")


def render_validation(validation):
    if validation["errors"]:
        with st.expander("数据契约错误", expanded=True):
            for error in validation["errors"]:
                st.error(error)

    if validation["warnings"]:
        with st.expander("字段提醒", expanded=False):
            for warning in validation["warnings"]:
                st.warning(warning)


def render_metrics(run_data):
    leads = run_data["leads"]
    hot = sum(1 for lead in leads if lead["priority"] in ["A+", "A"])
    public_contacts = sum(
        1
        for lead in leads
        if any(method.get("status") == "公开确认" and method.get("value") for method in lead["contact_methods"])
    )
    pending = sum(1 for lead in leads if review_for(run_data, lead).get("status") == "待人工确认")

    cols = st.columns(4)
    cols[0].metric("线索总数", len(leads))
    cols[1].metric("A 类以上", hot)
    cols[2].metric("公开联系方式", public_contacts)
    cols[3].metric("待人工确认", pending)


def render_workflow(run_data):
    status_names = {"done": "已完成", "active": "进行中", "blocked": "阻塞", "pending": "待启动"}
    workflow = run_data["workflow"] or empty_run()["workflow"]
    st.subheader("工作流进度")
    cols = st.columns(min(len(workflow), 7) or 1)
    for index, step in enumerate(workflow):
        cols[index % len(cols)].metric(step.get("name", "-"), status_names.get(step.get("status"), step.get("status", "待启动")))


def filter_leads(run_data):
    st.sidebar.divider()
    query = st.sidebar.text_input("搜索", placeholder="学校、实验室、信号、联系人")
    priority = st.sidebar.selectbox("优先级", PRIORITIES)
    review_status = st.sidebar.selectbox("复核状态", ["全部", *REVIEW_STATUSES])

    filtered = []
    for lead in run_data["leads"]:
        review = review_for(run_data, lead)
        haystack = " ".join(
            [
                lead["lead_id"],
                lead["title"],
                lead["institution"],
                lead["lab"],
                lead["owner"],
                lead["research_direction"],
                lead["potential_need"],
                " ".join(lead["explicit_signals"]),
                " ".join(lead["pain_signals"]),
                lead["contact"].get("name", ""),
            ]
        ).lower()

        if query and query.lower() not in haystack:
            continue
        if priority != "全部" and lead["priority"] != priority:
            continue
        if review_status != "全部" and review.get("status") != review_status:
            continue
        filtered.append(lead)

    return filtered


def render_lead_list(leads):
    st.subheader("线索列表")
    if not leads:
        return

    rows = [
        {
            "线索ID": lead["lead_id"],
            "客户名称": lead["title"] or lead["lab"] or lead["institution"],
            "学校/机构": lead["institution"],
            "学院/实验室": lead["lab"],
            "优先级": lead["priority"],
            "评分": lead["score"],
            "公开联系方式": "是"
            if any(method.get("status") == "公开确认" and method.get("value") for method in lead["contact_methods"])
            else "否",
        }
        for lead in leads
    ]
    st.dataframe(rows, use_container_width=True, hide_index=True)


def select_lead(leads):
    labels = [
        f"{lead['priority']} / {lead['score']} / {lead['title'] or lead['lab'] or lead['institution']} / {lead['lead_id']}"
        for lead in leads
    ]
    selected_label = st.selectbox("选择线索", labels)
    return leads[labels.index(selected_label)]


def render_detail(run_data, lead):
    st.divider()
    st.header(lead["title"] or lead["lab"] or lead["institution"] or lead["lead_id"])
    st.caption(" / ".join(part for part in [lead["institution"], lead["lab"]] if part) or lead["lead_id"])

    tab_card, tab_contacts, tab_evidence, tab_outreach, tab_review = st.tabs(
        ["客户卡片", "联系方式", "证据链", "话术", "人工复核"]
    )

    with tab_card:
        render_card(lead)

    with tab_contacts:
        render_contacts(lead)

    with tab_evidence:
        render_evidence(lead)

    with tab_outreach:
        render_outreach(lead)

    with tab_review:
        render_review_form(run_data, lead)


def render_card(lead):
    fields = [
        ("线索ID", lead["lead_id"]),
        ("采集日期", lead["collected_at"]),
        ("负责人/团队", lead["owner"]),
        ("研究方向", lead["research_direction"]),
        ("潜在加工需求", lead["potential_need"]),
        ("显性需求信号", "、".join(lead["explicit_signals"]) or "无"),
        ("痛点信号", "、".join(lead["pain_signals"]) or "无"),
        ("近期紧迫信号", "、".join(lead["urgency_signals"]) or "无"),
        ("预算/项目线索", lead["budget_or_project"] or "未识别"),
        ("推荐服务", lead["recommended_service"] or "未识别"),
        ("建议切入点", lead["entry_point"] or "未识别"),
        ("优先级", lead["priority"]),
        ("评分", str(lead["score"])),
    ]

    cols = st.columns(3)
    for index, (label, value) in enumerate(fields):
        cols[index % 3].metric(label, value)

    st.subheader("评分理由")
    st.write(lead["score_reason"] or "未提供")

    if lead["source_url"]:
        st.link_button("打开信息来源", lead["source_url"])


def render_contacts(lead):
    contact = lead["contact"]
    cols = st.columns(3)
    cols[0].metric("推荐联系人", contact.get("name", "未识别"))
    cols[1].metric("联系人身份", contact.get("role", "未识别"))
    cols[2].metric("推荐置信度", contact.get("confidence", "低"))
    st.write(contact.get("reason", "未提供推荐理由"))

    methods = lead["contact_methods"]
    if not methods:
        st.info("未识别公开联系方式")
        return

    for method in methods:
        with st.container(border=True):
            contact_value = method.get("value") if method.get("status") == "公开确认" else method.get("status", "待人工确认")
            st.write(f"**{method.get('type', '-')}：{contact_value or '未提供'}**")
            st.caption(f"状态：{method.get('status', '-')} / {method.get('display_status', '')}")
            if method.get("source_url"):
                st.link_button(method.get("source_title") or "打开来源", method["source_url"])
            st.write(method.get("evidence_snippet") or "未提供证据片段")
            st.caption(f"采集日期：{method.get('collected_at', '未提供')} / 公开位置：{method.get('public_location', '未提供')}")


def render_evidence(lead):
    if not lead["evidence"]:
        st.info("暂无证据片段")
        return

    for item in lead["evidence"]:
        with st.container(border=True):
            st.write(f"**{item.get('title', '证据')}**")
            st.write(item.get("snippet", ""))
            if item.get("url"):
                st.link_button("打开来源", item["url"])
            st.caption(item.get("collected_at") or lead["collected_at"] or "")


def render_outreach(lead):
    outreach = lead["outreach"]
    st.subheader("首封邮件标题")
    st.write(outreach.get("email_subject", "未生成"))
    st.subheader("首封邮件正文")
    st.write(outreach.get("email_body", "未生成"))
    st.subheader("微信开场白")
    st.write(outreach.get("wechat_opening", "未生成"))
    st.subheader("电话开场白")
    st.write(outreach.get("phone_opening", "未生成"))


def render_review_form(run_data, lead):
    review = review_for(run_data, lead)
    key_prefix = review_key(run_data, lead)

    with st.form(f"review-form-{key_prefix}"):
        status = st.selectbox("复核结论", REVIEW_STATUSES, index=REVIEW_STATUSES.index(review.get("status", "待人工确认")))
        account_manager = st.text_input("客户经理", value=review.get("account_manager", ""))
        next_follow_up = st.date_input("下次跟进时间", value=parse_date(review.get("next_follow_up")))
        note = st.text_area("复核备注", value=review.get("note", ""), height=140)
        submitted = st.form_submit_button("保存复核")

    if submitted:
        st.session_state[STORAGE_KEY][key_prefix] = {
            "lead_id": lead["lead_id"],
            "status": status,
            "account_manager": account_manager.strip(),
            "next_follow_up": next_follow_up.isoformat() if next_follow_up else "",
            "note": note.strip(),
        }
        st.success("复核记录已保存在当前浏览器会话。")

    reviews = list(st.session_state[STORAGE_KEY].values())
    st.download_button(
        "导出复核记录 JSON",
        data=json.dumps({"run_id": run_data["run_id"], "reviews": reviews}, ensure_ascii=False, indent=2),
        file_name=f"{run_data['run_id']}-reviews.json",
        mime="application/json",
    )


def review_for(run_data, lead):
    return st.session_state[STORAGE_KEY].get(
        review_key(run_data, lead),
        {
            "lead_id": lead["lead_id"],
            "status": lead["follow_status"] or "待人工确认",
            "account_manager": "",
            "next_follow_up": "",
            "note": "",
        },
    )


def review_key(run_data, lead):
    return f"{run_data['run_id']}:{lead['lead_id']}"


def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def safe_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


def as_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if not value:
        return []
    return [part.strip() for part in str(value).replace("；", "、").replace(";", "、").replace(",", "、").split("、") if part.strip()]


if __name__ == "__main__":
    main()
