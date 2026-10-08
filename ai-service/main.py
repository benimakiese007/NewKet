from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from ultralytics import YOLO
from PIL import Image
import io

app = FastAPI(title="NewKet AI Vision Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading YOLO model...")
# YOLOv8 nano — léger, rapide, ~6MB
yolo_model = YOLO("yolov8n.pt")
print("YOLO model loaded!")

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "NewKet Vision API"}

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Détecte les objets dans une image avec YOLOv8.
    Retourne les bounding boxes et centres — le vecteur CLIP est généré côté navigateur.
    """
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    results = yolo_model(image)

    detected_objects = []

    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = box.conf[0].item()
            cls_id = int(box.cls[0].item())
            label = yolo_model.names[cls_id]

            # Filtre les détections trop incertaines
            if conf < 0.4:
                continue

            detected_objects.append({
                "label": label,
                "confidence": round(conf, 3),
                "box": {
                    "xmin": x1,
                    "ymin": y1,
                    "xmax": x2,
                    "ymax": y2
                },
                "center": {
                    "x": (x1 + x2) / 2,
                    "y": (y1 + y2) / 2
                }
                # Note: pas de vecteur ici — généré par clip-embedder.js dans le navigateur
            })

    return {"objects": detected_objects}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
