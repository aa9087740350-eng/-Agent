# 工作流输出目录

主控编排团队在每轮 agent 流水线结束后，先把通过数据契约质检的运行结果写入：

```text
outputs/workflow/latest-run.json
```

然后运行：

```text
node tools/write-dashboard-run.js
```

脚本会校验字段并同步生成：

```text
outputs/dashboard/data/latest-run.json
outputs/dashboard/data/latest-run.js
```

`outputs/dashboard/index.html` 只读取 `latest-run.js`，不会采集网页，也不会自动发送邮件、微信、短信或电话。

## 主控编排边界

- 只有主控编排团队可以统一写入 `outputs/workflow/latest-run.json` 和 `outputs/dashboard/data/latest-run.js`。
- 业务 agent 只能提交结构化片段，不得直接覆盖网页复核台数据文件。
- 数据契约与质量保障团队必须先检查字段完整性、联系方式来源和敏感信息规则。
- 落盘脚本不得在日志中打印完整邮箱、手机号、微信号或其他具体联系方式。

## 最小字段

运行包必须包含：

```text
run_id
run_mode
generated_at
status
workflow
leads
```

每条线索至少包含：

```text
lead_id
collected_at
institution
lab
owner
title
research_direction
potential_need
explicit_signals
pain_signals
urgency_signals
budget_or_project
recommended_service
entry_point
priority
score
score_reason
source_url
follow_status
contact
contact_methods
evidence
outreach
```
