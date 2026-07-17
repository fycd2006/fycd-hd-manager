# === DIAGNOSTIC TEST DOCKERFILE ===
# Temporary minimal image to test if HF build pipeline works at all.
# Will be reverted to baserow/baserow:1.29.1 once confirmed.
FROM python:3.11-slim

RUN pip install --no-cache-dir flask

WORKDIR /app

RUN echo 'from flask import Flask\nimport os\napp = Flask(__name__)\n@app.route("/")\ndef home():\n    return "<h1>Build Pipeline Test OK</h1><p>If you see this, the HF build system is working.</p>"\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 7860)))' > app.py

EXPOSE 7860

CMD ["python", "app.py"]