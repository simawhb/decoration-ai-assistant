# CLAUDE.md — 装修AI帮手项目

## 项目概述

五位AI专家协同装修咨询系统，面向装修公司客户。

## 技术栈

- Python `http.server` 后端（server.py，端口8080）
- 纯HTML/CSS/JS前端，零依赖
- Rough.js 手绘风格渲染
- 混合AI模式：云端API优先 → 本地Ollama降级

## 五个AI专家

| Agent | 姓名 | 角色 |
|-------|------|------|
| scout | 司徒 | 市场专员 |
| digit | 迪哥 | 预算造价师 |
| nova  | 娜娜 | 首席设计师 |
| lex   | 雷虎 | 法务主管 |
| memo  | 小蔓 | 项目经理 |

## 文件结构

- `server.py` — 后端服务（混合AI、意图匹配、Agent调度）
- `webui/index.html` — 客户端页面（首页/对话/案例/流程/AI设置）
- `webui/admin.html` — 管理后台（/admin，密码admin）
- `webui/app.js` — 前端主逻辑
- `config.json` — Agent配置
- `一键启动.bat` — U盘版启动（自动检测Ollama）
- `启动服务.bat` — 简易启动
- `准备U盘.bat` — 打包U盘版
- `装修AI帮手-产品介绍.html` — 10页宣传PPT

## 启动方式

```bash
# 方式1：一键启动（推荐）
双击「一键启动.bat」

# 方式2：手动启动
python server.py
# 浏览器打开 http://localhost:8080
# 管理后台 http://localhost:8080/admin
```

## API配置

- 云端：Groq / 硅基流动 / 小米MiMo（免费额度）
- 本地：Ollama + qwen2.5:1.5b
- 策略：优先云端，自动降级本地

## GitHub

- 仓库：https://github.com/simawhb/decoration-ai-assistant
- 推送方式：HTTPS直连不通时，用Git Data API上传

## 注意事项

- 管理后台密码硬编码为admin，生产环境需改
- 客户数据存localStorage，不上传服务器
- 对外发布内容须经王洪兵确认
