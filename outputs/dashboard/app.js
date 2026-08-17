(function () {
  const STORAGE_PREFIX = "qh-dashboard-review:";
  let runData = normalizeRun(window.QH_LATEST_RUN || {});
  let selectedLeadId = runData.leads[0]?.lead_id || null;

  const elements = {
    runMode: document.getElementById("runMode"),
    runId: document.getElementById("runId"),
    runUpdated: document.getElementById("runUpdated"),
    metricTotal: document.getElementById("metricTotal"),
    metricHot: document.getElementById("metricHot"),
    metricContacts: document.getElementById("metricContacts"),
    metricReview: document.getElementById("metricReview"),
    workflowStatus: document.getElementById("workflowStatus"),
    workflowSteps: document.getElementById("workflowSteps"),
    searchInput: document.getElementById("searchInput"),
    priorityFilter: document.getElementById("priorityFilter"),
    reviewFilter: document.getElementById("reviewFilter"),
    leadList: document.getElementById("leadList"),
    emptyState: document.getElementById("emptyState"),
    leadDetail: document.getElementById("leadDetail"),
    jsonImport: document.getElementById("jsonImport"),
    leadOrg: document.getElementById("leadOrg"),
    leadTitle: document.getElementById("leadTitle"),
    leadPriority: document.getElementById("leadPriority"),
    leadScore: document.getElementById("leadScore"),
    cardFields: document.getElementById("cardFields"),
    scoreReason: document.getElementById("scoreReason"),
    contactSummary: document.getElementById("contactSummary"),
    contactRows: document.getElementById("contactRows"),
    evidenceList: document.getElementById("evidenceList"),
    emailSubject: document.getElementById("emailSubject"),
    emailBody: document.getElementById("emailBody"),
    wechatOpening: document.getElementById("wechatOpening"),
    phoneOpening: document.getElementById("phoneOpening"),
    reviewForm: document.getElementById("reviewForm"),
    reviewStatus: document.getElementById("reviewStatus"),
    accountManager: document.getElementById("accountManager"),
    nextFollowUp: document.getElementById("nextFollowUp"),
    reviewNote: document.getElementById("reviewNote"),
    exportReview: document.getElementById("exportReview"),
  };

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  elements.searchInput.addEventListener("input", renderLeadList);
  elements.priorityFilter.addEventListener("change", renderLeadList);
  elements.reviewFilter.addEventListener("change", renderLeadList);
  elements.reviewForm.addEventListener("submit", saveReview);
  elements.exportReview.addEventListener("click", exportReviews);
  elements.jsonImport.addEventListener("change", importJson);

  render();

  function normalizeRun(input) {
    const safe = input && typeof input === "object" ? input : {};
    const leads = Array.isArray(safe.leads) ? safe.leads : [];
    return {
      run_id: safe.run_id || "未载入",
      run_mode: safe.run_mode || "无数据",
      generated_at: safe.generated_at || "",
      status: safe.status || "待人工确认",
      workflow: Array.isArray(safe.workflow) ? safe.workflow : [],
      leads: leads.map((lead, index) => ({
        lead_id: lead.lead_id || lead["线索ID"] || `L${String(index + 1).padStart(3, "0")}`,
        collected_at: lead.collected_at || lead["采集日期"] || "",
        institution: lead.institution || lead["学校/机构"] || "",
        lab: lead.lab || lead["学院/实验室"] || "",
        owner: lead.owner || lead["负责人"] || "",
        title: lead.title || lead["客户名称"] || lead["通告标题"] || "",
        research_direction: lead.research_direction || lead["研究方向"] || "",
        potential_need: lead.potential_need || lead["潜在加工需求"] || "",
        explicit_signals: lead.explicit_signals || lead["显性需求信号"] || [],
        pain_signals: lead.pain_signals || lead["痛点信号"] || [],
        urgency_signals: lead.urgency_signals || lead["近期紧迫信号"] || [],
        budget_or_project: lead.budget_or_project || lead["预算/项目线索"] || "",
        recommended_service: lead.recommended_service || lead["推荐服务"] || "",
        entry_point: lead.entry_point || lead["建议切入点"] || "",
        priority: lead.priority || lead["优先级"] || "待评估",
        score: Number(lead.score ?? lead["评分"] ?? 0),
        score_reason: lead.score_reason || lead["评分理由"] || "",
        source_url: lead.source_url || lead["信息来源URL"] || lead["通告来源URL"] || "",
        follow_status: lead.follow_status || lead["跟进状态"] || "待人工确认",
        contact: lead.contact || {},
        contact_methods: Array.isArray(lead.contact_methods) ? lead.contact_methods : [],
        evidence: Array.isArray(lead.evidence) ? lead.evidence : [],
        outreach: lead.outreach || {},
        notes: lead.notes || lead["备注"] || "",
      })),
    };
  }

  function render() {
    renderRunMeta();
    renderMetrics();
    renderWorkflow();
    renderLeadList();
    renderDetail();
  }

  function renderRunMeta() {
    elements.runMode.textContent = runData.run_mode;
    elements.runId.textContent = runData.run_id;
    elements.runUpdated.textContent = runData.generated_at ? `生成：${runData.generated_at}` : "未生成";
  }

  function renderMetrics() {
    const total = runData.leads.length;
    const hot = runData.leads.filter((lead) => ["A+", "A"].includes(lead.priority)).length;
    const contacts = runData.leads.filter((lead) =>
      lead.contact_methods.some((method) => method.status === "公开确认" && method.value)
    ).length;
    const review = runData.leads.filter((lead) => getReview(lead).status === "待人工确认").length;

    elements.metricTotal.textContent = total;
    elements.metricHot.textContent = hot;
    elements.metricContacts.textContent = contacts;
    elements.metricReview.textContent = review;
  }

  function renderWorkflow() {
    elements.workflowStatus.textContent = runData.status;
    elements.workflowSteps.innerHTML = "";

    const workflow = runData.workflow.length
      ? runData.workflow
      : [
          { name: "目标画像", status: "pending" },
          { name: "公开采集", status: "pending" },
          { name: "信号识别", status: "pending" },
          { name: "动态评分", status: "pending" },
          { name: "联系人", status: "pending" },
          { name: "客户卡片", status: "pending" },
          { name: "人工复核", status: "pending" },
        ];

    workflow.forEach((step) => {
      const li = document.createElement("li");
      li.className = `step ${step.status || "pending"}`;
      li.innerHTML = `<strong>${escapeHtml(step.name || "-")}</strong><span>${statusLabel(step.status)}</span>`;
      elements.workflowSteps.appendChild(li);
    });
  }

  function renderLeadList() {
    const leads = filteredLeads();
    elements.leadList.innerHTML = "";

    if (!leads.some((lead) => lead.lead_id === selectedLeadId)) {
      selectedLeadId = leads[0]?.lead_id || runData.leads[0]?.lead_id || null;
    }

    leads.forEach((lead) => {
      const review = getReview(lead);
      const button = document.createElement("button");
      button.className = `lead-item ${lead.lead_id === selectedLeadId ? "active" : ""}`;
      button.type = "button";
      button.addEventListener("click", () => {
        selectedLeadId = lead.lead_id;
        renderLeadList();
        renderDetail();
      });
      button.innerHTML = `
        <div>
          <h3>${escapeHtml(lead.title || lead.lab || lead.institution || lead.lead_id)}</h3>
          <p>${escapeHtml([lead.institution, lead.lab].filter(Boolean).join(" / "))}</p>
          <div class="badges">
            ${lead.contact_methods.some((m) => m.status === "公开确认") ? '<span class="badge contact">有公开联系方式</span>' : '<span class="badge">联系方式待确认</span>'}
            <span class="badge">${escapeHtml(review.status)}</span>
            ${asArray(lead.explicit_signals).slice(0, 2).map((signal) => `<span class="badge hot">${escapeHtml(signal)}</span>`).join("")}
          </div>
        </div>
        <span class="priority ${priorityClass(lead.priority)}">${escapeHtml(lead.priority)}</span>
      `;
      elements.leadList.appendChild(button);
    });
  }

  function renderDetail() {
    const lead = runData.leads.find((item) => item.lead_id === selectedLeadId);
    elements.emptyState.hidden = Boolean(lead);
    elements.leadDetail.hidden = !lead;
    if (!lead) return;

    elements.leadOrg.textContent = [lead.institution, lead.lab].filter(Boolean).join(" / ") || lead.lead_id;
    elements.leadTitle.textContent = lead.title || lead.lab || lead.institution || lead.lead_id;
    elements.leadPriority.textContent = lead.priority;
    elements.leadScore.textContent = lead.score;

    const fields = [
      { label: "线索ID", value: lead.lead_id },
      { label: "采集日期", value: lead.collected_at },
      { label: "负责人/团队", value: lead.owner },
      { label: "研究方向", value: lead.research_direction },
      { label: "潜在加工需求", value: lead.potential_need },
      { label: "显性需求信号", value: asArray(lead.explicit_signals).join("、") || "无" },
      { label: "痛点信号", value: asArray(lead.pain_signals).join("、") || "无" },
      { label: "近期紧迫信号", value: asArray(lead.urgency_signals).join("、") || "无" },
      { label: "预算/项目线索", value: lead.budget_or_project || "未识别" },
      { label: "推荐服务", value: lead.recommended_service },
      { label: "建议切入点", value: lead.entry_point },
      {
        label: "信息来源URL",
        value: lead.source_url
          ? `<a href="${escapeAttr(lead.source_url)}" target="_blank" rel="noreferrer">打开来源</a>`
          : "未提供",
        html: Boolean(lead.source_url),
      },
    ];
    elements.cardFields.innerHTML = fields
      .map((field) => {
        const value = field.html ? field.value : escapeHtml(field.value || "未识别");
        return `<div class="field"><span>${escapeHtml(field.label)}</span><strong>${value}</strong></div>`;
      })
      .join("");
    elements.scoreReason.textContent = lead.score_reason || "未提供";

    renderContacts(lead);
    renderEvidence(lead);
    renderOutreach(lead);
    loadReviewForm(lead);
  }

  function renderContacts(lead) {
    const contact = lead.contact || {};
    elements.contactSummary.innerHTML = `
      <div class="field-grid">
        <div class="field"><span>推荐联系人</span><strong>${escapeHtml(contact.name || "未识别")}</strong></div>
        <div class="field"><span>联系人身份</span><strong>${escapeHtml(contact.role || "未识别")}</strong></div>
        <div class="field"><span>匹配状态</span><strong>${escapeHtml(contact.match_status || "未识别")}</strong></div>
        <div class="field"><span>推荐置信度</span><strong>${escapeHtml(contact.confidence || "低")}</strong></div>
        <div class="field"><span>推荐理由</span><strong>${escapeHtml(contact.reason || "未提供")}</strong></div>
        <div class="field"><span>待人工确认事项</span><strong>${escapeHtml(contact.manual_check || "无")}</strong></div>
      </div>
    `;

    elements.contactRows.innerHTML = "";
    if (!lead.contact_methods.length) {
      elements.contactRows.innerHTML = `<tr><td colspan="5" class="muted">未识别公开联系方式</td></tr>`;
      return;
    }

    lead.contact_methods.forEach((method) => {
      const source = method.source_url
        ? `<a href="${escapeAttr(method.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(method.source_title || "打开来源")}</a><br><span class="muted">${escapeHtml(method.collected_at || "")}</span>`
        : "无来源";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(method.type || "-")}</td>
        <td><strong>${escapeHtml(displayContactValue(method))}</strong><br><span class="muted">${escapeHtml(method.display_status || "")}</span></td>
        <td>${escapeHtml(method.status || "-")}</td>
        <td>${source}<br><span class="muted">${escapeHtml(method.public_location || "")}</span></td>
        <td>${escapeHtml(method.evidence_snippet || "未提供")}</td>
      `;
      elements.contactRows.appendChild(tr);
    });
  }

  function renderEvidence(lead) {
    elements.evidenceList.innerHTML = "";
    if (!lead.evidence.length) {
      elements.evidenceList.innerHTML = `<div class="evidence-item muted">暂无证据片段</div>`;
      return;
    }

    lead.evidence.forEach((item) => {
      const block = document.createElement("div");
      block.className = "evidence-item";
      block.innerHTML = `
        <h3>${escapeHtml(item.title || "证据")}</h3>
        <p>${escapeHtml(item.snippet || "")}</p>
        <a href="${escapeAttr(item.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.url || "未提供来源URL")}</a>
        <p class="muted">${escapeHtml(item.collected_at || lead.collected_at || "")}</p>
      `;
      elements.evidenceList.appendChild(block);
    });
  }

  function renderOutreach(lead) {
    const outreach = lead.outreach || {};
    elements.emailSubject.textContent = outreach.email_subject || "未生成";
    elements.emailBody.textContent = outreach.email_body || "未生成";
    elements.wechatOpening.textContent = outreach.wechat_opening || "未生成";
    elements.phoneOpening.textContent = outreach.phone_opening || "未生成";
  }

  function filteredLeads() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const priority = elements.priorityFilter.value;
    const reviewStatus = elements.reviewFilter.value;

    return runData.leads.filter((lead) => {
      const review = getReview(lead);
      const text = [
        lead.lead_id,
        lead.title,
        lead.institution,
        lead.lab,
        lead.owner,
        lead.research_direction,
        lead.potential_need,
        asArray(lead.explicit_signals).join(" "),
        asArray(lead.pain_signals).join(" "),
        lead.contact?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query || text.includes(query)) &&
        (priority === "all" || lead.priority === priority) &&
        (reviewStatus === "all" || review.status === reviewStatus)
      );
    });
  }

  function loadReviewForm(lead) {
    const review = getReview(lead);
    elements.reviewStatus.value = review.status;
    elements.accountManager.value = review.account_manager || "";
    elements.nextFollowUp.value = review.next_follow_up || "";
    elements.reviewNote.value = review.note || "";
  }

  function saveReview(event) {
    event.preventDefault();
    const lead = runData.leads.find((item) => item.lead_id === selectedLeadId);
    if (!lead) return;
    const review = {
      lead_id: lead.lead_id,
      status: elements.reviewStatus.value,
      account_manager: elements.accountManager.value.trim(),
      next_follow_up: elements.nextFollowUp.value,
      note: elements.reviewNote.value.trim(),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(reviewKey(lead), JSON.stringify(review));
    renderMetrics();
    renderLeadList();
  }

  function exportReviews() {
    const reviews = runData.leads.map((lead) => getReview(lead));
    const blob = new Blob([JSON.stringify({ run_id: runData.run_id, reviews }, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${runData.run_id || "review"}-reviews.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        runData = normalizeRun(JSON.parse(String(reader.result)));
        selectedLeadId = runData.leads[0]?.lead_id || null;
        render();
      } catch (error) {
        alert("JSON 格式无法解析");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function getReview(lead) {
    const stored = localStorage.getItem(reviewKey(lead));
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        localStorage.removeItem(reviewKey(lead));
      }
    }
    return {
      lead_id: lead.lead_id,
      status: lead.follow_status || "待人工确认",
      account_manager: "",
      next_follow_up: "",
      note: "",
      updated_at: "",
    };
  }

  function reviewKey(lead) {
    return `${STORAGE_PREFIX}${runData.run_id}:${lead.lead_id}`;
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${name}`);
    });
  }

  function displayContactValue(method) {
    if (method.status === "公开确认") return method.value || "未提供";
    return method.status || "待人工确认";
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
      .split(/[、,;；]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function statusLabel(status) {
    const labels = {
      done: "已完成",
      active: "进行中",
      blocked: "阻塞",
      pending: "待启动",
    };
    return labels[status] || status || "待启动";
  }

  function priorityClass(priority) {
    return String(priority || "").replace("+", "-plus").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
