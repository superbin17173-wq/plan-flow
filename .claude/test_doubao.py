import base64
import json
import urllib.request
import urllib.error
import sys

IMG = r"C:\Users\ljadmin\Desktop\6baae843bbbd2847e64386bfcea2f4a5.png"
KEY = "VxCgNvLTE.ChBJSFpBTXcwN0pOWHhha0M4EOn22_cHGAEqEPRvMH_dSkC3i4YiPvziRSU.-f8CvpwbCGaibca9U4Cej3q1V0-goLAZ1Ssa3rKc8yoLp0cNvX4uEiEVoIj7iup0dUcz6arQPq06dV2uUWN1GgeZ"
MODEL = "ep-20260702112758-5g4zb"
URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions"

with open(IMG, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
data_url = f"data:image/png;base64,{b64}"

body = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": "你是食物识别专家，返回严格 JSON：{items:[{name,amount,calories,protein,carbs,fat}], totalCalories}"},
        {"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": "识别图中食物，估算热量"},
        ]}
    ],
    "temperature": 0.2,
}

req = urllib.request.Request(
    URL,
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode()
        print("STATUS:", resp.status)
        print(text[:2000])
except urllib.error.HTTPError as e:
    print("HTTP_ERROR:", e.code)
    print(e.read().decode()[:2000])
except Exception as e:
    print("ERR:", type(e).__name__, str(e))
