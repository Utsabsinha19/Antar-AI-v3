# Antar AI - Running the Project

## 1. Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will start at: `http://localhost:5173`

## 2. Running the Python Backend (Optional / Cognitive Load WebSocket Server)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
The WebSocket endpoint runs at: `ws://localhost:8000/ws/analyze`
