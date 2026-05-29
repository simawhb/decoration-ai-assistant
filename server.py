# -*- coding: utf-8 -*-
"""
装修AI帮手 — 轻量后端
用法：python server.py
端口：8080
支持：OpenAI 兼容接口（mimo / ollama / 其他）
混合模式：优先云端API，降级本地Ollama
"""

import http.server
import json
import os
import sys
import subprocess
import urllib.request
import urllib.error
import socket
from pathlib import Path

PORT = 8080
BASE_DIR = Path(__file__).parent

# ===== 网络检测 =====
def check_network():
    """检测是否能访问互联网"""
    test_urls = [
        "https://api.groq.com",
        "https://api.siliconflow.cn",
        "https://www.baidu.com",
    ]
    for url in test_urls:
        try:
            urllib.request.urlopen(url, timeout=3)
            return True
        except Exception:
            continue
    return False

# 云端 API 配置（用户配置的在线服务）
CLOUD_API = {
    "api_base": "",
    "api_key": "",
    "model": "",
}

# ===== 便携 Ollama 检测 =====
RUNTIME_DIR = BASE_DIR / "runtime"
MODELS_DIR = BASE_DIR / "models"
PORTABLE_OLLAMA = RUNTIME_DIR / "ollama.exe"
ollama_process = None

def detect_portable_ollama():
    """检测便携 Ollama 并返回推荐配置"""
    if PORTABLE_OLLAMA.exists():
        return {
            "provider": "ollama",
            "api_base": "http://127.0.0.1:11434/v1",
            "api_key": "",
            "model": "qwen2.5:1.5b",
        }
    return None

def start_portable_ollama():
    """启动便携 Ollama 服务"""
    global ollama_process
    if not PORTABLE_OLLAMA.exists():
        return False

    # 检查是否已在运行
    try:
        urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2)
        return True  # 已在运行
    except Exception:
        pass

    env = os.environ.copy()
    env["OLLAMA_MODELS"] = str(MODELS_DIR)
    env["OLLAMA_HOST"] = "127.0.0.1:11434"
    env["OLLAMA_ORIGINS"] = "*"

    try:
        ollama_process = subprocess.Popen(
            [str(PORTABLE_OLLAMA), "serve"],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"[Ollama] 便携 Ollama 已启动 (PID: {ollama_process.pid})")
        print(f"[Ollama] 模型目录: {MODELS_DIR}")
        return True
    except Exception as e:
        print(f"[Ollama] 启动失败: {e}")
        return False

def stop_portable_ollama():
    """停止便携 Ollama"""
    global ollama_process
    if ollama_process:
        ollama_process.terminate()
        ollama_process = None
        print("[Ollama] 已停止")

def _check_ollama_running():
    """检查 Ollama 是否在运行"""
    try:
        urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=2)
        return True
    except Exception:
        return False

# ===== API 配置（混合模式）=====
# 云端配置（用户通过AI设置页面配置）
# 本地配置（便携Ollama自动检测）
_portable_cfg = detect_portable_ollama()

API_CONFIG = {
    "provider": "hybrid",  # 混合模式：优先云端，降级本地
    "api_base": os.environ.get("LLM_API_BASE", ""),
    "api_key": os.environ.get("LLM_API_KEY", ""),
    "model": os.environ.get("LLM_MODEL", ""),
    # 本地 Ollama 配置
    "ollama_base": "http://127.0.0.1:11434/v1",
    "ollama_model": "qwen2.5:1.5b",
    "has_portable_ollama": _portable_cfg is not None,
}

# 从 config.json 读取 API 配置（如果有的话）
def load_api_config():
    cfg_path = BASE_DIR / "api_config.json"
    if cfg_path.exists():
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                saved = json.load(f)
                # 只更新云端配置字段
                if "api_base" in saved:
                    API_CONFIG["api_base"] = saved["api_base"]
                if "api_key" in saved:
                    API_CONFIG["api_key"] = saved["api_key"]
                if "model" in saved:
                    API_CONFIG["model"] = saved["model"]
        except Exception:
            pass

def save_api_config(cfg):
    """保存云端 API 配置"""
    save_data = {
        "api_base": cfg.get("api_base", ""),
        "api_key": cfg.get("api_key", ""),
        "model": cfg.get("model", ""),
    }
    cfg_path = BASE_DIR / "api_config.json"
    with open(cfg_path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)
    API_CONFIG["api_base"] = save_data["api_base"]
    API_CONFIG["api_key"] = save_data["api_key"]
    API_CONFIG["model"] = save_data["model"]


# ===== Agent 系统提示词 =====
AGENT_PROMPTS = {
    "scout": """你是「司徒」，装修公司的市场专员。
职责：分析本地装修市场行情、竞品报价、楼盘动态、客户线索。
回复风格：简洁专业，用数据说话，给出具体建议。
注意：你只回答与市场情报相关的问题，不要越界到设计、报价、合同等领域。""",

    "digit": """你是「迪哥」，装修公司的预算造价师。
职责：根据户型面积、装修档次估算报价、计算材料用量、分析成本。
回复风格：数字精确，列表清晰，注明"预估"和"需量房确认"。
注意：你只回答与预算、报价、材料用量相关的问题。""",

    "nova": """你是「娜娜」，装修公司的首席设计师。
职责：根据客户需求给出设计方案建议、风格搭配、空间规划、案例推荐。
回复风格：亲切专业，用客户能懂的语言，避免过多专业术语。
注意：你只回答与设计方案、风格、空间布局相关的问题。""",

    "lex": """你是「雷虎」，装修公司的法务主管。
职责：审核合同条款、报价合规性、增项风险预警、保护客户权益。
回复风格：严谨准确，引用法规条款，风险等级明确标注（高/中/低）。
注意：你只回答与合同、法律合规、风险预警相关的问题。""",

    "memo": """你是「小蔓」，装修公司的项目经理。
职责：项目进度规划、工期安排、节点提醒、客户沟通协调。
回复风格：条理清晰，时间节点明确，给出具体计划。
注意：你只回答与工程进度、工期、项目管理相关的问题。""",
}

# 意图匹配关键词
INTENT_KEYWORDS = {
    "scout":  ["竞品","市场","楼盘","促销","同行","对手","行情","获客","线索","邻居"],
    "digit":  ["报价","预算","价格","多少钱","费用","造价","材料","面积","瓷砖","地板","涂料","估算"],
    "nova":   ["设计","风格","效果","方案","现代简约","北欧","新中式","轻奢","日式","工业风","美式","好看","布局","收纳","颜色","搭配"],
    "lex":    ["合同","报价单","合规","审核","增项","保修","付款","违约","陷阱","坑","模糊","条款","法律","消保","权益","风险"],
    "memo":   ["工期","多久","延期","进度","节点","开工","竣工","验收","水电","泥木","油漆","售后","回访","项目经理","沟通","安排","计划"],
}

def match_agents(user_text):
    """根据用户输入匹配应该回答的Agent"""
    matched = []
    t = user_text.lower()
    for key, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in t:
                matched.append(key)
                break
    if not matched:
        matched = ["memo"]  # 兜底
    return matched


def call_llm(system_prompt, user_message):
    """
    混合模式调用 LLM：
    1. 优先使用云端 API（如果配置了）
    2. 云端失败或未配置 → 降级到本地 Ollama
    """
    # 第一优先：云端 API
    if API_CONFIG["api_key"] and API_CONFIG["api_base"]:
        result = _call_api(
            API_CONFIG["api_base"],
            API_CONFIG["api_key"],
            API_CONFIG["model"],
            system_prompt,
            user_message,
        )
        if result and not result.startswith("["):
            return result
        # 云端失败，打印日志，继续尝试本地
        print(f"[Hybrid] 云端API失败: {result}")

    # 第二优先：本地 Ollama
    if _check_ollama_running():
        result = _call_api(
            API_CONFIG["ollama_base"],
            "",  # Ollama 不需要 key
            API_CONFIG["ollama_model"],
            system_prompt,
            user_message,
        )
        if result and not result.startswith("["):
            return result
        print(f"[Hybrid] 本地Ollama失败: {result}")

    # 都失败了
    if not API_CONFIG["api_key"]:
        return "[未配置AI服务] 请进入「AI 设置」配置 API Key，或确保本地 Ollama 已启动。"
    return "[AI服务不可用] 云端和本地服务均无法访问，请检查网络或配置。"


def _call_api(api_base, api_key, model, system_prompt, user_message):
    """调用单个 OpenAI 兼容接口"""
    api_base = api_base.rstrip("/")
    url = f"{api_base}/chat/completions"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.5,
        "max_tokens": 800,
    }

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        return f"[API错误 {e.code}] {body[:200]}"
    except Exception as e:
        return f"[请求失败] {str(e)}"


# ===== HTTP Handler =====
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR / "webui"), **kwargs)

    def do_GET(self):
        if self.path == "/api/config":
            self._json_response(API_CONFIG)
            return
        if self.path == "/api/status":
            has_cloud = bool(API_CONFIG.get("api_key") and API_CONFIG.get("api_base"))
            self._json_response({
                "mode": "hybrid",
                "cloud_configured": has_cloud,
                "cloud_model": API_CONFIG.get("model", ""),
                "portable_ollama": PORTABLE_OLLAMA.exists(),
                "ollama_running": _check_ollama_running(),
                "ollama_model": API_CONFIG.get("ollama_model", ""),
            })
            return
        if self.path == "/api/network":
            online = check_network()
            self._json_response({"online": online})
            return
        if self.path == "/admin" or self.path == "/admin/":
            self._serve_file("admin.html")
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            self._handle_chat()
        elif self.path == "/api/config":
            self._handle_save_config()
        elif self.path == "/api/test":
            self._handle_test_connection()
        else:
            self._json_response({"error": "not found"}, 404)

    def _handle_chat(self):
        """处理对话请求"""
        body = self._read_body()
        user_text = body.get("message", "").strip()
        if not user_text:
            self._json_response({"error": "empty message"}, 400)
            return

        # 意图匹配
        agents_to_call = match_agents(user_text)

        # 依次调用 Agent
        responses = []
        for agent_key in agents_to_call:
            prompt = AGENT_PROMPTS.get(agent_key, "你是一个装修顾问。")
            reply = call_llm(prompt, user_text)
            responses.append({
                "agent": agent_key,
                "name": _agent_name(agent_key),
                "title": _agent_title(agent_key),
                "response": reply,
            })

        self._json_response({"responses": responses})

    def _handle_save_config(self):
        """保存 API 配置"""
        body = self._read_body()
        save_api_config(body)
        self._json_response({"ok": True})

    def _handle_test_connection(self):
        """测试 API 连接"""
        try:
            result = call_llm("用一句话回复：你好", "你好")
            if result.startswith("["):
                self._json_response({"ok": False, "error": result})
            else:
                self._json_response({"ok": True, "reply": result})
        except Exception as e:
            self._json_response({"ok": False, "error": str(e)})

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _json_response(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _serve_file(self, filename):
        file_path = BASE_DIR / "webui" / filename
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self._json_response({"error": "not found"}, 404)

    def log_message(self, format, *args):
        print(f"[Server] {args[0]}" if args else "")


def _agent_name(key):
    names = {"scout":"司徒","digit":"迪哥","nova":"娜娜","lex":"雷虎","memo":"小蔓"}
    return names.get(key, key)

def _agent_title(key):
    titles = {"scout":"市场专员","digit":"预算造价师","nova":"首席设计师","lex":"法务主管","memo":"项目经理"}
    return titles.get(key, "")


# ===== 启动 =====
def main():
    load_api_config()

    # 如果有便携 Ollama，自动启动
    ollama_status = "未检测到"
    if PORTABLE_OLLAMA.exists():
        print("[Ollama] 检测到便携模型，正在启动...")
        if start_portable_ollama():
            ollama_status = "已启动"
        else:
            ollama_status = "启动失败"

    has_cloud = bool(API_CONFIG.get('api_key') and API_CONFIG.get('api_base'))
    cloud_display = f"{API_CONFIG['model']}" if has_cloud else "未配置"
    print(f"""
╔══════════════════════════════════════════════╗
║  装修AI帮手  v2.0（混合模式）              ║
║  http://localhost:{PORT}                      ║
╠══════════════════════════════════════════════╣
║  云端AI: {cloud_display:35s} ║
║  本地AI: {ollama_status:35s} ║
║  策略: 优先云端 → 降级本地                ║
╚══════════════════════════════════════════════╝
""")
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"服务已启动 → http://localhost:{PORT}")
    print("按 Ctrl+C 停止\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        stop_portable_ollama()
        print("服务已停止。")


if __name__ == "__main__":
    main()
