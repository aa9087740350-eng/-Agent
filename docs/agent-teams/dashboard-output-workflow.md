# 网页复核台输出流程

本文档定义 agent 流水线结束后，如何把结构化结果同步到本地网页复核台。该流程是输出交接层，不新增采集、识别、评分、联系人或话术业务判断层。

## 目标

让客户经理打开 `outputs/dashboard/index.html` 时，能看到最近一次 agent 工作流的客户经理待复核包，包括线索列表、评分理由、证据链、联系方式及来源、话术建议和人工复核表单。

## Ownership

| 职责 | 主责 | 边界 |
| --- | --- | --- |
| 业务字段产出 | 各业务团队 | 只产出自己层级的结构化片段，不直接写网页数据文件 |
| 字段与敏感信息质检 | 数据契约与质量保障团队 | 检查字段完整性、联系方式来源、敏感信息展示规则 |
| 运行包合并与落盘 | 主控编排团队 | 合并各团队输出，写入工作流结果并运行落盘脚本 |
| 页面展示与人工复核 | 本地网页复核台 | 只展示、筛选、导入 JSON、保存本地复核状态，不自动触达 |

## 标准流程

```text
客户卡片与话术团队提交触达建议包
  -> 数据契约与质量保障团队检查字段和敏感联系方式来源
  -> 主控编排团队合并 outputs/workflow/latest-run.json
  -> 主控编排团队运行 tools/write-dashboard-run.js
  -> 生成 outputs/dashboard/data/latest-run.json
  -> 生成 outputs/dashboard/data/latest-run.js
  -> 客户经理打开 outputs/dashboard/index.html 复核
```

## 主控编排输入

主控编排团队必须从上游收齐以下结构化片段：

```text
画像配置
原始线索和证据
需求信号标签
评分和评分理由
联系人推荐和联系方式状态
客户卡片字段
话术建议
工作流阶段状态
```

任何缺失项不得静默补齐。未知值必须标记为 `未识别`、`未公开` 或 `待人工确认`。

## 运行包字段

顶层字段：

```text
run_id
run_mode
generated_at
status
workflow
leads
```

每条 `leads[]` 必须包含：

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

## 联系方式展示规则

`contact_methods[]` 中，只有 `status = 公开确认` 的联系方式可以明文展示。每条公开确认的联系方式必须包含：

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

`未公开`、`未识别`、`待人工确认` 或 `方向匹配待人工确认` 的联系方式不得填入推测值。不得通过姓名拼音、学校域名、学院域名或常见邮箱格式猜测联系方式。

## 命令

默认落盘命令：

```text
node tools/write-dashboard-run.js
```

指定输入和输出目录：

```text
node tools/write-dashboard-run.js --input outputs/workflow/latest-run.json --out-dir outputs/dashboard/data
```

脚本校验失败时，主控编排团队不得把流水线标记为完成。必须退回对应团队补齐字段或降低联系人/线索状态。

## 验收条件

- `outputs/workflow/latest-run.json` 存在且可解析。
- `tools/write-dashboard-run.js` 执行成功。
- `outputs/dashboard/data/latest-run.json` 和 `outputs/dashboard/data/latest-run.js` 均已更新。
- 网页复核台能展示线索、评分理由、证据链、联系方式来源和话术建议。
- 日志和命令输出不打印完整邮箱、手机号、微信号或其他具体联系方式。
- 页面状态停留在 `待人工确认`、`话术已生成` 或等价人工复核状态，不得标记为 `已联系`。

## 升级触发

- 公开确认联系方式缺少来源 URL、页面标题、证据片段或采集日期。
- A/A+ 线索缺少可追溯显性需求信号或痛点信号。
- 无显性需求信号和痛点信号的线索没有降级到 C/D。
- 落盘脚本失败。
- 任何业务团队试图直接覆盖网页复核台数据文件。
